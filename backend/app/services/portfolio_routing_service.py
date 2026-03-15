from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.app.models import Case
from backend.app.services.playbook_engine_service import evaluate_case_playbook


def serialize_portfolio_case_row(case: Case, playbook_eval: dict[str, Any]) -> dict[str, Any]:
    current_step = playbook_eval.get("current_step")
    next_actions = playbook_eval.get("next_actions") or []
    waiting_buckets = playbook_eval.get("waiting_buckets") or []
    blocked_steps = playbook_eval.get("blocked_steps") or []

    if current_step:
        routing_status = "ready"
    elif waiting_buckets:
        routing_status = "waiting"
    elif blocked_steps:
        routing_status = "blocked"
    else:
        routing_status = "idle"

    first_waiting = waiting_buckets[0] if waiting_buckets else None

    return {
        "case_id": case.id,
        "debtor_name": case.debtor_name,
        "contract_type": case.contract_type.value if hasattr(case.contract_type, "value") else str(case.contract_type),
        "debtor_type": case.debtor_type.value if hasattr(case.debtor_type, "value") else str(case.debtor_type),
        "status": case.status.value if hasattr(case.status, "value") else str(case.status),
        "is_archived": bool(getattr(case, "is_archived", False)),
        "playbook_code": (playbook_eval.get("playbook") or {}).get("code"),
        "routing_status": routing_status,
        "current_step": current_step,
        "next_actions": next_actions,
        "waiting_bucket": first_waiting,
        "blocked_steps": blocked_steps,
    }


def build_portfolio_routing(
    db: Session,
    *,
    tenant_id: int,
    cases: list[Case],
) -> dict[str, Any]:
    ready: list[dict[str, Any]] = []
    waiting: list[dict[str, Any]] = []
    blocked: list[dict[str, Any]] = []
    idle: list[dict[str, Any]] = []

    for case in cases:
        playbook_eval = evaluate_case_playbook(db, case, tenant_id=tenant_id)
        row = serialize_portfolio_case_row(case, playbook_eval)

        status = row["routing_status"]
        if status == "ready":
            ready.append(row)
        elif status == "waiting":
            waiting.append(row)
        elif status == "blocked":
            blocked.append(row)
        else:
            idle.append(row)

    return {
        "summary": {
            "total": len(cases),
            "ready": len(ready),
            "waiting": len(waiting),
            "blocked": len(blocked),
            "idle": len(idle),
        },
        "buckets": {
            "ready": ready,
            "waiting": waiting,
            "blocked": blocked,
            "idle": idle,
        },
    }