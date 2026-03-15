from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class BatchJobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None

    # evaluate_rule | execute_rule
    job_type: Literal["evaluate_rule", "execute_rule"]

    rule_id: int
    case_ids: list[int] = Field(default_factory=list)

    execution_params: dict[str, Any] = Field(default_factory=dict)


class BatchJobExecuteRequest(BaseModel):
    force: bool = False


class BatchJobRebuildSummaryRequest(BaseModel):
    pass