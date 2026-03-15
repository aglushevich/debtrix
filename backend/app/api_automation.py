from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas.automation import (
    AutomationRuleCreate,
    AutomationRuleUpdate,
    AutomationRunCreate,
    AutomationRunExecuteRequest,
)
from backend.app.services.automation_engine_service import (
    cancel_run,
    create_rule,
    enqueue_rule_for_case,
    execute_run,
    list_rules,
    list_runs,
    list_waiting_runs,
    retry_waiting_runs,
    update_rule,
)
from backend.app.services.tenant_query_service import resolve_current_tenant_id

router = APIRouter(prefix="/automation", tags=["automation"])


def get_current_tenant_id(
    db: Session = Depends(get_db),
    tenant_id: int | None = Query(default=None),
) -> int:
    return resolve_current_tenant_id(db, tenant_id)


@router.get("/rules")
def automation_rules_list(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_rules(db, tenant_id=tenant_id)


@router.post("/rules")
def automation_rules_create(
    payload: AutomationRuleCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = create_rule(
        db,
        tenant_id=tenant_id,
        payload=payload.model_dump(),
    )
    db.commit()
    return result


@router.patch("/rules/{rule_id}")
def automation_rules_update(
    rule_id: int,
    payload: AutomationRuleUpdate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = update_rule(
        db,
        rule_id=rule_id,
        tenant_id=tenant_id,
        payload=payload.model_dump(exclude_unset=True),
    )
    db.commit()
    return result


@router.post("/rules/{rule_id}/enqueue")
def automation_rule_enqueue(
    rule_id: int,
    payload: AutomationRunCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = enqueue_rule_for_case(
        db,
        rule_id=rule_id,
        case_id=payload.case_id,
        tenant_id=tenant_id,
        input_payload=payload.input_payload,
        dedup_key=payload.dedup_key,
    )
    db.commit()
    return result


@router.get("/runs")
def automation_runs_list(
    status: str | None = Query(default=None),
    case_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_runs(
        db,
        tenant_id=tenant_id,
        status=status,
        case_id=case_id,
        limit=limit,
    )


@router.get("/runs/waiting")
def automation_waiting_runs(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_waiting_runs(
        db,
        tenant_id=tenant_id,
        limit=limit,
    )


@router.post("/runs/retry-waiting")
def automation_retry_waiting(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = retry_waiting_runs(
        db,
        tenant_id=tenant_id,
        limit=limit,
    )
    db.commit()
    return result


@router.post("/runs/{run_id}/execute")
def automation_run_execute(
    run_id: int,
    payload: AutomationRunExecuteRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = execute_run(
        db,
        run_id=run_id,
        tenant_id=tenant_id,
        force=payload.force,
    )
    db.commit()
    return result


@router.post("/runs/{run_id}/cancel")
def automation_run_cancel(
    run_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = cancel_run(
        db,
        run_id=run_id,
        tenant_id=tenant_id,
    )
    db.commit()
    return result