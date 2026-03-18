from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas.batch_portfolio import (
    BatchExecuteRequest,
    BatchExecuteResponse,
    BatchPreviewRequest,
    BatchPreviewResponse,
)
from backend.app.services.batch_action_service import (
    execute_batch_action,
    preview_batch_action,
)
from backend.app.services.tenant_query_service import resolve_current_tenant_id

router = APIRouter(tags=["batch-actions"])


def get_current_tenant_id(
    db: Session = Depends(get_db),
    tenant_id: int | None = Query(default=None, alias="tenant_id"),
) -> int:
    return resolve_current_tenant_id(db, tenant_id=tenant_id)


@router.post("/batch-actions/preview", response_model=BatchPreviewResponse)
def batch_actions_preview(
    payload: BatchPreviewRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return preview_batch_action(
        db,
        tenant_id=tenant_id,
        action_code=payload.action_code,
        case_ids=payload.case_ids,
    )


@router.post("/batch-actions/execute", response_model=BatchExecuteResponse)
def batch_actions_execute(
    payload: BatchExecuteRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = execute_batch_action(
        db,
        tenant_id=tenant_id,
        action_code=payload.action_code,
        case_ids=payload.case_ids,
        force=payload.force,
    )
    db.commit()
    return result