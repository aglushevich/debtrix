from sqlalchemy.orm import Session
from backend.app.models.execution_event import ExecutionEvent


def log_execution_event(
    db: Session,
    case_id: int,
    tenant_id: int,
    action_code: str,
    status: str,
    reason: str | None = None,
    payload: dict | None = None,
    result: dict | None = None,
):

    event = ExecutionEvent(
        case_id=case_id,
        tenant_id=tenant_id,
        action_code=action_code,
        status=status,
        reason=reason,
        payload=payload,
        result=result,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event


def get_case_execution_history(db: Session, case_id: int):

    rows = (
        db.query(ExecutionEvent)
        .filter(ExecutionEvent.case_id == case_id)
        .order_by(ExecutionEvent.created_at.desc())
        .limit(50)
        .all()
    )

    return [
        {
            "id": r.id,
            "action_code": r.action_code,
            "status": r.status,
            "reason": r.reason,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]