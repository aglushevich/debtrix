from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models.automation_run import AutomationRun
from backend.app.models.batch_job import BatchJob
from backend.app.models.case import Case
from backend.app.models.debtor_profile import DebtorProfile
from backend.app.services.case_dashboard_service import build_case_dashboard
from backend.app.services.focus_queue_service import get_control_room_focus_queues
from backend.app.services.portfolio_routing_service import build_portfolio_routing
from backend.app.services.priority_engine_service import build_case_priority_snapshot
from backend.app.services.tenant_query_service import filter_cases_by_tenant
from backend.app.services.waiting_bucket_service import list_waiting_buckets


def _status_value(value: Any) -> str:
    return str(getattr(value, "value", value) or "").strip()


def _amount_to_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except Exception:
        return 0.0


def _format_money(value: float) -> str:
    return f"{value:.2f}"


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


def _status_bucket(status: str) -> str:
    if status == "closed":
        return "closed"
    if status == "court":
        return "court"
    if status in {"fssp", "enforcement"}:
        return "fssp"
    if status == "pretrial":
        return "pretrial"
    if status == "overdue":
        return "overdue"
    return "draft"


def _route_lane_from_status(status: str) -> str:
    if status == "court":
        return "court_lane"
    if status in {"fssp", "enforcement"}:
        return "enforcement_lane"
    if status == "closed":
        return "closed_lane"
    return "soft_lane"


def _risk_level(score: int) -> str:
    if score >= 85:
        return "critical"
    if score >= 65:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _load_cases_with_profiles(
    db: Session,
    tenant_id: int,
    *,
    include_archived: bool = False,
) -> tuple[list[Case], dict[int, DebtorProfile]]:
    query = db.query(Case).order_by(Case.id.desc())
    query = filter_cases_by_tenant(query, tenant_id, include_archived=include_archived)
    cases = query.all()

    case_ids = [item.id for item in cases]
    profiles_map: dict[int, DebtorProfile] = {}

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


def _build_routing_map(routing: dict[str, Any]) -> dict[int, dict[str, Any]]:
    buckets = dict(routing.get("buckets") or {})
    result: dict[int, dict[str, Any]] = {}

    for bucket_key in ["ready", "waiting", "blocked", "idle"]:
        for row in buckets.get(bucket_key) or []:
            case_id = row.get("case_id")
            if isinstance(case_id, int):
                result[case_id] = row

    return result


