from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Tenant, User
from backend.app.services.tenant_query_service import resolve_current_tenant_id
from backend.app.services.workspace_invite_service import (
    accept_workspace_invite,
    create_workspace_invite,
    list_workspace_invites,
)
from backend.app.services.workspace_membership_service import (
    ensure_workspace_membership,
    list_user_workspaces,
    list_workspace_memberships,
)

router = APIRouter(tags=["workspace"])


def get_current_tenant_id(
    db: Session = Depends(get_db),
    tenant_id: Optional[int] = Query(default=None, alias="tenant_id"),
) -> int:
    return resolve_current_tenant_id(db, tenant_id)


@router.get("/workspaces/{tenant_id}/members")
def workspace_members_list(
    tenant_id: int,
    db: Session = Depends(get_db),
):
    return list_workspace_memberships(db, tenant_id=tenant_id)


@router.get("/workspaces/{tenant_id}/invites")
def workspace_invites_list(
    tenant_id: int,
    db: Session = Depends(get_db),
):
    return list_workspace_invites(db, tenant_id=tenant_id)


@router.post("/workspaces/{tenant_id}/invites")
def workspace_invite_create(
    tenant_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    return create_workspace_invite(
        db,
        tenant_id=tenant_id,
        email=str(payload.get("email") or "").strip(),
        role=str(payload.get("role") or "operator").strip(),
        invited_by_user_id=payload.get("invited_by_user_id"),
    )


@router.post("/workspace-invites/accept")
def workspace_invite_accept(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    return accept_workspace_invite(
        db,
        token=str(payload.get("token") or "").strip(),
        user_id=int(payload["user_id"]),
    )


@router.get("/users/{user_id}/workspaces")
def user_workspaces(
    user_id: int,
    db: Session = Depends(get_db),
):
    return list_user_workspaces(db, user_id=user_id)


@router.post("/workspaces/{tenant_id}/members")
def workspace_member_add(
    tenant_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    membership = ensure_workspace_membership(
        db,
        tenant_id=tenant_id,
        user_id=int(payload["user_id"]),
        role=str(payload.get("role") or "operator"),
        invited_by_user_id=payload.get("invited_by_user_id"),
    )
    return {
        "ok": True,
        "membership": {
            "id": membership.id,
            "tenant_id": membership.tenant_id,
            "user_id": membership.user_id,
            "role": membership.role,
            "status": membership.status,
        },
    }


@router.post("/users/bootstrap")
def bootstrap_user(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    email = str(payload.get("email") or "").strip().lower()
    full_name = str(payload.get("full_name") or "").strip() or None
    workspace_name = str(payload.get("workspace_name") or "").strip() or None

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            full_name=full_name,
            is_active=True,
        )
        db.add(user)
        db.flush()
        db.refresh(user)

    tenant = None
    if workspace_name:
        slug = workspace_name.lower().strip().replace(" ", "-")
        tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
        if not tenant:
            tenant = Tenant(name=workspace_name, slug=slug)
            db.add(tenant)
            db.flush()
            db.refresh(tenant)

        ensure_workspace_membership(
            db,
            tenant_id=tenant.id,
            user_id=user.id,
            role="owner",
            invited_by_user_id=user.id,
        )
        user.tenant_id = tenant.id
        user.last_active_tenant_id = tenant.id
        db.add(user)
        db.flush()

    return {
        "ok": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "tenant_id": user.tenant_id,
            "last_active_tenant_id": user.last_active_tenant_id,
        },
        "workspace": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
        } if tenant else None,
    }