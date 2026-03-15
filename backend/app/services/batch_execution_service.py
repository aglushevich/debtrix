from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.events import CaseEvent, CaseEventType, emit_event
from backend.app.models import (
    AutomationRule,
    BatchJob,
    BatchJobItem,
    Case,
)
from backend.app.services.automation_engine_service import start_automation_run_for_cases
from backend.app.services.tenant_query_service import current_tenant_id


def _utcnow() -> datetime:
    return datetime.utcnow()


def _dump(value: dict[str, Any] | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def _load(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return parsed
        return {}
    except Exception:
        return {}


def _serialize_batch_job(item: BatchJob) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "rule_id": item.rule_id,
        "rule_code": item.rule_code,
        "title": item.title,
        "job_type": item.job_type,
        "trigger_type": item.trigger_type,
        "status": item.status,
        "total_items": item.total_items,
        "queued_items": item.queued_items,
        "success_items": item.success_items,
        "failed_items": item.failed_items,
        "blocked_items": item.blocked_items,
        "waiting_items": item.waiting_items,
        "not_applicable_items": item.not_applicable_items,
        "requested_by": item.requested_by,
        "correlation_id": item.correlation_id,
        "selection": _load(item.selection_json),
        "filters": _load(item.filters_json),
        "result": _load(item.result_json),
        "started_at": item.started_at.isoformat() if item.started_at else None,
        "finished_at": item.finished_at.isoformat() if item.finished_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _serialize_batch_job_item(item: BatchJobItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "batch_job_id": item.batch_job_id,
        "case_id": item.case_id,
        "automation_run_id": item.automation_run_id,
        "automation_run_item_id": item.automation_run_item_id,
        "status": item.status,
        "bucket": item.bucket,
        "reason_code": item.reason_code,
        "reason_text": item.reason_text,
        "action_code": item.action_code,
        "eligible_at": item.eligible_at.isoformat() if item.eligible_at else None,
        "execution_started_at": (
            item.execution_started_at.isoformat() if item.execution_started_at else None
        ),
        "execution_finished_at": (
            item.execution_finished_at.isoformat() if item.execution_finished_at else None
        ),
        "result": _load(item.result_json),
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _map_item_bucket(status: str) -> str:
    if status in {"done", "failed", "blocked", "waiting", "not_applicable", "queued"}:
        return status
    return "failed"


def _get_rule_or_404(
    db: Session,
    *,
    rule_id: int,
    tenant_id: int,
) -> AutomationRule:
    item = (
        db.query(AutomationRule)
        .filter(
            AutomationRule.id == rule_id,
            AutomationRule.tenant_id == tenant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    return item


def _get_batch_job_or_404(
    db: Session,
    *,
    batch_job_id: int,
    tenant_id: int,
) -> BatchJob:
    item = (
        db.query(BatchJob)
        .filter(
            BatchJob.id == batch_job_id,
            BatchJob.tenant_id == tenant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Batch job not found")
    return item


def list_batch_jobs(
    db: Session,
    *,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    items = (
        db.query(BatchJob)
        .filter(BatchJob.tenant_id == tenant_id)
        .order_by(BatchJob.id.desc())
        .limit(100)
        .all()
    )

    return {
        "items": [_serialize_batch_job(item) for item in items],
    }


def get_batch_job_detail(
    db: Session,
    *,
    batch_job_id: int,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    job = _get_batch_job_or_404(
        db,
        batch_job_id=batch_job_id,
        tenant_id=tenant_id,
    )

    items = (
        db.query(BatchJobItem)
        .filter(
            BatchJobItem.batch_job_id == job.id,
            BatchJobItem.tenant_id == tenant_id,
        )
        .order_by(BatchJobItem.id.asc())
        .all()
    )

    return {
        "job": _serialize_batch_job(job),
        "items": [_serialize_batch_job_item(item) for item in items],
    }


def get_portfolio_waiting_bucket(
    db: Session,
    *,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    items = (
        db.query(BatchJobItem)
        .filter(
            BatchJobItem.tenant_id == tenant_id,
            BatchJobItem.bucket == "waiting",
        )
        .order_by(BatchJobItem.eligible_at.asc(), BatchJobItem.id.asc())
        .all()
    )

    return {
        "count": len(items),
        "items": [_serialize_batch_job_item(item) for item in items],
    }


def start_batch_job(
    db: Session,
    *,
    rule_id: int,
    case_ids: list[int],
    tenant_id: int | None = None,
    requested_by: str | None = None,
    title: str | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    if not case_ids:
        raise HTTPException(status_code=422, detail="case_ids is required")

    rule = _get_rule_or_404(
        db,
        rule_id=rule_id,
        tenant_id=tenant_id,
    )

    if not rule.is_enabled:
        raise HTTPException(status_code=409, detail="Automation rule is disabled")

    cases = (
        db.query(Case)
        .filter(
            Case.tenant_id == tenant_id,
            Case.id.in_(case_ids),
        )
        .order_by(Case.id.asc())
        .all()
    )

    found_ids = {case.id for case in cases}
    missing_ids = [case_id for case_id in case_ids if case_id not in found_ids]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Cases not found for tenant: {missing_ids}",
        )

    now = _utcnow()
    correlation_id = f"batch-{rule.code}-{int(now.timestamp())}"

    job = BatchJob(
        tenant_id=tenant_id,
        rule_id=rule.id,
        rule_code=rule.code,
        title=title or rule.title,
        job_type="portfolio_action",
        trigger_type="manual",
        status="running",
        total_items=0,
        queued_items=0,
        success_items=0,
        failed_items=0,
        blocked_items=0,
        waiting_items=0,
        not_applicable_items=0,
        requested_by=requested_by,
        correlation_id=correlation_id,
        selection_json=_dump({"case_ids": case_ids}),
        filters_json=_dump({}),
        result_json=_dump({}),
        started_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.flush()
    db.refresh(job)

    if case_ids:
        emit_event(
            db,
            CaseEvent(
                case_id=case_ids[0],
                type=CaseEventType.BATCH_JOB_STARTED,
                title=f"Batch job started: {job.title}",
                details="Запущено массовое выполнение по портфелю дел.",
                payload={
                    "batch_job_id": job.id,
                    "rule_code": rule.code,
                    "cases_count": len(case_ids),
                },
            ),
        )

    run_detail = start_automation_run_for_cases(
        db,
        rule_id=rule.id,
        case_ids=case_ids,
        tenant_id=tenant_id,
        requested_by=requested_by,
    )

    run = run_detail["run"]
    run_items = run_detail["items"]

    batch_items: list[BatchJobItem] = []

    for run_item in run_items:
        batch_item = BatchJobItem(
            tenant_id=tenant_id,
            batch_job_id=job.id,
            case_id=run_item["case_id"],
            automation_run_id=run["id"],
            automation_run_item_id=run_item["id"],
            status=run_item["status"],
            bucket=_map_item_bucket(run_item["status"]),
            reason_code=run_item.get("reason_code"),
            reason_text=run_item.get("reason_text"),
            action_code=run_item.get("action_code"),
            eligible_at=(
                datetime.fromisoformat(run_item["eligible_at"])
                if run_item.get("eligible_at")
                else None
            ),
            execution_started_at=(
                datetime.fromisoformat(run_item["execution_started_at"])
                if run_item.get("execution_started_at")
                else None
            ),
            execution_finished_at=(
                datetime.fromisoformat(run_item["execution_finished_at"])
                if run_item.get("execution_finished_at")
                else None
            ),
            result_json=_dump(run_item.get("result") or {}),
            created_at=now,
            updated_at=now,
        )
        db.add(batch_item)
        db.flush()
        db.refresh(batch_item)
        batch_items.append(batch_item)

        if batch_item.bucket == "done":
            emit_event(
                db,
                CaseEvent(
                    case_id=batch_item.case_id,
                    type=CaseEventType.BATCH_ITEM_DONE,
                    title=f"Batch item done: {job.title}",
                    details="Массовое действие выполнено по делу.",
                    payload={
                        "batch_job_id": job.id,
                        "automation_run_id": run["id"],
                        "rule_code": rule.code,
                    },
                ),
            )
        elif batch_item.bucket == "blocked":
            emit_event(
                db,
                CaseEvent(
                    case_id=batch_item.case_id,
                    type=CaseEventType.BATCH_ITEM_BLOCKED,
                    title=f"Batch item blocked: {job.title}",
                    details=batch_item.reason_text or "Дело заблокировано для batch execution.",
                    payload={
                        "batch_job_id": job.id,
                        "reason_code": batch_item.reason_code,
                        "rule_code": rule.code,
                    },
                ),
            )
        elif batch_item.bucket == "waiting":
            emit_event(
                db,
                CaseEvent(
                    case_id=batch_item.case_id,
                    type=CaseEventType.BATCH_ITEM_WAITING,
                    title=f"Batch item waiting: {job.title}",
                    details=batch_item.reason_text or "Дело ожидает eligibility window.",
                    payload={
                        "batch_job_id": job.id,
                        "reason_code": batch_item.reason_code,
                        "rule_code": rule.code,
                        "eligible_at": (
                            batch_item.eligible_at.isoformat()
                            if batch_item.eligible_at
                            else None
                        ),
                    },
                ),
            )
        elif batch_item.bucket == "not_applicable":
            emit_event(
                db,
                CaseEvent(
                    case_id=batch_item.case_id,
                    type=CaseEventType.BATCH_ITEM_NOT_APPLICABLE,
                    title=f"Batch item not applicable: {job.title}",
                    details=batch_item.reason_text or "Массовое действие неприменимо к делу.",
                    payload={
                        "batch_job_id": job.id,
                        "reason_code": batch_item.reason_code,
                        "rule_code": rule.code,
                    },
                ),
            )
        elif batch_item.bucket == "failed":
            emit_event(
                db,
                CaseEvent(
                    case_id=batch_item.case_id,
                    type=CaseEventType.BATCH_ITEM_FAILED,
                    title=f"Batch item failed: {job.title}",
                    details=batch_item.reason_text or "Ошибка выполнения массового действия.",
                    payload={
                        "batch_job_id": job.id,
                        "reason_code": batch_item.reason_code,
                        "rule_code": rule.code,
                    },
                ),
            )

    job.total_items = len(batch_items)
    job.queued_items = sum(1 for item in batch_items if item.bucket == "queued")
    job.success_items = sum(1 for item in batch_items if item.bucket == "done")
    job.failed_items = sum(1 for item in batch_items if item.bucket == "failed")
    job.blocked_items = sum(1 for item in batch_items if item.bucket == "blocked")
    job.waiting_items = sum(1 for item in batch_items if item.bucket == "waiting")
    job.not_applicable_items = sum(
        1 for item in batch_items if item.bucket == "not_applicable"
    )

    job.status = "finished" if job.queued_items == 0 else "running"
    job.finished_at = _utcnow()
    job.result_json = _dump(
        {
            "automation_run_id": run["id"],
            "summary": {
                "total_items": job.total_items,
                "queued_items": job.queued_items,
                "success_items": job.success_items,
                "failed_items": job.failed_items,
                "blocked_items": job.blocked_items,
                "waiting_items": job.waiting_items,
                "not_applicable_items": job.not_applicable_items,
            },
        }
    )

    db.add(job)
    db.flush()
    db.refresh(job)

    if case_ids:
        emit_event(
            db,
            CaseEvent(
                case_id=case_ids[0],
                type=CaseEventType.BATCH_JOB_FINISHED,
                title=f"Batch job finished: {job.title}",
                details="Массовое выполнение завершено.",
                payload={
                    "batch_job_id": job.id,
                    "rule_code": rule.code,
                    "success_items": job.success_items,
                    "failed_items": job.failed_items,
                    "blocked_items": job.blocked_items,
                    "waiting_items": job.waiting_items,
                    "not_applicable_items": job.not_applicable_items,
                },
            ),
        )

    return get_batch_job_detail(
        db,
        batch_job_id=job.id,
        tenant_id=tenant_id,
    )