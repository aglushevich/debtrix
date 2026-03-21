from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.events import CaseEvent, CaseEventType, emit_event
from backend.app.models import Case
from backend.app.services.tenant_query_service import load_case_for_tenant_or_404


def _safe_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0"))
    except Exception:
        return Decimal("0")


def _format_money(value: Decimal) -> str:
    return f"{value:.2f}"


def _utcnow_iso() -> str:
    return datetime.utcnow().isoformat()


def _normalize_recovery_block(case: Case) -> dict[str, Any]:
    contract_data = dict(case.contract_data or {})
    recovery = dict(contract_data.get("recovery") or {})

    components = dict(recovery.get("components") or {})
    payments = list(recovery.get("payments") or [])

    if "principal_amount" not in components:
        components["principal_amount"] = str(case.principal_amount or "0")

    normalized_payments: list[dict[str, Any]] = []
    for item in payments:
        if not isinstance(item, dict):
            continue
        normalized_payments.append(
            {
                "amount": str(item.get("amount") or "0"),
                "created_at": item.get("created_at") or _utcnow_iso(),
                "source": item.get("source") or "manual",
                "note": item.get("note"),
            }
        )

    recovery["initialized_at"] = recovery.get("initialized_at") or _utcnow_iso()
    recovery["components"] = components
    recovery["payments"] = normalized_payments

    return recovery


def _recalculate_recovery(case: Case, recovery: dict[str, Any]) -> dict[str, Any]:
    components = dict(recovery.get("components") or {})
    payments = list(recovery.get("payments") or [])

    total_amount = Decimal("0")
    normalized_components: dict[str, str] = {}

    for key, value in components.items():
        amount = _safe_decimal(value)
        normalized_components[str(key)] = _format_money(amount)
        total_amount += amount

    payments_total = Decimal("0")
    normalized_payments: list[dict[str, Any]] = []
    for item in payments:
        amount = _safe_decimal(item.get("amount"))
        payments_total += amount
        normalized_payments.append(
            {
                "amount": _format_money(amount),
                "created_at": item.get("created_at") or _utcnow_iso(),
                "source": item.get("source") or "manual",
                "note": item.get("note"),
            }
        )

    outstanding_amount = total_amount - payments_total

    if total_amount == Decimal("0"):
        status = "not_initialized"
    elif outstanding_amount < Decimal("0"):
        status = "overpaid"
    elif outstanding_amount == Decimal("0"):
        status = "paid"
    else:
        status = "open"

    return {
        "initialized_at": recovery.get("initialized_at") or _utcnow_iso(),
        "updated_at": _utcnow_iso(),
        "components": normalized_components,
        "payments": normalized_payments,
        "principal_amount": normalized_components.get("principal_amount", _format_money(_safe_decimal(case.principal_amount))),
        "total_amount": _format_money(total_amount),
        "payments_total": _format_money(payments_total),
        "outstanding_amount": _format_money(outstanding_amount),
        "status": status,
    }


def _persist_recovery(case: Case, recovery: dict[str, Any]) -> None:
    contract_data = dict(case.contract_data or {})
    contract_data["recovery"] = recovery
    case.contract_data = contract_data
    case.updated_at = datetime.utcnow()


def get_recovery(db: Session, *, tenant_id: int, case_id: int) -> dict[str, Any]:
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)

    recovery = _normalize_recovery_block(case)
    calculated = _recalculate_recovery(case, recovery)

    return {
        "case_id": case.id,
        "recovery": calculated,
    }


def init_recovery(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
) -> dict[str, Any]:
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)

    recovery = _normalize_recovery_block(case)
    calculated = _recalculate_recovery(case, recovery)
    _persist_recovery(case, calculated)

    db.add(case)

    emit_event(
        db,
        CaseEvent(
            case_id=case.id,
            type=CaseEventType.RECOVERY_INITIALIZED,
            title="Recovery инициализирован",
            details="Создан или актуализирован recovery-блок по делу.",
            payload={
                "status": calculated["status"],
                "total_amount": calculated["total_amount"],
                "outstanding_amount": calculated["outstanding_amount"],
            },
        ),
    )

    db.flush()

    return {
        "ok": True,
        "case_id": case.id,
        "recovery": calculated,
    }


def patch_recovery_accrued(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
    accrued: dict[str, Any],
) -> dict[str, Any]:
    if not isinstance(accrued, dict) or not accrued:
        raise HTTPException(status_code=422, detail="Accrued payload must be a non-empty object")

    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)

    recovery = _normalize_recovery_block(case)
    components = dict(recovery.get("components") or {})

    changed_keys: list[str] = []
    for key, value in accrued.items():
        key_str = str(key).strip()
        if not key_str:
            continue
        components[key_str] = str(value)
        changed_keys.append(key_str)

    recovery["components"] = components
    calculated = _recalculate_recovery(case, recovery)
    _persist_recovery(case, calculated)

    db.add(case)

    emit_event(
        db,
        CaseEvent(
            case_id=case.id,
            type=CaseEventType.ACCRUED_UPDATED,
            title="Начисления обновлены",
            details="Изменены recovery-компоненты по делу.",
            payload={
                "changed_keys": "|".join(changed_keys),
                "total_amount": calculated["total_amount"],
                "outstanding_amount": calculated["outstanding_amount"],
            },
        ),
    )

    db.flush()

    return {
        "ok": True,
        "case_id": case.id,
        "recovery": calculated,
    }


def add_recovery_payment(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
    amount: Any,
    source: str = "manual",
    note: str | None = None,
) -> dict[str, Any]:
    amount_dec = _safe_decimal(amount)
    if amount_dec <= Decimal("0"):
        raise HTTPException(status_code=422, detail="Payment amount must be > 0")

    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)

    recovery = _normalize_recovery_block(case)
    payments = list(recovery.get("payments") or [])
    payments.append(
        {
            "amount": _format_money(amount_dec),
            "created_at": _utcnow_iso(),
            "source": source or "manual",
            "note": note,
        }
    )
    recovery["payments"] = payments

    calculated = _recalculate_recovery(case, recovery)
    _persist_recovery(case, calculated)

    db.add(case)

    emit_event(
        db,
        CaseEvent(
            case_id=case.id,
            type=CaseEventType.PAYMENT_ADDED,
            title="Платёж добавлен",
            details="В recovery добавлен платёж.",
            payload={
                "amount": _format_money(amount_dec),
                "payments_total": calculated["payments_total"],
                "outstanding_amount": calculated["outstanding_amount"],
            },
        ),
    )

    if _safe_decimal(calculated["outstanding_amount"]) < Decimal("0"):
        emit_event(
            db,
            CaseEvent(
                case_id=case.id,
                type=CaseEventType.OVERPAID_DETECTED,
                title="Обнаружена переплата",
                details="После добавления платежа outstanding_amount стал отрицательным.",
                payload={
                    "outstanding_amount": calculated["outstanding_amount"],
                },
            ),
        )

    db.flush()

    return {
        "ok": True,
        "case_id": case.id,
        "recovery": calculated,
    }