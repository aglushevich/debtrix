from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class PortfolioQueryFilters(BaseModel):
    case_ids: list[int] = Field(default_factory=list)

    case_status_in: list[str] = Field(default_factory=list)
    contract_type_in: list[str] = Field(default_factory=list)
    debtor_type_in: list[str] = Field(default_factory=list)

    min_days_overdue: int | None = None
    max_days_overdue: int | None = None

    require_debtor_identifiers: bool = False
    include_archived: bool = False

    has_waiting_runs: bool | None = None
    has_blocked_runs: bool | None = None
    has_pending_runs: bool | None = None
    has_external_actions: bool | None = None

    search: str | None = None


class PortfolioQueryRequest(BaseModel):
    filters: PortfolioQueryFilters = Field(default_factory=PortfolioQueryFilters)
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)
    order_by: Literal[
        "id_desc",
        "id_asc",
        "due_date_asc",
        "due_date_desc",
        "principal_amount_desc",
        "principal_amount_asc",
    ] = "id_desc"


class PortfolioViewCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    is_default: bool = False
    is_shared: bool = False

    filters: dict[str, Any] = Field(default_factory=dict)
    sorting: dict[str, Any] = Field(default_factory=dict)
    columns: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)


class PortfolioViewUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    is_default: bool | None = None
    is_shared: bool | None = None

    filters: dict[str, Any] | None = None
    sorting: dict[str, Any] | None = None
    columns: dict[str, Any] | None = None
    meta: dict[str, Any] | None = None


class PortfolioBatchFromViewCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    job_type: Literal["evaluate_rule", "execute_rule"]
    rule_id: int
    execution_params: dict[str, Any] = Field(default_factory=dict)
    limit: int = Field(default=1000, ge=1, le=10000)


class PortfolioRoutingSummaryResponse(BaseModel):
    total: int
    ready: int
    waiting: int
    blocked: int
    idle: int


class PortfolioRoutingResponse(BaseModel):
    summary: PortfolioRoutingSummaryResponse
    buckets: dict[str, list[dict[str, Any]]]


class WaitingBucketsResponse(BaseModel):
    items: list[dict[str, Any]]
    count: int