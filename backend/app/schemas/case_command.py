from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, List, Optional

from pydantic import BaseModel, Field


# ---------------------------
# REQUEST
# ---------------------------

class CaseCommandCreateRequest(BaseModel):
    debtor_type: str = Field(..., min_length=1, max_length=64)
    contract_type: str = Field(..., min_length=1, max_length=64)

    debtor_name: Optional[str] = Field(default=None, max_length=500)

    principal_amount: Decimal
    due_date: Optional[date] = None

    debtor_inn: Optional[str] = Field(default=None, max_length=12)
    debtor_ogrn: Optional[str] = Field(default=None, max_length=15)

    note: Optional[str] = None
    contract_data: Optional[dict[str, Any]] = None

    auto_lookup_organization: bool = True
    auto_fill_debtor_name: bool = True


# ---------------------------
# COMMON BLOCKS
# ---------------------------

class ReadinessBlock(BaseModel):
    score: Optional[int] = None
    level: Optional[str] = None
    warnings: List[str] = []
    signals: List[str] = []


class DuplicateItem(BaseModel):
    case_id: Optional[int]
    name: Optional[str]
    inn: Optional[str]
    ogrn: Optional[str]


class OrganizationBlock(BaseModel):
    name: Optional[str] = None
    name_full: Optional[str] = None
    name_short: Optional[str] = None
    inn: Optional[str] = None
    ogrn: Optional[str] = None
    kpp: Optional[str] = None
    address: Optional[str] = None
    director_name: Optional[str] = None
    status: Optional[str] = None
    registration_date: Optional[str] = None
    okved_main: Optional[str] = None
    source: Optional[str] = None


class SmartBlock(BaseModel):
    readiness_score: Optional[int]
    readiness_level: Optional[str]
    warnings: List[str] = []
    signals: List[str] = []

    organization: Optional[dict[str, Any]] = None
    duplicates: List[DuplicateItem] = []

    completeness: Optional[dict[str, bool]] = None


# ---------------------------
# PREVIEW RESPONSE
# ---------------------------

class CaseCommandCreatePreviewData(BaseModel):
    resolved_debtor_name: Optional[str] = None
    normalized_inn: Optional[str] = None
    normalized_ogrn: Optional[str] = None

    warnings: List[str] = []
    hints: List[str] = []

    payload: Optional[dict[str, Any]] = None

    readiness: Optional[ReadinessBlock] = None
    duplicates_found: List[DuplicateItem] = []

    organization: Optional[OrganizationBlock] = None


class CaseCommandCreatePreviewResponse(BaseModel):
    ok: bool
    preview: Optional[CaseCommandCreatePreviewData] = None


# ---------------------------
# CREATE RESPONSE
# ---------------------------

class CaseCommandCreateResponse(BaseModel):
    ok: bool

    case: dict[str, Any]

    smart: Optional[SmartBlock] = None

    command: dict[str, Any]

    preview: Optional[CaseCommandCreatePreviewData] = None