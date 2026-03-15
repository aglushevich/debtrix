from __future__ import annotations

from sqlalchemy.orm import Session

from backend.app.models.creditor_profile import CreditorProfile


def get_creditor_profile(db: Session, tenant_id: int) -> CreditorProfile | None:
    return (
        db.query(CreditorProfile)
        .filter(
            CreditorProfile.tenant_id == tenant_id,
            CreditorProfile.is_active == True,
        )
        .first()
    )


def ensure_creditor_profile(
    db: Session,
    tenant_id: int,
) -> CreditorProfile:

    profile = get_creditor_profile(db, tenant_id)

    if profile:
        return profile

    profile = CreditorProfile(
        tenant_id=tenant_id,
        name="Компания-взыскатель",
        signer_name="Генеральный директор",
        signer_basis="действует на основании устава",
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile