from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.app.models import Case


def _required_common_fields(case: Case) -> list[str]:
    missing: list[str] = []

    if not case.debtor_name:
        missing.append("debtor_name")
    if case.principal_amount is None:
        missing.append("principal_amount")
    if not case.due_date:
        missing.append("due_date")

    debtor = dict((case.contract_data or {}).get("debtor") or {})
    if not debtor.get("inn") and not debtor.get("ogrn"):
        missing.append("debtor.inn_or_ogrn")

    return missing


def get_available_documents(db: Session, case_id: int) -> list[dict[str, Any]]:
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return []

    common_missing = _required_common_fields(case)

    documents = [
        {
            "code": "payment_due_notice",
            "title": "Напоминание о пропуске срока оплаты",
            "ready": len(common_missing) == 0,
            "missing_fields": common_missing,
        },
        {
            "code": "debt_notice",
            "title": "Уведомление о задолженности",
            "ready": len(common_missing) == 0,
            "missing_fields": common_missing,
        },
        {
            "code": "pretension",
            "title": "Досудебная претензия",
            "ready": len(common_missing) == 0,
            "missing_fields": common_missing,
        },
        {
            "code": "lawsuit",
            "title": "Исковое заявление",
            "ready": len(common_missing) == 0,
            "missing_fields": common_missing,
        },
        {
            "code": "court_order",
            "title": "Заявление о выдаче судебного приказа",
            "ready": len(common_missing) == 0,
            "missing_fields": common_missing,
        },
        {
            "code": "fssp_application",
            "title": "Заявление в ФССП",
            "ready": len(common_missing) == 0,
            "missing_fields": common_missing,
        },
    ]

    return documents