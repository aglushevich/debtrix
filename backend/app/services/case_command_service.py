from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models import Case
from backend.app.services.case_service import create_case_write, sync_and_persist_case
from backend.app.services.debtor_service import (
    normalize_and_validate_inn_ogrn,
)
from backend.app.services.organization_lookup_service import (
    lookup_organization_by_identifiers,
)


def _serialize_case(item: Case) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "debtor_name": item.debtor_name,
        "debtor_type": item.debtor_type,
        "contract_type": item.contract_type,
        "principal_amount": str(item.principal_amount),
        "due_date": item.due_date.isoformat() if item.due_date else None,
        "status": item.status,
        "is_archived": bool(getattr(item, "is_archived", False)),
        "contract_data": item.contract_data or {},
        "meta": item.meta or {},
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _merge_dict(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    result = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge_dict(result[key], value)
        else:
            result[key] = value
    return result


def create_case_from_command(
    db: Session,
    *,
    tenant_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    debtor_type = str(payload.get("debtor_type") or "").strip()
    contract_type = str(payload.get("contract_type") or "").strip()
    debtor_name_in = str(payload.get("debtor_name") or "").strip()

    if not debtor_type:
        raise HTTPException(status_code=422, detail="debtor_type is required")
    if not contract_type:
        raise HTTPException(status_code=422, detail="contract_type is required")

    principal_amount_raw = payload.get("principal_amount")
    if principal_amount_raw is None:
        raise HTTPException(status_code=422, detail="principal_amount is required")

    try:
        principal_amount = Decimal(str(principal_amount_raw))
    except Exception:
        raise HTTPException(status_code=422, detail="principal_amount must be a valid decimal")

    due_date = payload.get("due_date")
    note = payload.get("note")
    contract_data_input = dict(payload.get("contract_data") or {})

    auto_lookup_organization = bool(payload.get("auto_lookup_organization", True))
    auto_fill_debtor_name = bool(payload.get("auto_fill_debtor_name", True))

    debtor_inn_raw = payload.get("debtor_inn")
    debtor_ogrn_raw = payload.get("debtor_ogrn")

    inn_norm, ogrn_norm = normalize_and_validate_inn_ogrn(
        debtor_inn_raw,
        debtor_ogrn_raw,
    )

    organization = None
    lookup_performed = False

    if auto_lookup_organization and (inn_norm or ogrn_norm):
        lookup_performed = True
        organization = lookup_organization_by_identifiers(
            inn=inn_norm,
            ogrn=ogrn_norm,
        )

    resolved_debtor_name = debtor_name_in
    if not resolved_debtor_name and auto_fill_debtor_name and organization:
        resolved_debtor_name = (
            organization.get("name_full")
            or organization.get("name")
            or organization.get("name_short")
            or ""
        ).strip()

    if not resolved_debtor_name:
        raise HTTPException(
            status_code=422,
            detail="debtor_name is required when organization was not resolved",
        )

    debtor_block: dict[str, Any] = dict((contract_data_input.get("debtor") or {}))

    if inn_norm:
        debtor_block["inn"] = inn_norm
    if ogrn_norm:
        debtor_block["ogrn"] = ogrn_norm

    if organization:
        debtor_block = _merge_dict(
            debtor_block,
            {
                "inn": organization.get("inn"),
                "ogrn": organization.get("ogrn"),
                "name": organization.get("name"),
                "name_full": organization.get("name_full"),
                "name_short": organization.get("name_short"),
                "kpp": organization.get("kpp"),
                "address": organization.get("address"),
                "director_name": organization.get("director_name"),
                "status": organization.get("status"),
                "registration_date": organization.get("registration_date"),
                "okved_main": organization.get("okved_main"),
                "source": organization.get("source"),
            },
        )

    contract_data = dict(contract_data_input)
    contract_data["debtor"] = debtor_block

    if note:
        contract_data["note"] = str(note).strip()

    command_meta = {
        "source": "case_command",
        "auto_lookup_organization": auto_lookup_organization,
        "auto_fill_debtor_name": auto_fill_debtor_name,
        "lookup_performed": lookup_performed,
        "organization_resolved": bool(organization),
        "received_at": datetime.utcnow().isoformat(),
    }

    created = create_case_write(
        db,
        tenant_id=tenant_id,
        debtor_type=debtor_type,
        debtor_name=resolved_debtor_name,
        contract_type=contract_type,
        principal_amount=principal_amount,
        due_date=due_date,
        contract_data=contract_data,
    )

    meta = dict(created.meta or {})
    meta["case_command"] = command_meta
    created.meta = meta
    created.updated_at = datetime.utcnow()

    db.add(created)
    sync_and_persist_case(db, created)
    db.flush()
    db.refresh(created)

    return {
        "ok": True,
        "case": _serialize_case(created),
        "command": {
            "resolved_debtor_name": resolved_debtor_name,
            "debtor_inn": debtor_block.get("inn"),
            "debtor_ogrn": debtor_block.get("ogrn"),
            "lookup_performed": lookup_performed,
            "organization_resolved": bool(organization),
            "organization": organization,
        },
    }