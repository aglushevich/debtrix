from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.app.events import CaseEvent, CaseEventType, emit_event
from backend.app.models import Case
from backend.app.services.integration_service import (
    get_or_create_case_integration,
    mark_integration_error,
    mark_integration_success,
)


def run_fssp_case_check(
    db: Session,
    *,
    case: Case,
    tenant_id: int,
) -> dict[str, Any]:
    row = get_or_create_case_integration(
        db,
        tenant_id=tenant_id,
        case_id=case.id,
        provider="fssp",
        mode="monitor",
    )

    debtor_block = dict((case.contract_data or {}).get("debtor") or {})
    inn = debtor_block.get("inn")
    ogrn = debtor_block.get("ogrn")

    if not case.debtor_name and not inn and not ogrn:
        details = {
            "debtor_name": case.debtor_name,
            "inn": inn,
            "ogrn": ogrn,
            "result": "skipped",
            "comment": "Для проверки ФССП нужны хотя бы name / inn / ogrn.",
        }
        mark_integration_error(
            db,
            row,
            error="Недостаточно данных для проверки ФССП.",
            details=details,
        )

        emit_event(
            db,
            CaseEvent(
                case_id=case.id,
                type=CaseEventType.INTEGRATION_FAILED,
                title="Проверка ФССП не выполнена",
                details="Недостаточно данных для запроса в ФССП.",
                payload={"provider": "fssp", **details},
            ),
        )

        return {
            "ok": False,
            "case_id": case.id,
            "provider": "fssp",
            "status": row.status,
            "details": row.data or {},
        }

    details: dict[str, Any] = {
        "debtor_name": case.debtor_name,
        "inn": inn,
        "ogrn": ogrn,
        "result": "not_found_yet",
        "comment": "Пока это scaffold-провайдер. Реальный поиск в ФССП будет подключён следующим блоком.",
    }

    mark_integration_success(
        db,
        row,
        status="checked",
        details=details,
    )

    emit_event(
        db,
        CaseEvent(
            case_id=case.id,
            type=CaseEventType.INTEGRATION_CHECKED,
            title="Проверка ФССП выполнена",
            details="Сформирован статус мониторинга ФССП.",
            payload={"provider": "fssp", **details},
        ),
    )

    return {
        "ok": True,
        "case_id": case.id,
        "provider": "fssp",
        "status": row.status,
        "details": details,
    }