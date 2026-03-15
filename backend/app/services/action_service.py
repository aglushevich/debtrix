from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.app.models import Case


def _flags(case: Case) -> dict[str, bool]:
    stage = dict((case.contract_data or {}).get("stage") or {})
    raw_flags = dict(stage.get("flags") or {})
    return {
        "payment_due_notice_sent": bool(raw_flags.get("payment_due_notice_sent")),
        "debt_notice_sent": bool(raw_flags.get("debt_notice_sent")),
        "notified": bool(raw_flags.get("notified")),
        "documents_prepared": bool(raw_flags.get("documents_prepared")),
        "fssp_prepared": bool(raw_flags.get("fssp_prepared")),
        "closed": bool(raw_flags.get("closed")),
    }


def get_available_actions(db: Session, case_id: int) -> list[dict[str, Any]]:
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return []

    flags = _flags(case)

    if flags["closed"]:
        return []

    actions: list[dict[str, Any]] = []

    if not flags["payment_due_notice_sent"]:
        actions.append(
            {
                "code": "send_payment_due_notice",
                "title": "Отправить напоминание об оплате",
            }
        )
        return actions

    if not flags["debt_notice_sent"]:
        actions.append(
            {
                "code": "send_debt_notice",
                "title": "Отправить уведомление о задолженности",
            }
        )
        return actions

    if not flags["notified"]:
        actions.append(
            {
                "code": "send_pretension",
                "title": "Подготовить и зафиксировать досудебную претензию",
            }
        )
        return actions

    if not flags["documents_prepared"]:
        actions.append(
            {
                "code": "prepare_lawsuit",
                "title": "Подготовить пакет судебных документов",
            }
        )

    if not flags["fssp_prepared"]:
        actions.append(
            {
                "code": "prepare_fssp_application",
                "title": "Подготовить пакет для ФССП",
            }
        )

    actions.append(
        {
            "code": "close_case",
            "title": "Закрыть дело",
        }
    )

    return actions