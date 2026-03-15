from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.app.events import CaseEvent, CaseEventType, emit_event
from backend.app.integrations.registry import get_provider
from backend.app.models import Case, DebtorProfile
from backend.app.services.integration_service import (
    get_or_create_case_integration,
    mark_integration_error,
    mark_integration_success,
)
from backend.app.services.tenant_query_service import filter_debtor_profiles_by_tenant


def run_fns_case_sync(
    db: Session,
    *,
    case: Case,
    tenant_id: int,
) -> dict[str, Any]:
    row = get_or_create_case_integration(
        db,
        tenant_id=tenant_id,
        case_id=case.id,
        provider="fns",
        mode="sync",
    )

    provider = get_provider("fns")
    result = provider.sync_case(
        db,
        case=case,
        tenant_id=tenant_id,
    )

    if not result.get("ok"):
        error_text = result.get("error") or "Ошибка синхронизации с ФНС."
        details = result.get("details") or {}

        mark_integration_error(
            db,
            row,
            error=error_text,
            details=details,
        )

        emit_event(
            db,
            CaseEvent(
                case_id=case.id,
                type=CaseEventType.INTEGRATION_FAILED,
                title="Синхронизация ФНС завершилась ошибкой",
                details=error_text,
                payload={"provider": "fns", **details},
            ),
        )

        return {
            "ok": False,
            "case_id": case.id,
            "provider": "fns",
            "status": row.status,
            "details": row.data or {},
        }

    details = dict(result.get("details") or {})
    debtor_block = dict((case.contract_data or {}).get("debtor") or {})

    debtor_block["inn"] = details.get("inn")
    debtor_block["ogrn"] = details.get("ogrn")
    debtor_block["name"] = details.get("name")
    debtor_block["name_full"] = details.get("name_full")
    debtor_block["name_short"] = details.get("name_short")
    debtor_block["kpp"] = details.get("kpp")
    debtor_block["address"] = details.get("address")
    debtor_block["director_name"] = details.get("director_name")
    debtor_block["status"] = details.get("status")
    debtor_block["registration_date"] = details.get("registration_date")
    debtor_block["okved_main"] = details.get("okved_main")
    debtor_block["source"] = details.get("source")

    cd = dict(case.contract_data or {})
    cd["debtor"] = debtor_block
    case.contract_data = cd
    db.add(case)

    profile_query = db.query(DebtorProfile).filter(DebtorProfile.case_id == case.id)
    profile_query = filter_debtor_profiles_by_tenant(profile_query, tenant_id)
    profile = profile_query.first()

    if not profile:
        profile = DebtorProfile(case_id=case.id, tenant_id=tenant_id)
        db.add(profile)

    profile.tenant_id = tenant_id
    profile.inn = details.get("inn")
    profile.ogrn = details.get("ogrn")
    profile.name = details.get("name")
    profile.address = details.get("address")
    profile.director_name = details.get("director_name")
    profile.source = details.get("source") or "fns_mock"
    profile.raw = {
        "name_full": details.get("name_full"),
        "name_short": details.get("name_short"),
        "kpp": details.get("kpp"),
        "status": details.get("status"),
        "registration_date": details.get("registration_date"),
        "okved_main": details.get("okved_main"),
        "provider_payload": details.get("raw") or {},
    }

    mark_integration_success(
        db,
        row,
        status=str(result.get("status") or "synced"),
        details=details,
        external_id=result.get("external_id"),
    )

    emit_event(
        db,
        CaseEvent(
            case_id=case.id,
            type=CaseEventType.INTEGRATION_SYNCED,
            title="Синхронизация с ФНС выполнена",
            details="Профиль должника синхронизирован через provider layer.",
            payload={"provider": "fns", **details},
        ),
    )

    return {
        "ok": True,
        "case_id": case.id,
        "provider": "fns",
        "status": row.status,
        "details": details,
    }