from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class AutomationRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None

    scope_type: Literal["case", "portfolio"] = "case"
    trigger_code: str = "manual"

    action_code: Literal["prepare_external_action"]
    execution_mode: Literal["manual_review", "auto_execute"] = "manual_review"

    priority: int = 100
    cooldown_seconds: int = 0

    filters: dict[str, Any] = Field(default_factory=dict)
    action_params: dict[str, Any] = Field(default_factory=dict)

    eligible_from: datetime | None = None
    eligible_until: datetime | None = None


class AutomationRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None

    is_enabled: bool | None = None

    scope_type: Literal["case", "portfolio"] | None = None
    trigger_code: str | None = None

    action_code: Literal["prepare_external_action"] | None = None
    execution_mode: Literal["manual_review", "auto_execute"] | None = None

    priority: int | None = None
    cooldown_seconds: int | None = None

    filters: dict[str, Any] | None = None
    action_params: dict[str, Any] | None = None

    eligible_from: datetime | None = None
    eligible_until: datetime | None = None


class AutomationEvaluateRequest(BaseModel):
    execute: bool = False


class AutomationRunExecuteRequest(BaseModel):
    force: bool = False


class AutomationRunStartRequest(BaseModel):
    rule_id: int
    case_ids: list[int] = Field(default_factory=list)
    requested_by: str | None = None


class AutomationRunCreate(BaseModel):
    case_id: int
    input_payload: dict[str, Any] = Field(default_factory=dict)
    dedup_key: str | None = None