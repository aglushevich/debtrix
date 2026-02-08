from enum import Enum
from datetime import datetime


class LogEventType(str, Enum):
    ACTION_SUGGESTED = "action_suggested"
    ACTION_CONFIRMED = "action_confirmed"
    STATUS_CHANGED = "status_changed"


class DebtLogEntry:
    def __init__(
        self,
        event_type: LogEventType,
        message: str,
        created_at: datetime | None = None,
    ):
        self.event_type = event_type
        self.message = message
        self.created_at = created_at or datetime.utcnow()