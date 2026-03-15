from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class DebtorIdentifyRequest(BaseModel):
    inn: str | None = None
    ogrn: str | None = None


class DebtorRefreshRequest(BaseModel):
    inn: str | None = None
    ogrn: str | None = None


class DebtorProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    tenant_id: int | None = None
    inn: str | None = None
    ogrn: str | None = None
    name: str | None = None
    address: str | None = None
    director_name: str | None = None
    source: str | None = None
    raw: dict[str, Any] | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None