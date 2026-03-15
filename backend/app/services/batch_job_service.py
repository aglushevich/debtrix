from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.events import CaseEvent, CaseEventType, emit_event
from backend.app.models import Case
from backend.app.models.batch_job import BatchJob
from backend.app.models.batch_job_item import BatchJobItem
from backend.app.services.automation_engine_service import execute_automation_run, get_automation_run_or_404
from backend.app.services.automation_rule_service import get_automation_rule_or_404
from backend.app.services.portfolio_query_service import resolve_case_ids_for_portfolio
from backend.app.services.portfolio_view_service import get_portfolio_view_or_404


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _serialize_batch_job(item: BatchJob) -> dict:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "job_type": item.job_type,
        "title": item.title,
        "description": item.description,
        "status": item.status,
        "rule_id": item.rule_id,
        "selection_snapshot": item.selection_snapshot or {},
        "execution_params": item.execution_params or {},
        "summary": item.summary or {},
        "result": item.result or {},
        "error_message": item.error_message,
        "started_at": item.started_at.isoformat() if item.started_at else None,
        "finished_at": item.finished_at.isoformat() if item.finished_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _serialize_batch_job_item(item: BatchJobItem) -> dict:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "batch_job_id": item.batch_job_id,
        "case_id": item.case_id,
        "automation_run_id": item.automation_run_id,
        "external_action_id": item.external_action_id,
        "status": item.status,
        "bucket_code": item.bucket_code,
        "reason_code": item.reason_code,
        "reason_text": item.reason_text,
        "eligible_at": item.eligible_at.isoformat() if item.eligible_at else None,
        "item_payload": item.item_payload or {},
        "result": item.result or {},
        "error_message": item.error_message,
        "started_at": item.started_at.isoformat() if item.started_at else None,
        "finished_at": item.finished_at.isoformat() if item.finished_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def get_batch_job_or_404(
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
    tenant_id: int,
    status: str | None = None,
    job_type: str | None = None,
) -> dict:
    query = (
        db.query(BatchJob)
        .filter(BatchJob.tenant_id == tenant_id)
        .order_by(BatchJob.id.desc())
    )

    if status:
        query = query.filter(BatchJob.status == status)
    if job_type:
        query = query.filter(BatchJob.job_type == job_type)

    items = query.all()
    return {"items": [_serialize_batch_job(item) for item in items]}


def list_batch_job_items(
    db: Session,
    *,
    batch_job_id: int,
    tenant_id: int,
    status: str | None = None,
    bucket_code: str | None = None,
) -> dict:
    _ = get_batch_job_or_404(db, batch_job_id=batch_job_id, tenant_id=tenant_id)

    query = (
        db.query(BatchJobItem)
        .filter(
            BatchJobItem.batch_job_id == batch_job_id,
            BatchJobItem.tenant_id == tenant_id,
        )
        .order_by(BatchJobItem.id.asc())
    )

    if status:
        query = query.filter(BatchJobItem.status == status)
    if bucket_code:
        query = query.filter(BatchJobItem.bucket_code == bucket_code)

    items = query.all()
    return {"items": [_serialize_batch_job_item(item) for item in items]}


def _calc_batch_summary(items: list[BatchJobItem]) -> dict:
    counts_by_status: dict[str, int] = {}
    counts_by_bucket: dict[str, int] = {}
    next_eligible_at = None

    for item in items:
        counts_by_status[item.status] = counts_by_status.get(item.status, 0) + 1
        bucket = item.bucket_code or "unknown"
        counts_by_bucket[bucket] = counts_by_bucket.get(bucket, 0) + 1

        if item.eligible_at:
            if next_eligible_at is None or item.eligible_at < next_eligible_at:
                next_eligible_at = item.eligible_at

    return {
        "total_items": len(items),
        "counts_by_status": counts_by_status,
        "counts_by_bucket": counts_by_bucket,
        "next_eligible_at": next_eligible_at.isoformat() if next_eligible_at else None,
    }


def rebuild_batch_job_summary(
    db: Session,
    *,
    batch_job_id: int,
    tenant_id: int,
) -> dict:
    job = get_batch_job_or_404(db, batch_job_id=batch_job_id, tenant_id=tenant_id)

    items = (
        db.query(BatchJobItem)
        .filter(
            BatchJobItem.batch_job_id == batch_job_id,
            BatchJobItem.tenant_id == tenant_id,
        )
        .order_by(BatchJobItem.id.asc())
        .all()
    )

    summary = _calc_batch_summary(items)
    job.summary = summary
    job.updated_at = _utcnow()

    statuses = {item.status for item in items}
    if "running" in statuses:
        job.status = "running"
    elif "failed" in statuses and len(statuses) == 1:
        job.status = "failed"
    elif statuses and statuses.issubset({"succeeded", "failed", "blocked", "waiting", "skipped"}):
        job.status = "completed"

    db.add(job)
    db.flush()
    db.refresh(job)

    return {"ok": True, "job": _serialize_batch_job(job)}


