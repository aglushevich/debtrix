from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models import Tenant, User, WorkspaceMembership


DEFAULT_ROLE = "operator"
ALLOWED_ROLES = {"owner", "admin", "operator", "viewer", "external_counsel"}


def _utcnow() -> datetime:
    return datetime.utcnow()


def serialize_membership(item: WorkspaceMembership, user: User | None = None, tenant: Tenant | None = None) -> dict:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "user_id": item.user_id,
        "role": item.role,
        "status": item.status,
        "invited_by_user_id": item.invited_by_user_id,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": getattr(user, "is_active", True),
        } if user else None,
        "workspace": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
        } if tenant else None,
    }


def get_membership(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
) -> WorkspaceMembership | None:
    return (
        db.query(WorkspaceMembership)
        .filter(
            WorkspaceMembership.tenant_id == tenant_id,
            WorkspaceMembership.user_id == user_id,
        )
        .first()
    )


def require_membership(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
) -> WorkspaceMembership:
    item = get_membership(db, tenant_id=tenant_id, user_id=user_id)
    if not item or item.status != "active":
        raise HTTPException(status_code=403, detail="User is not an active workspace member")
    return item


def ensure_workspace_membership(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    role: str = DEFAULT_ROLE,
    invited_by_user_id: int | None = None,
) -> WorkspaceMembership:
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=422, detail=f"Unsupported role: {role}")

    existing = get_membership(db, tenant_id=tenant_id, user_id=user_id)
    if existing:
        if existing.status != "active":
            existing.status = "active"
            existing.updated_at = _utcnow()
            db.add(existing)
            db.flush()
        return existing

    item = WorkspaceMembership(
        tenant_id=tenant_id,
        user_id=user_id,
        role=role,
        status="active",
        invited_by_user_id=invited_by_user_id,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(item)
    db.flush()
    db.refresh(item)
    return item


def list_workspace_memberships(
    db: Session,
    *,
    tenant_id: int,
) -> dict:
    rows = (
        db.query(WorkspaceMembership, User)
        .join(User, User.id == WorkspaceMembership.user_id)
        .filter(WorkspaceMembership.tenant_id == tenant_id)
        .order_by(WorkspaceMembership.id.asc())
        .all()
    )

    workspace = db.query(Tenant).filter(Tenant.id == tenant_id).first()

    return {
        "items": [
            serialize_membership(membership, user=user, tenant=workspace)
            for membership, user in rows
        ]
    }


def list_user_workspaces(
    db: Session,
    *,
    user_id: int,
) -> dict:
    rows = (
        db.query(WorkspaceMembership, Tenant)
        .join(Tenant, Tenant.id == WorkspaceMembership.tenant_id)
        .filter(
            WorkspaceMembership.user_id == user_id,
            WorkspaceMembership.status == "active",
        )
        .order_by(Tenant.id.asc())
        .all()
    )

    return {
        "items": [
            {
                "membership_id": membership.id,
                "role": membership.role,
                "status": membership.status,
                "workspace": {
                    "id": tenant.id,
                    "name": tenant.name,
                    "slug": tenant.slug,
                },
            }
            for membership, tenant in rows
        ]
    }