def _merge_signals(*groups: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()

    for group in groups:
        for item in group:
            value = str(item or "").strip()
            if not value or value in seen:
                continue
            seen.add(value)
            result.append(value)

    return result


def _safe_int(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def _safe_percent(value: float) -> int:
    return max(0, min(100, int(round(value))))


def _build_priority_mix(priority_items: list[dict[str, Any]]) -> dict[str, int]:
    mix = {
        "low": 0,
        "medium": 0,
        "high": 0,
        "critical": 0,
    }

    for item in priority_items:
        band = str(item.get("priority_band") or "").strip().lower()
        if band in mix:
            mix[band] += 1

    return mix


def _build_pressure_metrics(
    *,
    priority_items: list[dict[str, Any]],
    routing: dict[str, Any],
) -> dict[str, int]:
    total_cases = max(len(priority_items), 1)
    routing_summary = dict(routing.get("summary") or {})

    ready_cases = _safe_int(routing_summary.get("ready"))
    waiting_cases = _safe_int(routing_summary.get("waiting"))
    blocked_cases = _safe_int(routing_summary.get("blocked"))

    critical_cases = 0
    high_cases = 0
    blocked_high_risk_cases = 0
    waiting_high_priority_cases = 0
    ready_high_priority_cases = 0

    for item in priority_items:
        band = str(item.get("priority_band") or "").strip().lower()
        is_blocked = bool(item.get("is_blocked"))
        is_waiting = bool(item.get("is_waiting"))
        is_ready_now = bool(item.get("is_ready_now"))

        if band == "critical":
            critical_cases += 1
        if band in {"high", "critical"}:
            high_cases += 1
        if is_blocked and band in {"high", "critical"}:
            blocked_high_risk_cases += 1
        if is_waiting and band in {"high", "critical"}:
            waiting_high_priority_cases += 1
        if is_ready_now and band in {"high", "critical"}:
            ready_high_priority_cases += 1

    ready_pressure = (
        ready_cases * 8
        + ready_high_priority_cases * 12
        + critical_cases * 6
    )
    waiting_pressure = (
        waiting_cases * 8
        + waiting_high_priority_cases * 12
    )
    blocked_pressure = (
        blocked_cases * 10
        + blocked_high_risk_cases * 14
    )

    ready_pressure_score = _safe_percent((ready_pressure / total_cases) * 4)
    waiting_pressure_score = _safe_percent((waiting_pressure / total_cases) * 4)
    blocked_pressure_score = _safe_percent((blocked_pressure / total_cases) * 4)

    return {
        "ready_pressure": ready_pressure_score,
        "waiting_pressure": waiting_pressure_score,
        "blocked_pressure": blocked_pressure_score,
    }


def _build_portfolio_health_score(
    *,
    avg_priority_score: float,
    blocked_pressure: int,
    waiting_pressure: int,
    ready_pressure: int,
    critical_cases: int,
    total_cases: int,
) -> int:
    if total_cases <= 0:
        return 100

    critical_penalty = (critical_cases / total_cases) * 35
    blocked_penalty = blocked_pressure * 0.35
    waiting_penalty = waiting_pressure * 0.20
    avg_priority_penalty = avg_priority_score * 0.30
    ready_relief = ready_pressure * 0.15

    score = 100 - critical_penalty - blocked_penalty - waiting_penalty - avg_priority_penalty + ready_relief
    return _safe_percent(score)


def get_control_room_summary(
    db: Session,
    *,
    tenant_id: int,
    include_archived: bool = False,
) -> dict[str, Any]:
    cases, profiles_map = _load_cases_with_profiles(
        db,
        tenant_id,
        include_archived=include_archived,
    )

    total_amount = 0.0
    active_count = 0
    archived_count = 0
    blocked_count = 0
    overdue_now_count = 0

    buckets = {
        "draft": 0,
        "overdue": 0,
        "pretrial": 0,
        "court": 0,
        "fssp": 0,
        "closed": 0,
    }

    for case in cases:
        amount = _amount_to_float(case.principal_amount)
        total_amount += amount

        if bool(getattr(case, "is_archived", False)):
            archived_count += 1
        else:
            active_count += 1

        status = _status_bucket(_status_value(case.status))
        buckets[status] = buckets.get(status, 0) + 1

        profile = profiles_map.get(case.id)
        if _blocked_reason_flags(case, profile):
            blocked_count += 1

        if _is_overdue(case) and status not in {"closed", "fssp"}:
            overdue_now_count += 1

    avg_amount = total_amount / len(cases) if cases else 0.0

    return {
        "total_cases": len(cases),
        "active_cases": active_count,
        "archived_cases": archived_count,
        "draft_cases": buckets["draft"],
        "overdue_cases": buckets["overdue"],
        "pretrial_cases": buckets["pretrial"],
        "court_cases": buckets["court"],
        "fssp_cases": buckets["fssp"],
        "closed_cases": buckets["closed"],
        "blocked_cases": blocked_count,
        "overdue_now_cases": overdue_now_count,
        "total_principal_amount": _format_money(total_amount),
        "average_principal_amount": _format_money(avg_amount),
    }


def get_control_room_priority_cases(
    db: Session,
    *,
    tenant_id: int,
    limit: int = 10,
    include_archived: bool = False,
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

    items: list[dict[str, Any]] = []

    for case in cases:
        profile = profiles_map.get(case.id)
        routing_row = routing_map.get(case.id) or {}

        blocked_flags = _blocked_reason_flags(case, profile)
        routing_status = str(routing_row.get("routing_status") or "idle")
        route_lane = str(
            routing_row.get("route_lane") or _route_lane_from_status(_status_value(case.status))
        )
        waiting_reason = routing_row.get("waiting_reason")
        waiting_eligible_at = routing_row.get("waiting_eligible_at")
        routing_hint = routing_row.get("routing_hint")

        dashboard = build_case_dashboard(db, case.id)
        priority = build_case_priority_snapshot(
            case=case,
            dashboard=dashboard,
            routing_row=routing_row,
            blocked_reasons=blocked_flags,
        )

        inn, ogrn = _extract_debtor_identifiers(case, profile)

        blocked_reasons = _merge_signals(
            list(priority.get("decision_blockers") or []),
            [str(routing_hint)] if routing_status == "blocked" and routing_hint else [],
        )

        signals = _merge_signals(
            list(priority.get("decision_signals") or []),
            [str(waiting_reason)] if waiting_reason else [],
            ["overdue_now"] if _is_overdue(case) else [],
            ["high_amount"] if _amount_to_float(case.principal_amount) >= 500_000 else [],
        )

        is_waiting = bool(priority.get("waiting"))
        is_blocked = bool(priority.get("blocked"))
        is_court_lane = route_lane == "court_lane"
        is_enforcement_lane = route_lane == "enforcement_lane"
        is_ready_now = bool(priority.get("ready_now"))

        items.append(
            {
                "case_id": case.id,
                "debtor_name": case.debtor_name,
                "status": _status_value(case.status),
                "contract_type": _status_value(case.contract_type),
                "debtor_type": _status_value(case.debtor_type),
                "principal_amount": (
                    str(case.principal_amount) if case.principal_amount is not None else None
                ),
                "due_date": case.due_date.isoformat() if case.due_date else None,
                "risk_score": _safe_int(priority.get("priority_score")),
                "risk_level": str(priority.get("priority_band") or "low"),
                "priority_score": _safe_int(priority.get("priority_score")),
                "priority_band": str(priority.get("priority_band") or "low"),
                "priority_band_label": priority.get("priority_band_label"),
                "priority_reasons": list(priority.get("priority_reasons") or []),
                "operator_focus": priority.get("operator_focus"),
                "decision_positives": list(priority.get("decision_positives") or []),
                "decision_blockers": list(priority.get("decision_blockers") or []),
                "decision_signals": list(priority.get("decision_signals") or []),
                "signals": signals,
                "routing_bucket": (
                    route_lane if route_lane in {"court_lane", "enforcement_lane"} else routing_status
                ),
                "routing_status": routing_status,
                "routing_hint": routing_hint,
                "route_lane": route_lane,
                "waiting_reason": waiting_reason,
                "waiting_eligible_at": waiting_eligible_at,
                "recommended_action": priority.get("operator_focus"),
                "blocked": is_blocked,
                "blocked_reasons": blocked_reasons,
                "is_blocked": is_blocked,
                "is_waiting": is_waiting,
                "is_ready_now": is_ready_now,
                "is_court_lane": is_court_lane,
                "is_enforcement_lane": is_enforcement_lane,
                "inn": inn,
                "ogrn": ogrn,
                "is_archived": bool(getattr(case, "is_archived", False)),
            }
        )

    items.sort(
        key=lambda item: (
            -_safe_int(item["priority_score"]),
            -_amount_to_float(item.get("principal_amount")),
            item["case_id"],
        )
    )

    return {
        "items": items[:limit],
        "total": len(items),
    }


def get_control_room_waiting_preview(
    db: Session,
    *,
    tenant_id: int,
    limit: int = 10,
) -> dict[str, Any]:
    result = list_waiting_buckets(
        db,
        tenant_id=tenant_id,
        status="waiting",
        bucket_code=None,
        step_code=None,
        limit=limit,
    )

    items = list(result.get("items") or [])
    case_ids = [int(item["case_id"]) for item in items if item.get("case_id")]

    case_map: dict[int, Case] = {}
    if case_ids:
        rows = (
            db.query(Case)
            .filter(
                Case.tenant_id == tenant_id,
                Case.id.in_(case_ids),
            )
            .all()
        )
        case_map = {row.id: row for row in rows}

    enriched_items: list[dict[str, Any]] = []
    for item in items:
        case_id = int(item["case_id"])
        case = case_map.get(case_id)

        enriched_items.append(
            {
                **item,
                "reason": item.get("reason_text") or item.get("reason"),
                "debtor_name": case.debtor_name if case else None,
                "contract_type": _status_value(case.contract_type) if case else None,
                "status": _status_value(case.status) if case else None,
                "principal_amount": (
                    str(case.principal_amount)
                    if case and case.principal_amount is not None
                    else None
                ),
                "route_lane": _route_lane_from_status(_status_value(case.status)) if case else None,
                "is_archived": bool(getattr(case, "is_archived", False)) if case else False,
            }
        )

    return {
        "items": enriched_items,
        "count": len(enriched_items),
    }


def get_control_room_execution_console(
    db: Session,
    *,
    tenant_id: int,
    limit: int = 20,
) -> dict[str, Any]:
    batch_jobs = (
        db.query(BatchJob)
        .filter(BatchJob.tenant_id == tenant_id)
        .order_by(BatchJob.id.desc())
        .limit(limit)
        .all()
    )

    batch_items: list[dict[str, Any]] = []
    batch_metrics = {
        "total": 0,
        "draft": 0,
        "running": 0,
        "completed": 0,
        "failed": 0,
    }

    for job in batch_jobs:
        status = str(job.status or "draft")
        batch_metrics["total"] += 1
        if status in batch_metrics:
            batch_metrics[status] += 1

        summary = dict(job.summary or {})

        batch_items.append(
            {
                "id": job.id,
                "title": job.title or f"Batch job #{job.id}",
                "job_type": job.job_type,
                "status": status,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "finished_at": job.finished_at.isoformat() if job.finished_at else None,
                "summary": summary,
                "success": int(summary.get("success", 0)),
                "blocked": int(summary.get("blocked", 0)),
                "waiting": int(summary.get("waiting", 0)),
                "errors": int(summary.get("error", 0) or summary.get("errors", 0)),
                "not_applicable": int(summary.get("not_applicable", 0)),
                "already_processed": int(summary.get("already_processed", 0)),
            }
        )

    automation_runs = (
        db.query(AutomationRun)
        .filter(AutomationRun.tenant_id == tenant_id)
        .order_by(AutomationRun.id.desc())
        .limit(limit)
        .all()
    )

    automation_metrics = {
        "total": 0,
        "draft": 0,
        "running": 0,
        "completed": 0,
        "failed": 0,
    }

    for run in automation_runs:
        status = str(getattr(run, "status", None) or "draft")
        automation_metrics["total"] += 1
        if status in automation_metrics:
            automation_metrics[status] += 1

    return {
        "batch_jobs": batch_items,
        "batch_metrics": batch_metrics,
        "automation_metrics": automation_metrics,
    }


def _build_intelligence_kpi(
    priority_items: list[dict[str, Any]],
    routing: dict[str, Any],
) -> dict[str, Any]:
    lane_summary = dict(routing.get("lane_summary") or {})
    counter = Counter()

    total_cases = len(priority_items)
    total_priority_score = 0

    for item in priority_items:
        priority_score = _safe_int(item.get("priority_score"))
        total_priority_score += priority_score

        if item.get("priority_band") in {"high", "critical"}:
            counter["high_risk_cases"] += 1
        if item.get("priority_band") == "critical":
            counter["critical_cases"] += 1
        if item.get("blocked") and item.get("priority_band") in {"high", "critical"}:
            counter["blocked_high_risk_cases"] += 1
        if item.get("is_ready_now"):
            counter["ready_now_cases"] += 1
        if item.get("is_waiting"):
            counter["waiting_cases"] += 1
        if item.get("is_blocked"):
            counter["blocked_cases"] += 1

    avg_priority_score = round(total_priority_score / total_cases, 1) if total_cases else 0.0
    avg_risk_score = avg_priority_score

    priority_mix = _build_priority_mix(priority_items)

    pressure = _build_pressure_metrics(
        priority_items=priority_items,
        routing=routing,
    )

    portfolio_health_score = _build_portfolio_health_score(
        avg_priority_score=avg_priority_score,
        blocked_pressure=pressure["blocked_pressure"],
        waiting_pressure=pressure["waiting_pressure"],
        ready_pressure=pressure["ready_pressure"],
        critical_cases=counter["critical_cases"],
        total_cases=total_cases,
    )

    return {
        "high_risk_cases": counter["high_risk_cases"],
        "critical_cases": counter["critical_cases"],
        "blocked_high_risk_cases": counter["blocked_high_risk_cases"],
        "ready_now_cases": counter["ready_now_cases"],
        "waiting_cases": counter["waiting_cases"],
        "blocked_cases": counter["blocked_cases"],
        "soft_lane_cases": lane_summary.get("soft_lane", 0),
        "court_lane_cases": lane_summary.get("court_lane", 0),
        "enforcement_lane_cases": lane_summary.get("enforcement_lane", 0),
        "avg_risk_score": avg_risk_score,
        "avg_priority_score": avg_priority_score,
        "priority_mix": priority_mix,
        "ready_pressure": pressure["ready_pressure"],
        "waiting_pressure": pressure["waiting_pressure"],
        "blocked_pressure": pressure["blocked_pressure"],
        "portfolio_health_score": portfolio_health_score,
    }


def get_control_room_dashboard(
    db: Session,
    *,
    tenant_id: int,
    include_archived: bool = False,
) -> dict[str, Any]:
    query = db.query(Case).order_by(Case.id.desc())
    query = filter_cases_by_tenant(query, tenant_id, include_archived=include_archived)
    cases = query.all()

    summary = get_control_room_summary(
        db,
        tenant_id=tenant_id,
        include_archived=include_archived,
    )

    routing = build_portfolio_routing(
        db,
        tenant_id=tenant_id,
        cases=cases,
    )

    waiting_preview = get_control_room_waiting_preview(
        db,
        tenant_id=tenant_id,
        limit=10,
    )

    execution = get_control_room_execution_console(
        db,
        tenant_id=tenant_id,
        limit=20,
    )

    all_priority_cases = get_control_room_priority_cases(
        db,
        tenant_id=tenant_id,
        limit=max(len(cases), 10),
        include_archived=include_archived,
    )

    priority_cases = {
        "items": list(all_priority_cases["items"][:10]),
        "total": all_priority_cases["total"],
    }

    focus_queues = get_control_room_focus_queues(
        db,
        tenant_id=tenant_id,
        include_archived=include_archived,
        per_queue_limit=5,
    )

    intelligence_kpi = _build_intelligence_kpi(
        all_priority_cases["items"],
        routing,
    )

    return {
        "summary": summary,
        "routing": routing,
        "waiting_preview": waiting_preview,
        "execution": execution,
        "priority_cases": priority_cases,
        "focus_queues": focus_queues,
        "intelligence_kpi": intelligence_kpi,
    }


def get_case_control_room_card(
    db: Session,
    *,
    case_id: int,
) -> dict[str, Any]:
    dashboard = build_case_dashboard(db, case_id)
    return dashboard