from __future__ import annotations

from pydantic import BaseModel, Field


class BatchJobStartRequest(BaseModel):
    rule_id: int
    case_ids: list[int] = Field(default_factory=list)
    requested_by: str | None = None
    title: str | None = None