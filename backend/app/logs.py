from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class LogEventType(str, Enum):
    ACTION_SUGGESTED = "action_suggested"
    ACTION_APPLIED = "action_applied"
    INFO = "info"


@dataclass
class DebtLogEntry:
    event_type: LogEventType
    message: str
    created_at: datetime = datetime.utcnow()