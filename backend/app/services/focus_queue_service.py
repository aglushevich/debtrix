from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models.case import Case
from backend.app.models.debtor_profile import DebtorProfile
from backend.app.services.portfolio_routing_service import build_portfolio_routing
from backend.app.services.tenant_query_service import filter_cases_by_tenant


def _status_value(value: Any) -> str:
    return str(getattr(value, "value", value) or "").strip()


def _amount_to_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except Exception:
        return 0.0


def _extract_debtor_identifiers(
    case: Case,
    debtor_profile: DebtorProfile | None,
) -> tuple[str | None, str | None]:
    contract_data = dict(case.contract_data or {})
    debtor = dict(contract_data.get("debtor") or {})

    inn = (debtor_profile.inn if debtor_profile else None) or debtor.get("inn")
    ogrn = (debtor_profile.ogrn if debtor_profile else None) or debtor.get("ogrn")
    return inn, ogrn


def _is_overdue(case: Case) -> bool:
    if not case.due_date:
        return False
    return case.due_date < date.today()


def _blocked_reason_flags(case: Case, debtor_profile: DebtorProfile | None) -> list[str]:
    reasons: list[str] = []

    if not str(case.debtor_name or "").strip():
        reasons.append("missing_debtor_name")

    if _amount_to_float(case.principal_amount) <= 0:
        reasons.append("missing_principal_amount")

    if not case.due_date:
        reasons.append("missing_due_date")

    inn, ogrn = _extract_debtor_identifiers(case, debtor_profile)
    if not str(inn or "").strip() and not str(ogrn or "").strip():
        reasons.append("missing_debtor_identifiers")

    return reasons


def _risk_score(case: Case, debtor_profile: DebtorProfile | None) -> int:
    amount = _amount_to_float(case.principal_amount)
    status = _status_value(case.status)
    blocked_flags = _blocked_reason_flags(case, debtor_profile)

    score = 0

    if status == "pretrial":
        score += 35
    elif status == "overdue":
        score += 25
    elif status == "court":
        score += 45
    elif status in {"fssp", "enforcement"}:
        score += 30
    elif status == "draft":
        score += 5

    if amount >= 1_000_000:
        score += 35
    elif amount >= 500_000:
        score += 25
    elif amount >= 100_000:
        score += 15
    elif amount > 0:
        score += 8

    if _is_overdue(case):
        score += 10

    if blocked_flags:
        score += 12

    return min(score, 100)


def _risk_level(score: int) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


def _queue_title(queue_code: str) -> str:
    titles = {
        "urgent_ready": "Urgent ready",
        "blocked_cleanup": "Blocked cleanup",
        "waiting_next": "Waiting next",
        "court_lane": "Court lane",
        "enforcement_lane": "Enforcement lane",
    }
    return titles.get(queue_code, queue_code)


def _queue_recommendation(
    queue_code: str,
    routing_status: str,
    status: str,
) -> str:
    if queue_code == "urgent_ready":
        return "Открыть карточку и выполнить следующий шаг"
    if queue_code == "blocked_cleanup":
        return "Снять blocker’ы и вернуть дело в ready lane"
    if queue_code == "waiting_next":
        return "Контролировать eligible_at и готовить следующий запуск"
    if queue_code == "court_lane":
        return "Проверить судебный пакет и движение по court lane"
    if queue_code == "enforcement_lane":
        return "Проверить исполнительный трек и внешние действия"

    if routing_status == "waiting":
        return "Контролировать eligible_at"
    if routing_status == "blocked":
        return "Снять blocker’ы"
    if status == "court":
        return "Проверить судебный трек"
    if status in {"fssp", "enforcement"}:
        return "Проверить исполнительный трек"
    return "Проверить маршрут взыскания"


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


