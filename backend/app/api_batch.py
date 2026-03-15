from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas.batch import BatchJobCreate, BatchJobExecuteRequest
from backend.app.services.batch_execution_service import (
    create_batch_job,
    execute_batch_job,
    execute_batch_job_runs,
    get_batch_job_details,
    list_batch_jobs,
)
from backend.app.services.tenant_query_service import resolve_current_tenant_id

router = APIRouter(prefix="/batch", tags=["batch"])


def get_current_tenant_id(
    db: Session = Depends(get_db),
    tenant_id: int | None = Query(default=None),
) -> int:
    return resolve_current_tenant_id(db, tenant_id)


@router.get("/jobs")
def batch_jobs_list(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_batch_jobs(
        db,
        tenant_id=tenant_id,
        limit=limit,
    )


@router.post("/jobs")
def batch_jobs_create(
    payload: BatchJobCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = create_batch_job(
        db,
        tenant_id=tenant_id,
        payload=payload.model_dump(),
    )
    db.commit()
    return result


@router.get("/jobs/{batch_job_id}")
def batch_job_details(
    batch_job_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return get_batch_job_details(
        db,
        batch_job_id=batch_job_id,
        tenant_id=tenant_id,
    )


@router.post("/jobs/{batch_job_id}/enqueue")
def batch_job_enqueue(
    batch_job_id: int,
    payload: BatchJobExecuteRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = execute_batch_job(
        db,
        batch_job_id=batch_job_id,
        tenant_id=tenant_id,
        limit=payload.limit,
        force=payload.force,
    )
    db.commit()
    return result


@router.post("/jobs/{batch_job_id}/execute")
def batch_job_execute_runs(
    batch_job_id: int,
    payload: BatchJobExecuteRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = execute_batch_job_runs(
        db,
        batch_job_id=batch_job_id,
        tenant_id=tenant_id,
        limit=payload.limit,
        force=payload.force,
    )
    db.commit()
    return result