from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from backend.app.config import DEFAULT_TENANT_NAME, DEFAULT_TENANT_SLUG
from backend.app.models import (
    AutomationRule,
    AutomationRun,
    BatchJob,
    BatchJobItem,
    Case,
    CaseIntegration,
    CaseParticipant,
    CasePlaybook,
    CaseProjection,
    CaseWaitingBucket,
    DebtorProfile,
    DocumentTemplate,
    EsiaSession,
    ExternalAction,
    GeneratedDocument,
    Organization,
    OutboundDispatch,
    Party,
    PortfolioView,
    Tenant,
    TimelineEvent,
    User,
    WorkspaceInvite,
    WorkspaceMembership,
)


TENANT_BOUND_MODELS: list[type[Any]] = [
    User,
    Organization,
    Party,
    Case,
    CaseParticipant,
    DebtorProfile,
    TimelineEvent,
    CaseProjection,
    CaseIntegration,
    CaseWaitingBucket,
    ExternalAction,
    EsiaSession,
    OutboundDispatch,
    AutomationRule,
    AutomationRun,
    BatchJob,
    BatchJobItem,
    PortfolioView,
    CasePlaybook,
    DocumentTemplate,
    GeneratedDocument,
    WorkspaceMembership,
    WorkspaceInvite,
]


def get_default_tenant(db: Session) -> Tenant | None:
    return db.query(Tenant).filter(Tenant.slug == DEFAULT_TENANT_SLUG).first()


def get_or_create_default_tenant(db: Session) -> Tenant:
    tenant = get_default_tenant(db)
    if tenant:
        return tenant

    now = datetime.utcnow()
    tenant = Tenant(
        name=DEFAULT_TENANT_NAME,
        slug=DEFAULT_TENANT_SLUG,
        created_at=now,
        updated_at=now,
    )
    db.add(tenant)
    db.flush()
    return tenant


def ensure_user_tenant(db: Session, user: User) -> Tenant:
    if getattr(user, "tenant_id", None):
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant:
            return tenant

    fallback_slug = f"user-{user.id}"
    tenant = db.query(Tenant).filter(Tenant.slug == fallback_slug).first()

    if tenant:
        user.tenant_id = tenant.id
        user.updated_at = datetime.utcnow()
        db.add(user)
        db.flush()
        return tenant

    now = datetime.utcnow()
    tenant = Tenant(
        name=user.full_name or user.email or f"User {user.id}",
        slug=fallback_slug,
        created_at=now,
        updated_at=now,
    )
    db.add(tenant)
    db.flush()

    user.tenant_id = tenant.id
    user.updated_at = now
    db.add(user)
    db.flush()

    return tenant


def _backfill_model_tenant_ids(db: Session, model: type[Any], tenant_id: int) -> int:
    if not hasattr(model, "tenant_id"):
        return 0

    updated = (
        db.query(model)
        .filter(model.tenant_id.is_(None))
        .update({"tenant_id": tenant_id}, synchronize_session=False)
    )
    return int(updated or 0)


def bootstrap_tenants_for_existing_data(db: Session) -> dict:
    created_tenants = 0
    backfilled: dict[str, int] = {}

    tenant = get_default_tenant(db)
    if tenant is None:
        tenant = get_or_create_default_tenant(db)
        created_tenants += 1

    for model in TENANT_BOUND_MODELS:
        updated_count = _backfill_model_tenant_ids(db, model, tenant.id)
        if updated_count:
            backfilled[model.__name__] = updated_count

    return {
        "ok": True,
        "default_tenant_id": tenant.id,
        "created_tenants": created_tenants,
        "backfilled": backfilled,
    }