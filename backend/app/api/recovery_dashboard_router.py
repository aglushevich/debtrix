from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.debtor_dashboard_service import (
    get_debtor_cases,
    get_debtor_dashboard,
)
from backend.app.services.recovery_service import (
    add_recovery_payment,
    get_recovery,
    init_recovery,
    patch_recovery_accrued,
)
from backend.app.services.tenant_query_service import resolve_current_tenant_id

router = APIRouter(tags=["recovery-dashboard"])


def _get_current_tenant_id(
    db: Session = Depends(get_db),
    tenant_id: int | None = Query(default=None, alias="tenant_id"),
) -> int:
    return resolve_current_tenant_id(db, tenant_id)


@router.get("/debtors/{debtor_id}/dashboard")
def debtor_dashboard_endpoint(
    debtor_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    return get_debtor_dashboard(
        db,
        tenant_id=tenant_id,
        debtor_id=debtor_id,
    )


@router.get("/debtors/{debtor_id}/cases")
def debtor_cases_endpoint(
    debtor_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    return get_debtor_cases(
        db,
        tenant_id=tenant_id,
        debtor_id=debtor_id,
    )


@router.get("/cases/{case_id}/recovery")
def get_recovery_endpoint(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    return get_recovery(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
    )


@router.post("/cases/{case_id}/recovery/init")
def init_recovery_endpoint(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    result = init_recovery(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
    )
    db.commit()
    return result


@router.patch("/cases/{case_id}/recovery/accrued")
def patch_recovery_accrued_endpoint(
    case_id: int,
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    result = patch_recovery_accrued(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
        accrued=payload,
    )
    db.commit()
    return result


@router.post("/cases/{case_id}/recovery/payments")
def add_recovery_payment_endpoint(
    case_id: int,
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    result = add_recovery_payment(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
        amount=payload.get("amount"),
        source=str(payload.get("source") or "manual"),
        note=payload.get("note"),
    )
    db.commit()
    return result