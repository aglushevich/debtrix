from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas.case_command import (
    CaseCommandCreateRequest,
    CaseCommandCreateResponse,
)
from backend.app.services.command_case_creation_service import (
    execute_command_case_creation,
    preview_command_case_creation,
)
from backend.app.services.tenant_query_service import resolve_current_tenant_id


router = APIRouter(tags=["case-commands"])


def get_current_tenant_id(
    db: Session = Depends(get_db),
    tenant_id: Optional[int] = Query(default=None, alias="tenant_id"),
) -> int:
    return resolve_current_tenant_id(db, tenant_id)


@router.post(
    "/case-commands/create/preview",
)
def case_command_create_preview(
    payload: CaseCommandCreateRequest,
):
    return preview_command_case_creation(payload=payload.model_dump())


@router.post(
    "/case-commands/create",
    response_model=CaseCommandCreateResponse,
)
def case_command_create(
    payload: CaseCommandCreateRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = execute_command_case_creation(
        db,
        tenant_id=tenant_id,
        payload=payload.model_dump(),
    )
    db.commit()
    return result