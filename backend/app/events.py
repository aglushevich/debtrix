from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.models import TimelineEvent


class CaseEventType(str, Enum):
    CASE_CREATED = "case_created"
    CASE_UPDATED = "case_updated"
    STAGE_ACTION_APPLIED = "stage_action_applied"
    RECOVERY_INITIALIZED = "recovery_initialized"
    ACCRUED_UPDATED = "accrued_updated"
    PAYMENT_ADDED = "payment_added"
    OVERPAID_DETECTED = "overpaid_detected"
    CASE_CLOSED = "case_closed"
    DEBTOR_IDENTIFIED = "debtor_identified"
    DEBTOR_PROFILE_REFRESHED = "debtor_profile_refreshed"

    AUTOMATION_RUN_STARTED = "automation_run_started"
    AUTOMATION_RUN_FINISHED = "automation_run_finished"
    AUTOMATION_ITEM_DONE = "automation_item_done"
    AUTOMATION_ITEM_FAILED = "automation_item_failed"
    AUTOMATION_ITEM_BLOCKED = "automation_item_blocked"
    AUTOMATION_ITEM_WAITING = "automation_item_waiting"
    AUTOMATION_ITEM_NOT_APPLICABLE = "automation_item_not_applicable"

    BATCH_JOB_STARTED = "batch_job_started"
    BATCH_JOB_FINISHED = "batch_job_finished"
    BATCH_ITEM_DONE = "batch_item_done"
    BATCH_ITEM_FAILED = "batch_item_failed"
    BATCH_ITEM_BLOCKED = "batch_item_blocked"
    BATCH_ITEM_WAITING = "batch_item_waiting"
    BATCH_ITEM_NOT_APPLICABLE = "batch_item_not_applicable"


@dataclass(frozen=True)
class CaseEvent:
    case_id: int
    type: CaseEventType
    title: str
    details: str = ""
    payload: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    dedup_key: Optional[str] = None


def _payload_to_details(details: str, payload: Optional[Dict[str, Any]]) -> str:
    details = details or ""
    if payload:
        pairs = ", ".join([f"{k}={v}" for k, v in payload.items()])
        details = (details + "\n" if details else "") + f"payload: {pairs}"
    return details


def emit_event(db: Session, event: CaseEvent) -> TimelineEvent:
    created_at = event.created_at or datetime.utcnow()
    details = _payload_to_details(event.details, event.payload)

    row = TimelineEvent(
        case_id=event.case_id,
        event_type=event.type.value,
        title=event.title,
        details=details,
        created_at=created_at,
        dedup_key=event.dedup_key,
    )
    db.add(row)
    return row


def emit_event_once(db: Session, event: CaseEvent, dedup_key: str) -> Optional[TimelineEvent]:
    created_at = event.created_at or datetime.utcnow()
    details = _payload_to_details(event.details, event.payload)

    try:
        with db.begin_nested():
            row = TimelineEvent(
                case_id=event.case_id,
                event_type=event.type.value,
                title=event.title,
                details=details,
                created_at=created_at,
                dedup_key=dedup_key,
            )
            db.add(row)
            db.flush()
            return row
    except IntegrityError:
        return None