from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SnapshotResponse(BaseModel):
    case_id: int
    updated_at: datetime | None = None
    data: dict[str, Any] = Field(default_factory=dict)