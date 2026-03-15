from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models.portfolio_view import PortfolioView


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _serialize_portfolio_view(item: PortfolioView) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "name": item.name,
        "description": item.description,
        "is_default": item.is_default,
        "is_shared": item.is_shared,
        "filters": item.filters or {},
        "sorting": item.sorting or {},
        "columns": item.columns or {},
        "meta": item.meta or {},
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def get_portfolio_view_or_404(
    db: Session,
    *,
    view_id: int,
    tenant_id: int,
) -> PortfolioView:
    item = (
        db.query(PortfolioView)
        .filter(
            PortfolioView.id == view_id,
            PortfolioView.tenant_id == tenant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Portfolio view not found")
    return item


def list_portfolio_views(
    db: Session,
    *,
    tenant_id: int,
) -> dict[str, Any]:
    items = (
        db.query(PortfolioView)
        .filter(PortfolioView.tenant_id == tenant_id)
        .order_by(PortfolioView.is_default.desc(), PortfolioView.id.desc())
        .all()
    )
    return {
        "items": [_serialize_portfolio_view(item) for item in items],
    }


def create_portfolio_view(
    db: Session,
    *,
    tenant_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    now = _utcnow()

    if payload.get("is_default"):
        (
            db.query(PortfolioView)
            .filter(PortfolioView.tenant_id == tenant_id)
            .update({"is_default": False}, synchronize_session=False)
        )

    item = PortfolioView(
        tenant_id=tenant_id,
        name=str(payload["name"]).strip(),
        description=payload.get("description"),
        is_default=bool(payload.get("is_default", False)),
        is_shared=bool(payload.get("is_shared", False)),
        filters=dict(payload.get("filters") or {}),
        sorting=dict(payload.get("sorting") or {}),
        columns=dict(payload.get("columns") or {}),
        meta=dict(payload.get("meta") or {}),
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    db.flush()
    db.refresh(item)

    return {
        "ok": True,
        "view": _serialize_portfolio_view(item),
    }


def update_portfolio_view(
    db: Session,
    *,
    view_id: int,
    tenant_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    item = get_portfolio_view_or_404(
        db,
        view_id=view_id,
        tenant_id=tenant_id,
    )

    if payload.get("is_default") is True:
        (
            db.query(PortfolioView)
            .filter(
                PortfolioView.tenant_id == tenant_id,
                PortfolioView.id != item.id,
            )
            .update({"is_default": False}, synchronize_session=False)
        )

    if "name" in payload and payload["name"] is not None:
        item.name = str(payload["name"]).strip()

    if "description" in payload:
        item.description = payload["description"]

    if "is_default" in payload and payload["is_default"] is not None:
        item.is_default = bool(payload["is_default"])

    if "is_shared" in payload and payload["is_shared"] is not None:
        item.is_shared = bool(payload["is_shared"])

    if "filters" in payload and payload["filters"] is not None:
        item.filters = dict(payload["filters"])

    if "sorting" in payload and payload["sorting"] is not None:
        item.sorting = dict(payload["sorting"])

    if "columns" in payload and payload["columns"] is not None:
        item.columns = dict(payload["columns"])

    if "meta" in payload and payload["meta"] is not None:
        item.meta = dict(payload["meta"])

    item.updated_at = _utcnow()
    db.add(item)
    db.flush()
    db.refresh(item)

    return {
        "ok": True,
        "view": _serialize_portfolio_view(item),
    }


def delete_portfolio_view(
    db: Session,
    *,
    view_id: int,
    tenant_id: int,
) -> dict[str, Any]:
    item = get_portfolio_view_or_404(
        db,
        view_id=view_id,
        tenant_id=tenant_id,
    )

    db.delete(item)
    db.flush()

    return {
        "ok": True,
        "deleted_id": view_id,
    }