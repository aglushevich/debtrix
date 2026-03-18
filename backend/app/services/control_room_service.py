from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models.automation_run import AutomationRun
from backend.app.models.batch_job import BatchJob
from backend.app.models.case import Case
from backend.app.models.debtor_profile import DebtorProfile
from backend.app.services.case_dashboard_service import build_case_dashboard
from backend.app.services.portfolio_routing_service import build_portfolio_routing
from backend.app.services.tenant_query_service import filter_cases_by_tenant
from backend.app.services.waiting_bucket_service import list_waiting_buckets


def _status_value(value: Any) -> str:
    return getattr(value, "value", value) if value is not None else ""


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
    if status in {"closed"}:
        return "closed"
    if status in {"court"}:
        return "court"
    if status in {"fssp", "enforcement"}:
        return "fssp"
    if status in {"pretrial"}:
        return "pretrial"
    if status in {"overdue"}:
        return "overdue"
    return "draft"


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

    items: list[dict[str, Any]] = []

    for case in cases:
        profile = profiles_map.get(case.id)
        risk_score = _risk_score(case, profile)
        blocked_flags = _blocked_reason_flags(case, profile)
        inn, ogrn = _extract_debtor_identifiers(case, profile)

        items.append(
            {
                "case_id": case.id,
                "debtor_name": case.debtor_name,
                "status": _status_value(case.status),
                "contract_type": _status_value(case.contract_type),
                "debtor_type": _status_value(case.debtor_type),
                "principal_amount": str(case.principal_amount) if case.principal_amount is not None else None,
                "due_date": case.due_date.isoformat() if case.due_date else None,
                "risk_score": risk_score,
                "risk_level": _risk_level(risk_score),
                "blocked": len(blocked_flags) > 0,
                "blocked_reasons": blocked_flags,
                "inn": inn,
                "ogrn": ogrn,
                "is_archived": bool(getattr(case, "is_archived", False)),
            }
        )

    items.sort(
        key=lambda item: (
            -int(item["risk_score"]),
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
    return result


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

    priority_cases = get_control_room_priority_cases(
        db,
        tenant_id=tenant_id,
        limit=10,
        include_archived=include_archived,
    )

    intelligence_kpi = {
        "high_risk_cases": len(
            [item for item in priority_cases["items"] if item["risk_level"] in {"high", "critical"}]
        ),
        "critical_cases": len(
            [item for item in priority_cases["items"] if item["risk_level"] == "critical"]
        ),
        "blocked_high_risk_cases": len(
            [
                item
                for item in priority_cases["items"]
                if item["blocked"] and item["risk_level"] in {"high", "critical"}
            ]
        ),
    }

    return {
        "summary": summary,
        "routing": routing,
        "waiting_preview": waiting_preview,
        "execution": execution,
        "priority_cases": priority_cases,
        "intelligence_kpi": intelligence_kpi,
    }


def get_case_control_room_card(
    db: Session,
    *,
    case_id: int,
) -> dict[str, Any]:
    dashboard = build_case_dashboard(db, case_id)
    return dashboard