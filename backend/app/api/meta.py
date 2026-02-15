from fastapi import APIRouter

from backend.app.contract_rules import CONTRACT_REQUIRED_FIELDS
from backend.app.enums import ContractType, DebtorType

router = APIRouter(prefix="/meta", tags=["Meta"])


@router.get("/contract-types")
def contract_types():
    return [{"code": e.value, "title": e.value} for e in ContractType]


@router.get("/debtor-types")
def debtor_types():
    return [{"code": e.value, "title": e.value} for e in DebtorType]


@router.get("/contract-rules")
def contract_rules():
    return {ct.value: CONTRACT_REQUIRED_FIELDS.get(ct, []) for ct in ContractType}