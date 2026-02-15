from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from pydantic import BaseModel, model_validator

from backend.app.contract_rules import CONTRACT_REQUIRED_FIELDS
from backend.app.enums import ContractType, DebtorType


class CaseCreate(BaseModel):
    debtor_type: DebtorType
    debtor_name: str
    contract_type: ContractType
    principal_amount: Decimal
    due_date: date
    contract_data: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def validate_contract_data(self):
        cd = self.contract_data or {}
        required = CONTRACT_REQUIRED_FIELDS.get(self.contract_type, [])
        missing = [k for k in required if k not in cd]
        if missing:
            raise ValueError(
                f"contract_data missing required fields for {self.contract_type.value}: {missing}"
            )
        self.contract_data = cd
        return self


class CaseResponse(BaseModel):
    id: int
    debtor_type: DebtorType
    debtor_name: str
    contract_type: ContractType
    principal_amount: Decimal
    due_date: date
    status: str
    created_at: datetime
    contract_data: Dict[str, Any]

    class Config:
        from_attributes = True