from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.enums import ContractType, DebtorType
from backend.app.models import Case
from backend.app.services.case_service import sync_and_persist_case
from backend.app.services.debtor_entity_service import upsert_debtor_for_case
from backend.app.services.tenant_service import get_or_create_default_tenant


def ensure_demo_case(db: Session) -> Case:
    tenant = get_or_create_default_tenant(db)

    existing = (
        db.query(Case)
        .filter(
            Case.tenant_id == tenant.id,
            Case.debtor_name == "ООО Тест",
        )
        .order_by(Case.id.asc())
        .first()
    )
    if existing:
        return existing

    case = Case(
        tenant_id=tenant.id,
        debtor_type=DebtorType.company,
        debtor_name="ООО Тест",
        contract_type=ContractType.supply,
        principal_amount=Decimal("10000.00"),
        due_date=date(2026, 2, 1),
        status="overdue",
        contract_data={
            "debtor": {
                "inn": "4205301694",
                "ogrn": "1154205000674",
            },
            "creditor": {
                "name": "ООО Кредитор",
                "inn": "7701234567",
                "ogrn": "1027700000000",
            },
        },
    )
    db.add(case)
    db.flush()
    db.refresh(case)

    upsert_debtor_for_case(db, case)
    sync_and_persist_case(db, case)

    return case


def bootstrap_demo_data(db: Session) -> dict:
    tenant = get_or_create_default_tenant(db)
    case = ensure_demo_case(db)

    return {
        "ok": True,
        "tenant_id": tenant.id,
        "case_id": case.id,
        "debtor_name": case.debtor_name,
    }