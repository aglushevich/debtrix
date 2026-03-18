from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models import User, WorkspaceInvite
from backend.app.services.workspace_membership_service import (
    ALLOWED_ROLES,
    ensure_workspace_membership,
)


def _utcnow() -> datetime:
    return datetime.utcnow()


def _build_token() -> str:
    return secrets.token_urlsafe(24)


def serialize_workspace_invite(item: WorkspaceInvite) -> dict:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "email": item.email,
        "role": item.role,
        "token": item.token,
        "status": item.status,
        "invited_by_user_id": item.invited_by_user_id,
        "accepted_by_user_id": item.accepted_by_user_id,
        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
        "accepted_at": item.accepted_at.isoformat() if item.accepted_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def list_workspace_invites(
    db: Session,
    *,
    tenant_id: int,
) -> dict:
    rows = (
        db.query(WorkspaceInvite)
        .filter(WorkspaceInvite.tenant_id == tenant_id)
        .order_by(WorkspaceInvite.id.desc())
        .all()
    )
    return {"items": [serialize_workspace_invite(item) for item in rows]}


def create_workspace_invite(
    db: Session,
    *,
    tenant_id: int,
    email: str,
    role: str,
    invited_by_user_id: int | None = None,
    expires_in_days: int = 7,
) -> dict:
    normalized_email = email.strip().lower()
    if not normalized_email:
        raise HTTPException(status_code=422, detail="Email is required")

    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=422, detail=f"Unsupported role: {role}")

    invite = WorkspaceInvite(
        tenant_id=tenant_id,
        email=normalized_email,
        role=role,
        token=_build_token(),
        status="pending",
        invited_by_user_id=invited_by_user_id,
        expires_at=_utcnow() + timedelta(days=expires_in_days),
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(invite)
    db.flush()
    db.refresh(invite)

    return {
        "ok": True,
        "invite": serialize_workspace_invite(invite),
    }


def accept_workspace_invite(
    db: Session,
    *,
    token: str,
    user_id: int,
) -> dict:
    invite = (
        db.query(WorkspaceInvite)
        .filter(WorkspaceInvite.token == token)
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.status != "pending":
        raise HTTPException(status_code=409, detail="Invite is not pending")

    if invite.expires_at and invite.expires_at < _utcnow():
        invite.status = "expired"
        invite.updated_at = _utcnow()
        db.add(invite)
        db.flush()
        raise HTTPException(status_code=410, detail="Invite expired")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.email and user.email.strip().lower() != invite.email.strip().lower():
        raise HTTPException(status_code=409, detail="Invite email does not match current user")

    membership = ensure_workspace_membership(
        db,
        tenant_id=invite.tenant_id,
        user_id=user.id,
        role=invite.role,
        invited_by_user_id=invite.invited_by_user_id,
    )

    invite.status = "accepted"
    invite.accepted_by_user_id = user.id
    invite.accepted_at = _utcnow()
    invite.updated_at = _utcnow()
    db.add(invite)

    user.last_active_tenant_id = invite.tenant_id
    user.updated_at = _utcnow()
    db.add(user)

    db.flush()

    return {
        "ok": True,
        "invite": serialize_workspace_invite(invite),
        "membership": {
            "id": membership.id,
            "tenant_id": membership.tenant_id,
            "user_id": membership.user_id,
            "role": membership.role,
            "status": membership.status,
        },
    }