def _build_routing_map(routing: dict[str, Any]) -> dict[int, dict[str, Any]]:
    buckets = dict(routing.get("buckets") or {})
    result: dict[int, dict[str, Any]] = {}

    for bucket_code in ("ready", "waiting", "blocked", "idle"):
        rows = buckets.get(bucket_code) or []
        for row in rows:
            case_id = row.get("case_id")
            if not case_id:
                continue
            result[int(case_id)] = {
                "bucket": bucket_code,
                "row": row,
            }

    return result


def _priority_sort_key(item: dict[str, Any]) -> tuple[Any, ...]:
    return (
        -int(item.get("priority_score") or 0),
        -_amount_to_float(item.get("principal_amount")),
        int(item.get("case_id") or 0),
    )


def _waiting_sort_key(item: dict[str, Any]) -> tuple[Any, ...]:
    eligible_at = _parse_dt(item.get("waiting_eligible_at"))
    return (
        eligible_at or datetime.max,
        -int(item.get("risk_score") or 0),
        int(item.get("case_id") or 0),
    )


def _serialize_focus_item(
    *,
    queue_code: str,
    priority_item: dict[str, Any],
    routing_bucket: str | None,
    routing_row: dict[str, Any] | None,
) -> dict[str, Any]:
    routing_row = routing_row or {}

    routing_status = str(
        priority_item.get("routing_status")
        or routing_row.get("routing_status")
        or routing_bucket
        or ""
    ).strip()

    status = str(priority_item.get("status") or "").strip()

    return {
        "case_id": priority_item.get("case_id"),
        "queue_code": queue_code,
        "queue_title": _queue_title(queue_code),
        "debtor_name": priority_item.get("debtor_name"),
        "status": priority_item.get("status"),
        "contract_type": priority_item.get("contract_type"),
        "debtor_type": priority_item.get("debtor_type"),
        "principal_amount": priority_item.get("principal_amount"),
        "due_date": priority_item.get("due_date"),
        "risk_score": priority_item.get("risk_score"),
        "risk_level": priority_item.get("risk_level"),
        "priority_score": priority_item.get("priority_score", priority_item.get("risk_score", 0)),
        "priority_band": priority_item.get("priority_band"),
        "priority_band_label": priority_item.get("priority_band_label"),
        "priority_reasons": list(priority_item.get("priority_reasons") or []),
        "operator_focus": priority_item.get("operator_focus"),
        "decision_positives": list(priority_item.get("decision_positives") or []),
        "decision_blockers": list(priority_item.get("decision_blockers") or []),
        "decision_signals": list(priority_item.get("decision_signals") or []),
        "signals": list(priority_item.get("signals") or []),
        "routing_bucket": priority_item.get("routing_bucket") or routing_bucket,
        "routing_status": routing_status or None,
        "routing_hint": priority_item.get("routing_hint") or routing_row.get("routing_hint"),
        "waiting_reason": priority_item.get("waiting_reason") or routing_row.get("waiting_reason"),
        "waiting_eligible_at": priority_item.get("waiting_eligible_at")
        or routing_row.get("waiting_eligible_at"),
        "blocked_reasons": list(priority_item.get("blocked_reasons") or []),
        "recommended_action": priority_item.get("recommended_action")
        or _queue_recommendation(queue_code, routing_status, status),
        "is_archived": bool(priority_item.get("is_archived")),
        "inn": priority_item.get("inn"),
        "ogrn": priority_item.get("ogrn"),
    }


def _load_cases_with_profiles(
    db: Session,
    tenant_id: int,
    *,
    include_archived: bool = False,
) -> tuple[list[Case], dict[int, DebtorProfile]]:
    query = db.query(Case).order_by(Case.id.desc())
    query = filter_cases_by_tenant(query, tenant_id, include_archived=include_archived)
    cases = query.all()

    profiles_map: dict[int, DebtorProfile] = {}
    case_ids = [item.id for item in cases]

    if case_ids:
        profiles = (
            db.query(DebtorProfile)
            .filter(
                DebtorProfile.tenant_id == tenant_id,
                DebtorProfile.case_id.in_(case_ids),
            )
            .all()
        )
        profiles_map = {item.case_id: item for item in profiles}

    return cases, profiles_map


