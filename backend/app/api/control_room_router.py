from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.control_room_service import (
    get_case_control_room_card,
    get_control_room_dashboard,
    get_control_room_execution_console,
    get_control_room_priority_cases,
    get_control_room_summary,
    get_control_room_waiting_preview,
)
from backend.app.services.focus_queue_service import get_control_room_focus_queues
from backend.app.services.tenant_query_service import resolve_current_tenant_id

router = APIRouter(tags=["control-room"])


def _get_current_tenant_id(
    db: Session = Depends(get_db),
    tenant_id: int | None = Query(default=None, alias="tenant_id"),
) -> int:
    return resolve_current_tenant_id(db, tenant_id)


@router.get("/control-room/summary")
def control_room_summary(
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    return get_control_room_summary(
        db,
        tenant_id=tenant_id,
        include_archived=include_archived,
    )


@router.get("/control-room/priority-cases")
def control_room_priority_cases(
    include_archived: bool = Query(default=False),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    return get_control_room_priority_cases(
        db,
        tenant_id=tenant_id,
        limit=limit,
        include_archived=include_archived,
    )


@router.get("/control-room/waiting-preview")
def control_room_waiting_preview(
    limit: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    return get_control_room_waiting_preview(
        db,
        tenant_id=tenant_id,
        limit=limit,
    )


@router.get("/control-room/execution-console")
def control_room_execution_console(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    return get_control_room_execution_console(
        db,
        tenant_id=tenant_id,
        limit=limit,
    )


@router.get("/control-room/focus-queues")
def control_room_focus_queues(
    include_archived: bool = Query(default=False),
    per_queue_limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    return get_control_room_focus_queues(
        db,
        tenant_id=tenant_id,
        include_archived=include_archived,
        per_queue_limit=per_queue_limit,
    )


@router.get("/control-room/dashboard")
def control_room_dashboard(
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    return get_control_room_dashboard(
        db,
        tenant_id=tenant_id,
        include_archived=include_archived,
    )


@router.get("/cases/{case_id}/control-room-card")
def case_control_room_card(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    _ = tenant_id
    return get_case_control_room_card(
        db,
        case_id=case_id,
    )