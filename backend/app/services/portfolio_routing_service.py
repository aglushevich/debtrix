from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models import Case
from backend.app.services.playbook_engine_service import evaluate_case_playbook


def _status_value(value: Any) -> str:
    return str(getattr(value, "value", value) or "").strip()


def _route_lane(case: Case) -> str:
    status = _status_value(case.status)

    if status == "court":
        return "court_lane"
    if status in {"fssp", "enforcement"}:
        return "enforcement_lane"
    if status == "closed":
        return "closed_lane"
    return "soft_lane"


def _route_lane_title(code: str) -> str:
    titles = {
        "soft_lane": "Soft lane",
        "court_lane": "Court lane",
        "enforcement_lane": "Enforcement lane",
        "closed_lane": "Closed lane",
    }
    return titles.get(code, code)


def _serialize_waiting_bucket(bucket: Any) -> dict[str, Any] | None:
    if not bucket:
        return None

    eligible_at = bucket.get("eligible_at")
    if isinstance(eligible_at, datetime):
        eligible_at = eligible_at.isoformat()

    reason_text = (
        bucket.get("reason_text")
        or bucket.get("waiting_reason")
        or bucket.get("reason")
    )

    return {
        "step_code": bucket.get("step_code"),
        "bucket_code": bucket.get("bucket_code") or "waiting_for_eligibility",
        "status": bucket.get("status") or "waiting",
        "reason_code": bucket.get("reason_code"),
        "reason_text": reason_text,
        "reason": reason_text,
        "eligible_at": eligible_at,
    }


def _blocked_hint(blocked_steps: list[Any]) -> str | None:
    if not blocked_steps:
        return None

    first = blocked_steps[0]

    if isinstance(first, dict):
        blockers = first.get("blockers") or []
        if blockers:
            return str(blockers[0])

        return (
            first.get("title")
            or first.get("label")
            or first.get("step_code")
            or "Есть blocker"
        )

    return str(first)


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

    first_waiting = _serialize_waiting_bucket(waiting_buckets[0]) if waiting_buckets else None
    blocked_hint = _blocked_hint(blocked_steps)
    route_lane = _route_lane(case)

    if routing_status == "waiting" and first_waiting:
        routing_hint = first_waiting.get("reason") or "Ожидает окна выполнения"
    elif routing_status == "blocked":
        routing_hint = blocked_hint or "Нужно устранить blocker"
    elif routing_status == "ready":
        routing_hint = "Можно выполнять следующий шаг"
    else:
        routing_hint = "Требуется разбор маршрута"

    return {
        "case_id": case.id,
        "debtor_name": case.debtor_name,
        "contract_type": getattr(case.contract_type, "value", case.contract_type),
        "debtor_type": getattr(case.debtor_type, "value", case.debtor_type),
        "status": getattr(case.status, "value", case.status),
        "is_archived": bool(getattr(case, "is_archived", False)),
        "playbook_code": (playbook_eval.get("playbook") or {}).get("code"),
        "route_lane": route_lane,
        "route_lane_title": _route_lane_title(route_lane),
        "routing_status": routing_status,
        "routing_hint": routing_hint,
        "current_step": current_step,
        "current_step_code": (current_step or {}).get("step_code") if isinstance(current_step, dict) else None,
        "current_step_title": (current_step or {}).get("title") if isinstance(current_step, dict) else None,
        "next_actions": next_actions,
        "next_action_codes": [
            str(item.get("action_code"))
            for item in next_actions
            if isinstance(item, dict) and item.get("action_code")
        ],
        "waiting_bucket": first_waiting,
        "waiting_reason": first_waiting.get("reason") if first_waiting else None,
        "waiting_reason_code": first_waiting.get("reason_code") if first_waiting else None,
        "waiting_eligible_at": first_waiting.get("eligible_at") if first_waiting else None,
        "blocked_steps": blocked_steps,
        "blocked_hint": blocked_hint,
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

    lane_summary = {
        "soft_lane": 0,
        "court_lane": 0,
        "enforcement_lane": 0,
        "closed_lane": 0,
    }

    for case in cases:
        playbook_eval = evaluate_case_playbook(db, case, tenant_id=tenant_id)
        row = serialize_portfolio_case_row(case, playbook_eval)

        lane_summary[row["route_lane"]] = lane_summary.get(row["route_lane"], 0) + 1

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
        "lane_summary": lane_summary,
        "buckets": {
            "ready": ready,
            "waiting": waiting,
            "blocked": blocked,
            "idle": idle,
        },
    }