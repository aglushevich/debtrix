from __future__ import annotations

from sqlalchemy.orm import Session

from backend.app.models import Case, PlaybookDefinition


def resolve_playbook_for_case(db: Session, case: Case) -> PlaybookDefinition | None:
    """
    Правило выбора playbook:
    1. Точное совпадение contract_type + debtor_type
    2. fallback только по contract_type
    3. fallback по активному playbook без привязки
    """

    contract_type = case.contract_type.value if hasattr(case.contract_type, "value") else str(case.contract_type)
    debtor_type = case.debtor_type.value if hasattr(case.debtor_type, "value") else str(case.debtor_type)

    exact = (
        db.query(PlaybookDefinition)
        .filter(
            PlaybookDefinition.is_active.is_(True),
            PlaybookDefinition.contract_type == contract_type,
            PlaybookDefinition.debtor_type == debtor_type,
        )
        .order_by(PlaybookDefinition.version.desc(), PlaybookDefinition.id.desc())
        .first()
    )
    if exact:
        return exact

    by_contract = (
        db.query(PlaybookDefinition)
        .filter(
            PlaybookDefinition.is_active.is_(True),
            PlaybookDefinition.contract_type == contract_type,
            PlaybookDefinition.debtor_type.is_(None),
        )
        .order_by(PlaybookDefinition.version.desc(), PlaybookDefinition.id.desc())
        .first()
    )
    if by_contract:
        return by_contract

    fallback = (
        db.query(PlaybookDefinition)
        .filter(
            PlaybookDefinition.is_active.is_(True),
            PlaybookDefinition.contract_type.is_(None),
            PlaybookDefinition.debtor_type.is_(None),
        )
        .order_by(PlaybookDefinition.version.desc(), PlaybookDefinition.id.desc())
        .first()
    )
    return fallback