def get_control_room_focus_queues(
    db: Session,
    *,
    tenant_id: int,
    include_archived: bool = False,
    per_queue_limit: int = 5,
) -> dict[str, Any]:
    cases, profiles_map = _load_cases_with_profiles(
        db,
        tenant_id,
        include_archived=include_archived,
    )

    routing = build_portfolio_routing(
        db,
        tenant_id=tenant_id,
        cases=cases,
    )
    routing_map = _build_routing_map(routing)

    from backend.app.services.control_room_service import get_control_room_priority_cases

    priority_payload = get_control_room_priority_cases(
        db,
        tenant_id=tenant_id,
        limit=max(len(cases), 10),
        include_archived=include_archived,
    )
    priority_items = list(priority_payload.get("items") or [])
    priority_map: dict[int, dict[str, Any]] = {
        int(item["case_id"]): item
        for item in priority_items
        if item.get("case_id") is not None
    }

    urgent_ready: list[dict[str, Any]] = []
    blocked_cleanup: list[dict[str, Any]] = []
    waiting_next: list[dict[str, Any]] = []
    court_lane: list[dict[str, Any]] = []
    enforcement_lane: list[dict[str, Any]] = []

    for case in cases:
        case_id = int(case.id)
        profile = profiles_map.get(case.id)
        _ = profile

        priority_item = priority_map.get(case_id)
        if not priority_item:
            continue

        routing_ref = routing_map.get(case_id) or {}
        routing_bucket = str(
            routing_ref.get("bucket")
            or ((routing_ref.get("row") or {}).get("routing_status"))
            or ""
        ).strip()
        routing_row = routing_ref.get("row") or {}

        status = _status_value(case.status)

        if priority_item.get("routing_status") == "ready" and not priority_item.get("blocked"):
            urgent_ready.append(
                _serialize_focus_item(
                    queue_code="urgent_ready",
                    priority_item=priority_item,
                    routing_bucket=routing_bucket,
                    routing_row=routing_row,
                )
            )

        if priority_item.get("blocked") or priority_item.get("routing_status") == "blocked":
            blocked_cleanup.append(
                _serialize_focus_item(
                    queue_code="blocked_cleanup",
                    priority_item=priority_item,
                    routing_bucket=routing_bucket,
                    routing_row=routing_row,
                )
            )

        if priority_item.get("routing_status") == "waiting":
            waiting_next.append(
                _serialize_focus_item(
                    queue_code="waiting_next",
                    priority_item=priority_item,
                    routing_bucket=routing_bucket,
                    routing_row=routing_row,
                )
            )

        if status == "court":
            court_lane.append(
                _serialize_focus_item(
                    queue_code="court_lane",
                    priority_item=priority_item,
                    routing_bucket=routing_bucket,
                    routing_row=routing_row,
                )
            )

        if status in {"fssp", "enforcement"}:
            enforcement_lane.append(
                _serialize_focus_item(
                    queue_code="enforcement_lane",
                    priority_item=priority_item,
                    routing_bucket=routing_bucket,
                    routing_row=routing_row,
                )
            )

    urgent_ready.sort(key=_priority_sort_key)
    blocked_cleanup.sort(key=_priority_sort_key)
    waiting_next.sort(key=_waiting_sort_key)
    court_lane.sort(key=_priority_sort_key)
    enforcement_lane.sort(key=_priority_sort_key)

    return {
        "summary": {
            "urgent_ready": len(urgent_ready),
            "blocked_cleanup": len(blocked_cleanup),
            "waiting_next": len(waiting_next),
            "court_lane": len(court_lane),
            "enforcement_lane": len(enforcement_lane),
        },
        "queues": {
            "urgent_ready": urgent_ready[:per_queue_limit],
            "blocked_cleanup": blocked_cleanup[:per_queue_limit],
            "waiting_next": waiting_next[:per_queue_limit],
            "court_lane": court_lane[:per_queue_limit],
            "enforcement_lane": enforcement_lane[:per_queue_limit],
        },
    }