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


class BatchCaseSnapshotResponse(BaseModel):
    case_id: int
    debtor_name: str | None = None
    contract_type: str | None = None
    debtor_type: str | None = None
    status: str | None = None
    lane: str | None = None
    is_archived: bool = False


class BatchPreviewItemResponse(BaseModel):
    case_id: int
    bucket: str
    reason: str | None = None
    eligible_at: str | None = None
    snapshot: BatchCaseSnapshotResponse | None = None


class BatchPreviewBucketResponse(BaseModel):
    key: str
    title: str
    count: int
    case_ids: list[int] = Field(default_factory=list)


class BatchGuardrailWarningResponse(BaseModel):
    code: str
    message: str
    severity: str


class BatchGuardrailSelectionResponse(BaseModel):
    total_cases: int = 0
    archived_cases: int = 0
    counts_by_contract_type: dict[str, int] = Field(default_factory=dict)
    counts_by_debtor_type: dict[str, int] = Field(default_factory=dict)
    counts_by_status: dict[str, int] = Field(default_factory=dict)
    counts_by_lane: dict[str, int] = Field(default_factory=dict)
    counts_by_bucket: dict[str, int] = Field(default_factory=dict)


class BatchGuardrailsResponse(BaseModel):
    is_homogeneous: bool = False
    recommended_mode: str = "review_before_run"
    recommended_action: str = ""
    warnings: list[BatchGuardrailWarningResponse] = Field(default_factory=list)
    selection: BatchGuardrailSelectionResponse = Field(
        default_factory=BatchGuardrailSelectionResponse
    )
    force_used: bool | None = None
    executed_cases: int | None = None


class BatchSuggestedSubsetResponse(BaseModel):
    code: str
    title: str
    description: str
    count: int
    case_ids: list[int] = Field(default_factory=list)
    recommended: bool = False


class BatchPreviewResponse(BaseModel):
    ok: bool = True
    action_code: str
    total_selected: int
    preview: dict[str, BatchPreviewBucketResponse]
    items: list[BatchPreviewItemResponse] = Field(default_factory=list)
    guardrails: BatchGuardrailsResponse | None = None
    subsets: list[BatchSuggestedSubsetResponse] = Field(default_factory=list)
    recommended_subset_code: str | None = None


class BatchExecuteItemResponse(BaseModel):
    case_id: int
    status: str
    reason: str | None = None
    eligible_at: str | None = None
    payload: dict[str, Any] | None = None
    snapshot: BatchCaseSnapshotResponse | None = None


class BatchExecuteResponse(BaseModel):
    ok: bool = True
    action_code: str
    total_selected: int
    queued: int
    results: list[BatchExecuteItemResponse] = Field(default_factory=list)
    summary: dict[str, int] = Field(default_factory=dict)
    guardrails: BatchGuardrailsResponse | None = None