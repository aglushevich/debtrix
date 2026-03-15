from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PlaybookCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contract_type: str
    description: str | None = None


class PlaybookStepResponse(BaseModel):
    id: int | None = None
    playbook_id: int | None = None
    step_code: str
    title: str
    sequence_no: int
    step_type: str
    action_code: str | None = None
    document_code: str | None = None
    is_manual: bool = True
    is_blocking: bool = True
    eligibility_expr: str | None = None
    waiting_rule_code: str | None = None
    description: str | None = None

    eligible: bool | None = None
    raw_eligible: bool | None = None
    waiting: bool | None = None
    eligible_at: str | None = None
    waiting_reason: str | None = None


class PlaybookResponse(BaseModel):
    playbook: dict[str, Any] | None = None
    steps: list[PlaybookStepResponse] = []
    current_step: dict[str, Any] | None = None
    next_actions: list[dict[str, Any]] = []
    waiting_buckets: list[dict[str, Any]] = []
    blocked_steps: list[dict[str, Any]] = []
    context: dict[str, Any] = {}