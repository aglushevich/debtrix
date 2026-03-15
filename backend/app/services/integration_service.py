from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from backend.app.models.case_integration import CaseIntegration


def _normalize_provider(value: str) -> str:
    return (value or "").strip().lower()


def _serialize_row(row: CaseIntegration) -> dict[str, Any]:
    return {
        "id": row.id,
        "provider": row.provider,
        "status": row.status,
        "mode": row.mode,
        "external_id": row.external_id,
        "last_error": row.last_error,
        "last_payload_hash": row.last_payload_hash,
        "last_synced_at": row.last_synced_at.isoformat() if row.last_synced_at else None,
        "data": row.data or {},
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def get_case_integration(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
    provider: str,
) -> Optional[CaseIntegration]:
    provider = _normalize_provider(provider)

    return (
        db.query(CaseIntegration)
        .filter(
            CaseIntegration.tenant_id == tenant_id,
            CaseIntegration.case_id == case_id,
            CaseIntegration.provider == provider,
        )
        .first()
    )


def get_or_create_case_integration(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
    provider: str,
    mode: Optional[str] = None,
) -> CaseIntegration:
    provider = _normalize_provider(provider)

    row = get_case_integration(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
        provider=provider,
    )
    if row:
        if mode and not row.mode:
            row.mode = mode
            row.updated_at = datetime.utcnow()
            db.add(row)
            db.flush()
        return row

    row = CaseIntegration(
        tenant_id=tenant_id,
        case_id=case_id,
        provider=provider,
        status="idle",
        mode=mode,
        external_id=None,
        last_error=None,
        last_payload_hash=None,
        last_synced_at=None,
        data={},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    return row


def mark_integration_success(
    db: Session,
    row: CaseIntegration,
    *,
    status: str = "synced",
    details: Optional[dict[str, Any]] = None,
    external_id: Optional[str] = None,
    payload_hash: Optional[str] = None,
) -> CaseIntegration:
    row.status = status
    row.last_error = None
    row.last_synced_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()

    if external_id is not None:
        row.external_id = external_id
    if payload_hash is not None:
        row.last_payload_hash = payload_hash
    if details is not None:
        row.data = details

    db.add(row)
    db.flush()
    return row


def mark_integration_error(
    db: Session,
    row: CaseIntegration,
    *,
    error: str,
    details: Optional[dict[str, Any]] = None,
    payload_hash: Optional[str] = None,
) -> CaseIntegration:
    row.status = "error"
    row.last_error = error
    row.updated_at = datetime.utcnow()

    if payload_hash is not None:
        row.last_payload_hash = payload_hash
    if details is not None:
        row.data = details

    db.add(row)
    db.flush()
    return row


def get_case_integrations_status(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
) -> dict[str, Any]:
    rows = (
        db.query(CaseIntegration)
        .filter(
            CaseIntegration.tenant_id == tenant_id,
            CaseIntegration.case_id == case_id,
        )
        .order_by(CaseIntegration.provider.asc(), CaseIntegration.id.asc())
        .all()
    )

    items = [_serialize_row(row) for row in rows]
    by_provider = {item["provider"]: item for item in items}

    return {
        "case_id": case_id,
        "integrations": items,
        "providers": {
            "fns": by_provider.get("fns")
            or {
                "provider": "fns",
                "status": "idle",
                "mode": "sync",
                "external_id": None,
                "last_error": None,
                "last_payload_hash": None,
                "last_synced_at": None,
                "data": {},
                "created_at": None,
                "updated_at": None,
            },
            "fssp": by_provider.get("fssp")
            or {
                "provider": "fssp",
                "status": "idle",
                "mode": "monitor",
                "external_id": None,
                "last_error": None,
                "last_payload_hash": None,
                "last_synced_at": None,
                "data": {},
                "created_at": None,
                "updated_at": None,
            },
            "esia": by_provider.get("esia")
            or {
                "provider": "esia",
                "status": "not_connected",
                "mode": "user_auth",
                "external_id": None,
                "last_error": None,
                "last_payload_hash": None,
                "last_synced_at": None,
                "data": {},
                "created_at": None,
                "updated_at": None,
            },
        },
    }