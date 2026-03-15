from __future__ import annotations

from datetime import datetime
from typing import Any


def utcnow() -> datetime:
    return datetime.utcnow()


def serialize_dt(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def build_case_eligibility_context(case: Any) -> dict[str, Any]:
    contract_data = case.contract_data or {}
    stage = contract_data.get("stage") or {}
    flags = stage.get("flags") or {}
    recovery = contract_data.get("recovery") or {}
    debtor = contract_data.get("debtor") or {}

    return {
        "case_id": case.id,
        "case_status": case.status.value if hasattr(case.status, "value") else str(case.status),
        "contract_type": case.contract_type.value if hasattr(case.contract_type, "value") else str(case.contract_type),
        "debtor_type": case.debtor_type.value if hasattr(case.debtor_type, "value") else str(case.debtor_type),
        "principal_amount": str(getattr(case, "principal_amount", "") or ""),
        "due_date": getattr(case, "due_date", None),
        "is_archived": bool(getattr(case, "is_archived", False)),
        "payment_due_notice_sent": bool(flags.get("payment_due_notice_sent")),
        "debt_notice_sent": bool(flags.get("debt_notice_sent")),
        "pretrial_sent": bool(flags.get("notified")),
        "documents_prepared": bool(flags.get("documents_prepared")),
        "fssp_prepared": bool(flags.get("fssp_prepared")),
        "closed": bool(flags.get("closed")),
        "recovery_exists": bool(recovery),
        "debtor_inn": debtor.get("inn"),
        "debtor_ogrn": debtor.get("ogrn"),
        "debtor_name": debtor.get("name") or getattr(case, "debtor_name", None),
    }


def eval_eligibility_expr(expr: str | None, context: dict[str, Any]) -> tuple[bool, str | None]:
    if not expr:
        return True, None

    safe_globals: dict[str, Any] = {"__builtins__": {}}
    safe_locals = dict(context)

    try:
        result = bool(eval(expr, safe_globals, safe_locals))
        return result, None
    except Exception as exc:
        return False, f"eligibility_eval_error: {exc}"


def compute_blockers_for_step(step: Any, context: dict[str, Any]) -> list[dict[str, Any]]:
    blockers: list[dict[str, Any]] = []

    ok, eval_error = eval_eligibility_expr(getattr(step, "eligibility_expr", None), context)
    if eval_error:
        blockers.append(
            {
                "code": "eligibility_eval_error",
                "title": "Ошибка расчета eligibility",
                "details": eval_error,
            }
        )
        return blockers

    if not ok:
        blockers.append(
            {
                "code": "eligibility_not_met",
                "title": "Условия шага не выполнены",
                "details": getattr(step, "eligibility_expr", None),
            }
        )

    return blockers