def create_batch_job(
    db: Session,
    *,
    tenant_id: int,
    payload: dict,
) -> dict:
    rule_id = int(payload["rule_id"])
    case_ids = list(dict.fromkeys([int(case_id) for case_id in (payload.get("case_ids") or [])]))

    if not case_ids:
        raise HTTPException(status_code=422, detail="case_ids must not be empty")

    rule = get_automation_rule_or_404(db, rule_id=rule_id, tenant_id=tenant_id)

    cases = (
        db.query(Case)
        .filter(
            Case.tenant_id == tenant_id,
            Case.id.in_(case_ids),
        )
        .order_by(Case.id.asc())
        .all()
    )
    found_case_ids = [case.id for case in cases]
    missing_case_ids = [case_id for case_id in case_ids if case_id not in found_case_ids]
    if missing_case_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Cases not found for tenant: {missing_case_ids}",
        )

    now = _utcnow()
    job = BatchJob(
        tenant_id=tenant_id,
        job_type=payload["job_type"],
        title=str(payload["title"]).strip(),
        description=payload.get("description"),
        status="queued",
        rule_id=rule.id,
        selection_snapshot={
            "case_ids": case_ids,
            "total_cases": len(case_ids),
            "rule": {
                "id": rule.id,
                "name": rule.name,
                "action_code": rule.action_code,
                "execution_mode": rule.execution_mode,
            },
        },
        execution_params=dict(payload.get("execution_params") or {}),
        summary={},
        result={},
        error_message=None,
        started_at=None,
        finished_at=None,
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.flush()
    db.refresh(job)

    for case in cases:
        item = BatchJobItem(
            tenant_id=tenant_id,
            batch_job_id=job.id,
            case_id=case.id,
            automation_run_id=None,
            external_action_id=None,
            status="pending",
            bucket_code="pending",
            reason_code=None,
            reason_text=None,
            eligible_at=None,
            item_payload={
                "case_snapshot": {
                    "id": case.id,
                    "status": getattr(case.status, "value", str(case.status)),
                    "contract_type": getattr(case.contract_type, "value", str(case.contract_type)),
                    "debtor_type": getattr(case.debtor_type, "value", str(case.debtor_type)),
                    "principal_amount": str(case.principal_amount),
                    "due_date": case.due_date.isoformat() if case.due_date else None,
                }
            },
            result={},
            error_message=None,
            started_at=None,
            finished_at=None,
            created_at=now,
            updated_at=now,
        )
        db.add(item)

    db.flush()

    items = (
        db.query(BatchJobItem)
        .filter(
            BatchJobItem.batch_job_id == job.id,
            BatchJobItem.tenant_id == tenant_id,
        )
        .order_by(BatchJobItem.id.asc())
        .all()
    )
    job.summary = _calc_batch_summary(items)
    db.add(job)
    db.flush()
    db.refresh(job)

    return {
        "ok": True,
        "job": _serialize_batch_job(job),
        "items": [_serialize_batch_job_item(item) for item in items],
    }


def execute_batch_job(
    db: Session,
    *,
    batch_job_id: int,
    tenant_id: int,
    force: bool = False,
) -> dict:
    from backend.app.services.automation_engine_service import evaluate_case_automation_rules

    job = get_batch_job_or_404(db, batch_job_id=batch_job_id, tenant_id=tenant_id)
    rule = get_automation_rule_or_404(db, rule_id=int(job.rule_id), tenant_id=tenant_id)

    if job.status not in {"queued", "running", "completed"} and not force:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot execute batch job in status={job.status}",
        )

    now = _utcnow()
    job.status = "running"
    job.started_at = job.started_at or now
    job.updated_at = now
    job.error_message = None
    db.add(job)
    db.flush()

    items = (
        db.query(BatchJobItem)
        .filter(
            BatchJobItem.batch_job_id == batch_job_id,
            BatchJobItem.tenant_id == tenant_id,
        )
        .order_by(BatchJobItem.id.asc())
        .all()
    )

    for item in items:
        item.started_at = item.started_at or _utcnow()
        item.updated_at = _utcnow()
        item.status = "running"
        item.bucket_code = "running"
        db.add(item)
        db.flush()

        try:
            evaluation_result = evaluate_case_automation_rules(
                db,
                tenant_id=tenant_id,
                case_id=item.case_id,
                execute=False,
            )

            matched_run = None
            for run in reversed(evaluation_result.get("runs") or []):
                if run.get("rule_id") == rule.id or run.get("evaluation_payload", {}).get("rule", {}).get("id") == rule.id:
                    matched_run = run
                    break

            if not matched_run:
                item.status = "skipped"
                item.bucket_code = "skipped"
                item.reason_code = "rule_run_not_created"
                item.reason_text = "Automation run for rule was not created"
                item.result = {"evaluation": evaluation_result}
                item.finished_at = _utcnow()
                item.updated_at = _utcnow()
                db.add(item)
                db.flush()
                continue

            run_id = matched_run.get("id")
            item.automation_run_id = run_id
            item.result = {"evaluation": evaluation_result}

            run_row = get_automation_run_or_404(
                db,
                run_id=run_id,
                tenant_id=tenant_id,
            )

            if run_row.status == "waiting":
                item.status = "waiting"
                item.bucket_code = "waiting"
                item.reason_code = run_row.eligibility_code
                item.reason_text = run_row.eligibility_reason
                item.eligible_at = run_row.eligible_at
                item.finished_at = _utcnow()
                item.updated_at = _utcnow()
                db.add(item)
                db.flush()
                continue

            if run_row.status == "blocked":
                item.status = "blocked"
                item.bucket_code = "blocked"
                item.reason_code = run_row.eligibility_code
                item.reason_text = run_row.eligibility_reason
                item.finished_at = _utcnow()
                item.updated_at = _utcnow()
                db.add(item)
                db.flush()
                continue

            execute_result = execute_automation_run(
                db,
                run_id=run_row.id,
                tenant_id=tenant_id,
                force=force,
            )

            final_run = execute_result["run"]
            item.automation_run_id = final_run.get("id")
            item.external_action_id = final_run.get("external_action_id")

            if final_run.get("status") == "succeeded":
                item.status = "succeeded"
                item.bucket_code = "succeeded"
            elif final_run.get("status") == "waiting":
                item.status = "waiting"
                item.bucket_code = "waiting"
            elif final_run.get("status") == "blocked":
                item.status = "blocked"
                item.bucket_code = "blocked"
            else:
                item.status = "failed"
                item.bucket_code = "failed"

            item.reason_code = final_run.get("eligibility_code")
            item.reason_text = final_run.get("eligibility_reason")
            item.result = {
                **(item.result or {}),
                "execution": execute_result,
            }
            item.finished_at = _utcnow()
            item.updated_at = _utcnow()
            db.add(item)
            db.flush()

        except Exception as exc:
            item.status = "failed"
            item.bucket_code = "failed"
            item.error_message = str(exc)
            item.reason_code = "execution_error"
            item.reason_text = str(exc)
            item.finished_at = _utcnow()
            item.updated_at = _utcnow()
            db.add(item)
            db.flush()

    items = (
        db.query(BatchJobItem)
        .filter(
            BatchJobItem.batch_job_id == batch_job_id,
            BatchJobItem.tenant_id == tenant_id,
        )
        .order_by(BatchJobItem.id.asc())
        .all()
    )

    summary = _calc_batch_summary(items)
    job.summary = summary
    job.result = {"last_execution_at": _utcnow().isoformat()}
    job.status = "completed"
    job.finished_at = _utcnow()
    job.updated_at = _utcnow()
    db.add(job)
    db.flush()
    db.refresh(job)

    first_case_id = items[0].case_id if items else None
    if first_case_id:
        emit_event(
            db,
            CaseEvent(
                case_id=first_case_id,
                type=CaseEventType.CASE_UPDATED,
                title=f"Batch job выполнен: {job.title}",
                details=f"Batch job #{job.id} finished with status={job.status}",
                payload={
                    "batch_job_id": job.id,
                    "job_type": job.job_type,
                    "summary": job.summary,
                },
            ),
        )

    return {
        "ok": True,
        "job": _serialize_batch_job(job),
        "items": [_serialize_batch_job_item(item) for item in items],
    }


def create_batch_job_from_portfolio_view(
    db: Session,
    *,
    tenant_id: int,
    view_id: int,
    payload: dict,
) -> dict:
    view = get_portfolio_view_or_404(
        db,
        view_id=view_id,
        tenant_id=tenant_id,
    )

    sorting = dict(view.sorting or {})
    order_by = sorting.get("order_by") or "id_desc"

    case_ids = resolve_case_ids_for_portfolio(
        db,
        tenant_id=tenant_id,
        filters=dict(view.filters or {}),
        order_by=order_by,
        limit=int(payload.get("limit") or 1000),
    )

    if not case_ids:
        raise HTTPException(
            status_code=422,
            detail="Portfolio view resolved to empty case set",
        )

    return create_batch_job(
        db,
        tenant_id=tenant_id,
        payload={
            "title": payload["title"],
            "description": payload.get("description"),
            "job_type": payload["job_type"],
            "rule_id": payload["rule_id"],
            "case_ids": case_ids,
            "execution_params": {
                **dict(payload.get("execution_params") or {}),
                "source": {
                    "type": "portfolio_view",
                    "view_id": view.id,
                    "view_name": view.name,
                },
            },
        },
    )