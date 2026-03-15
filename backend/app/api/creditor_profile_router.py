from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.creditor_profile_service import (
    get_creditor_profile,
    ensure_creditor_profile,
)
from backend.app.services.tenant_query_service import resolve_current_tenant_id

router = APIRouter(tags=["creditor-profile"])


@router.get("/creditor/profile")
def get_profile(
    db: Session = Depends(get_db),
):

    tenant_id = resolve_current_tenant_id(db)

    profile = ensure_creditor_profile(db, tenant_id)

    return {
        "profile": {
            "name": profile.name,
            "name_full": profile.name_full,
            "name_short": profile.name_short,
            "inn": profile.inn,
            "ogrn": profile.ogrn,
            "kpp": profile.kpp,
            "address": profile.address,
            "signer_name": profile.signer_name,
            "signer_position": profile.signer_position,
            "signer_basis": profile.signer_basis,
        }
    }


@router.patch("/creditor/profile")
def update_profile(
    payload: dict,
    db: Session = Depends(get_db),
):

    tenant_id = resolve_current_tenant_id(db)

    profile = ensure_creditor_profile(db, tenant_id)

    for field in [
        "name",
        "name_full",
        "name_short",
        "inn",
        "ogrn",
        "kpp",
        "address",
        "signer_name",
        "signer_position",
        "signer_basis",
    ]:
        if field in payload:
            setattr(profile, field, payload[field])

    db.commit()

    return {"ok": True}