from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models import CaseWaitingBucket


def utcnow() -> datetime:
    return datetime.utcnow()


def _resolve_waiting_rule(rule_code: str | None) -> tuple[datetime | None, str | None, str | None]:
    if not rule_code:
        return None, None, None

    now = utcnow()

    if rule_code == "wait_after_due_notice":
        return now + timedelta(days=1), "wait_after_due_notice", "Ожидание после напоминания о сроке оплаты"

    if rule_code == "wait_after_debt_notice":
        return now + timedelta(days=7), "wait_after_debt_notice", "Ожидание после уведомления о задолженности"

    if rule_code == "wait_after_pretension":
        return now + timedelta(days=30), "wait_after_pretension", "Ожидание после досудебной претензии"

    if rule_code == "wait_after_court_result":
        return now + timedelta(days=14), "wait_after_court_result", "Ожидание судебного результата / исполнительного документа"

    return None, None, None


def serialize_waiting_bucket(row: CaseWaitingBucket) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if row.payload_json:
        try:
            payload = json.loads(row.payload_json)
        except Exception:
            payload = {}

    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "case_id": row.case_id,
        "playbook_code": row.playbook_code,
        "step_code": row.step_code,
        "bucket_code": row.bucket_code,
        "status": row.status,
        "reason_code": row.reason_code,
        "reason_text": row.reason_text,
        "eligible_at": row.eligible_at.isoformat() if row.eligible_at else None,
        "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
        "payload": payload,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def get_open_waiting_bucket(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
    step_code: str,
) -> CaseWaitingBucket | None:
    return (
        db.query(CaseWaitingBucket)
        .filter(
            CaseWaitingBucket.tenant_id == tenant_id,
            CaseWaitingBucket.case_id == case_id,
            CaseWaitingBucket.step_code == step_code,
            CaseWaitingBucket.status == "waiting",
            CaseWaitingBucket.resolved_at.is_(None),
        )
        .order_by(CaseWaitingBucket.id.desc())
        .first()
    )


def create_or_update_waiting_bucket(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
    playbook_code: str | None,
    step_code: str,
    waiting_rule_code: str | None,
    payload: dict[str, Any] | None = None,
) -> CaseWaitingBucket | None:
    eligible_at, reason_code, reason_text = _resolve_waiting_rule(waiting_rule_code)
    if not eligible_at:
        return None

    row = get_open_waiting_bucket(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
        step_code=step_code,
    )

    if not row:
        row = CaseWaitingBucket(
            tenant_id=tenant_id,
            case_id=case_id,
            playbook_code=playbook_code,
            step_code=step_code,
            bucket_code="waiting_for_eligibility",
            status="waiting",
            reason_code=reason_code,
            reason_text=reason_text,
            eligible_at=eligible_at,
            resolved_at=None,
            payload_json=json.dumps(payload or {}, ensure_ascii=False),
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        db.add(row)
        db.flush()
        return row

    row.playbook_code = playbook_code
    row.bucket_code = "waiting_for_eligibility"
    row.reason_code = reason_code
    row.reason_text = reason_text
    row.eligible_at = eligible_at
    row.payload_json = json.dumps(payload or {}, ensure_ascii=False)
    row.updated_at = utcnow()

    db.add(row)
    db.flush()
    return row


def resolve_waiting_bucket(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
    step_code: str,
) -> int:
    rows = (
        db.query(CaseWaitingBucket)
        .filter(
            CaseWaitingBucket.tenant_id == tenant_id,
            CaseWaitingBucket.case_id == case_id,
            CaseWaitingBucket.step_code == step_code,
            CaseWaitingBucket.status == "waiting",
            CaseWaitingBucket.resolved_at.is_(None),
        )
        .all()
    )

    now = utcnow()
    for row in rows:
        row.status = "resolved"
        row.resolved_at = now
        row.updated_at = now
        db.add(row)

    db.flush()
    return len(rows)


def list_waiting_buckets(
    db: Session,
    *,
    tenant_id: int,
    status: str | None = None,
    bucket_code: str | None = None,
    step_code: str | None = None,
    limit: int = 200,
) -> dict[str, Any]:
    query = db.query(CaseWaitingBucket).filter(CaseWaitingBucket.tenant_id == tenant_id)

    if status:
        query = query.filter(CaseWaitingBucket.status == status)
    if bucket_code:
        query = query.filter(CaseWaitingBucket.bucket_code == bucket_code)
    if step_code:
        query = query.filter(CaseWaitingBucket.step_code == step_code)

    rows = (
        query.order_by(
            CaseWaitingBucket.eligible_at.asc().nullsfirst(),
            CaseWaitingBucket.id.desc(),
        )
        .limit(limit)
        .all()
    )

    return {
        "items": [serialize_waiting_bucket(row) for row in rows],
        "count": len(rows),
    }