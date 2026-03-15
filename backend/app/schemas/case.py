from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CaseCreate(BaseModel):
    debtor_type: str
    debtor_name: str
    contract_type: str
    principal_amount: Decimal
    due_date: date | None = None
    contract_data: dict[str, Any] = Field(default_factory=dict)


class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int | None = None
    debtor_type: str
    debtor_name: str
    contract_type: str
    principal_amount: Decimal
    due_date: date | None = None
    status: str
    contract_data: dict[str, Any] = Field(default_factory=dict)
    is_archived: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None