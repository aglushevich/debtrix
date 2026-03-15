from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Query, Session

from backend.app.models import Case, CaseParticipant, DebtorProfile, Tenant
from backend.app.services.tenant_service import get_or_create_default_tenant


def current_tenant_id(db: Session) -> int:
    tenant = get_or_create_default_tenant(db)
    return tenant.id


def resolve_current_tenant_id(db: Session, tenant_id: int | None) -> int:
    if tenant_id is None:
        return current_tenant_id(db)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return tenant.id


def filter_cases_by_tenant(
    query: Query,
    tenant_id: int,
    *,
    include_archived: bool = False,
) -> Query:
    query = query.filter(Case.tenant_id == tenant_id)
    if not include_archived:
        query = query.filter(Case.is_archived.is_(False))
    return query


def load_case_for_tenant_or_404(
    db: Session,
    case_id: int,
    tenant_id: int,
    *,
    include_archived: bool = False,
) -> Case:
    query = db.query(Case).filter(
        Case.id == case_id,
        Case.tenant_id == tenant_id,
    )

    if not include_archived:
        query = query.filter(Case.is_archived.is_(False))

    case = query.first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return case


def filter_case_participants_by_tenant(query: Query, tenant_id: int) -> Query:
    return query.filter(CaseParticipant.tenant_id == tenant_id)


def filter_debtor_profiles_by_tenant(query: Query, tenant_id: int) -> Query:
    return query.filter(DebtorProfile.tenant_id == tenant_id)