from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class BatchPreviewRequest(BaseModel):
    action_code: str
    case_ids: list[int] = Field(default_factory=list)


class BatchExecuteRequest(BaseModel):
    action_code: str
    case_ids: list[int] = Field(default_factory=list)
    force: bool = False


class BatchPreviewItemResponse(BaseModel):
    case_id: int
    bucket: str
    reason: str | None = None
    eligible_at: str | None = None


class BatchPreviewBucketResponse(BaseModel):
    key: str
    title: str
    count: int
    case_ids: list[int] = Field(default_factory=list)


class BatchPreviewResponse(BaseModel):
    ok: bool = True
    action_code: str
    total_selected: int
    preview: dict[str, BatchPreviewBucketResponse]
    items: list[BatchPreviewItemResponse] = Field(default_factory=list)


class BatchExecuteItemResponse(BaseModel):
    case_id: int
    status: str
    reason: str | None = None
    eligible_at: str | None = None
    payload: dict[str, Any] | None = None


class BatchExecuteResponse(BaseModel):
    ok: bool = True
    action_code: str
    total_selected: int
    queued: int
    results: list[BatchExecuteItemResponse] = Field(default_factory=list)
    summary: dict[str, int] = Field(default_factory=dict)