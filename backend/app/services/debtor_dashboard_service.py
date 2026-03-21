from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models import Case, DebtorProfile
from backend.app.services.tenant_query_service import filter_cases_by_tenant


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _status_value(value: Any) -> str:
    return getattr(value, "value", value) if value is not None else ""


def _safe_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0"))
    except Exception:
        return Decimal("0")


def _extract_case_debtor(case: Case) -> dict[str, Any]:
    return dict((case.contract_data or {}).get("debtor") or {})


def _extract_identity(case: Case, profile: DebtorProfile | None) -> dict[str, Any]:
    debtor = _extract_case_debtor(case)

    return {
        "name": (
            _as_str(profile.name if profile else None)
            or _as_str(debtor.get("name_full"))
            or _as_str(debtor.get("name"))
            or _as_str(case.debtor_name)
        ),
        "debtor_type": _status_value(case.debtor_type),
        "inn": _as_str((profile.inn if profile else None) or debtor.get("inn")),
        "ogrn": _as_str((profile.ogrn if profile else None) or debtor.get("ogrn")),
        "address": _as_str((profile.address if profile else None) or debtor.get("address")),
        "director_name": _as_str(
            (profile.director_name if profile else None) or debtor.get("director_name")
        ),
    }


def _load_profiles_map(db: Session, tenant_id: int, case_ids: list[int]) -> dict[int, DebtorProfile]:
    if not case_ids:
        return {}

    rows = (
        db.query(DebtorProfile)
        .filter(
            DebtorProfile.tenant_id == tenant_id,
            DebtorProfile.case_id.in_(case_ids),
        )
        .all()
    )
    return {row.case_id: row for row in rows}


def _same_debtor(left: dict[str, Any], right: dict[str, Any]) -> bool:
    left_inn = _as_str(left.get("inn"))
    right_inn = _as_str(right.get("inn"))
    if left_inn and right_inn and left_inn == right_inn:
        return True

    left_ogrn = _as_str(left.get("ogrn"))
    right_ogrn = _as_str(right.get("ogrn"))
    if left_ogrn and right_ogrn and left_ogrn == right_ogrn:
        return True

    left_name = _as_str(left.get("name")).lower()
    right_name = _as_str(right.get("name")).lower()
    if left_name and right_name and left_name == right_name:
        return True

    return False


def get_debtor_dashboard(
    db: Session,
    *,
    tenant_id: int,
    debtor_id: int,
) -> dict[str, Any]:
    profile = (
        db.query(DebtorProfile)
        .filter(
            DebtorProfile.tenant_id == tenant_id,
            DebtorProfile.id == debtor_id,
        )
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Debtor profile not found")

    base_case = (
        db.query(Case)
        .filter(
            Case.tenant_id == tenant_id,
            Case.id == profile.case_id,
        )
        .first()
    )
    if not base_case:
        raise HTTPException(status_code=404, detail="Base case for debtor profile not found")

    query = db.query(Case).order_by(Case.id.desc())
    query = filter_cases_by_tenant(query, tenant_id, include_archived=True)
    all_cases = query.all()

    profiles_map = _load_profiles_map(db, tenant_id, [item.id for item in all_cases])

    base_identity = _extract_identity(base_case, profile)

    matched_cases: list[Case] = []
    for item in all_cases:
        item_identity = _extract_identity(item, profiles_map.get(item.id))
        if _same_debtor(base_identity, item_identity):
            matched_cases.append(item)

    total_amount = Decimal("0")
    active_cases_count = 0
    archived_cases_count = 0

    serialized_cases: list[dict[str, Any]] = []
    for item in matched_cases:
        amount = _safe_decimal(item.principal_amount)
        total_amount += amount

        if bool(getattr(item, "is_archived", False)):
            archived_cases_count += 1
        else:
            active_cases_count += 1

        serialized_cases.append(
            {
                "case_id": item.id,
                "debtor_name": item.debtor_name,
                "contract_type": _status_value(item.contract_type),
                "principal_amount": str(item.principal_amount) if item.principal_amount is not None else None,
                "due_date": item.due_date.isoformat() if item.due_date else None,
                "status": _status_value(item.status),
                "is_archived": bool(getattr(item, "is_archived", False)),
            }
        )

    return {
        "debtor_id": debtor_id,
        "debtor": {
            "id": profile.id,
            "name": base_identity.get("name") or None,
            "debtor_type": base_identity.get("debtor_type") or None,
            "inn": base_identity.get("inn") or None,
            "ogrn": base_identity.get("ogrn") or None,
            "address": base_identity.get("address") or None,
            "director_name": base_identity.get("director_name") or None,
        },
        "cases": serialized_cases,
        "summary": {
            "cases_count": len(serialized_cases),
            "active_cases_count": active_cases_count,
            "archived_cases_count": archived_cases_count,
            "total_principal_amount": f"{total_amount:.2f}",
        },
    }


def get_debtor_cases(
    db: Session,
    *,
    tenant_id: int,
    debtor_id: int,
) -> dict[str, Any]:
    dashboard = get_debtor_dashboard(db, tenant_id=tenant_id, debtor_id=debtor_id)
    return {
        "debtor_id": debtor_id,
        "items": list(dashboard.get("cases") or []),
    }