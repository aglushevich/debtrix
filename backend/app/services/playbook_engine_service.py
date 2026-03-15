from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.app.models import Case, PlaybookDefinition, PlaybookStep
from backend.app.services.eligibility_service import (
    build_case_eligibility_context,
    compute_blockers_for_step,
)
from backend.app.services.playbook_resolution_service import resolve_playbook_for_case
from backend.app.services.waiting_bucket_service import (
    create_or_update_waiting_bucket,
    resolve_waiting_bucket,
)


def _serialize_step(step: PlaybookStep) -> dict[str, Any]:
    return {
        "id": step.id,
        "playbook_id": step.playbook_id,
        "step_code": step.step_code,
        "title": step.title,
        "sequence_no": step.sequence_no,
        "step_type": step.step_type,
        "action_code": step.action_code,
        "document_code": step.document_code,
        "is_manual": step.is_manual,
        "is_blocking": step.is_blocking,
        "eligibility_expr": step.eligibility_expr,
        "waiting_rule_code": step.waiting_rule_code,
        "description": step.description,
    }


def _serialize_playbook(playbook: PlaybookDefinition | None) -> dict[str, Any] | None:
    if not playbook:
        return None

    return {
        "id": playbook.id,
        "code": playbook.code,
        "title": playbook.title,
        "contract_type": playbook.contract_type,
        "debtor_type": playbook.debtor_type,
        "is_active": playbook.is_active,
        "version": playbook.version,
        "description": playbook.description,
        "created_at": playbook.created_at.isoformat() if playbook.created_at else None,
        "updated_at": playbook.updated_at.isoformat() if playbook.updated_at else None,
    }


def evaluate_case_playbook(
    db: Session,
    case: Case,
    *,
    tenant_id: int,
    persist_waiting_buckets: bool = True,
) -> dict[str, Any]:
    playbook = resolve_playbook_for_case(db, case)
    context = build_case_eligibility_context(case)

    if not playbook:
        return {
            "playbook": None,
            "steps": [],
            "current_step": None,
            "next_actions": [],
            "waiting_buckets": [],
            "blocked_steps": [],
            "context": context,
        }

    steps = (
        db.query(PlaybookStep)
        .filter(PlaybookStep.playbook_id == playbook.id)
        .order_by(PlaybookStep.sequence_no.asc(), PlaybookStep.id.asc())
        .all()
    )

    evaluated_steps: list[dict[str, Any]] = []
    waiting_buckets: list[dict[str, Any]] = []
    blocked_steps: list[dict[str, Any]] = []
    next_actions: list[dict[str, Any]] = []
    current_step: dict[str, Any] | None = None

    for step in steps:
        blockers = compute_blockers_for_step(step, context)
        raw_eligible = len(blockers) == 0

        waiting_row = None
        if raw_eligible and step.waiting_rule_code:
            if persist_waiting_buckets:
                waiting_row = create_or_update_waiting_bucket(
                    db,
                    tenant_id=tenant_id,
                    case_id=case.id,
                    playbook_code=playbook.code,
                    step_code=step.step_code,
                    waiting_rule_code=step.waiting_rule_code,
                    payload={
                        "case_id": case.id,
                        "playbook_code": playbook.code,
                        "step_code": step.step_code,
                        "action_code": step.action_code,
                    },
                )
        else:
            if persist_waiting_buckets:
                resolve_waiting_bucket(
                    db,
                    tenant_id=tenant_id,
                    case_id=case.id,
                    step_code=step.step_code,
                )

        waiting = waiting_row is not None

        step_row = {
            **_serialize_step(step),
            "eligible": raw_eligible and not waiting,
            "raw_eligible": raw_eligible,
            "waiting": waiting,
            "eligible_at": waiting_row.eligible_at.isoformat() if waiting_row and waiting_row.eligible_at else None,
            "waiting_reason": waiting_row.reason_text if waiting_row else None,
            "blockers": blockers,
        }
        evaluated_steps.append(step_row)

        if waiting:
            waiting_buckets.append(step_row)
            continue

        if raw_eligible:
            if current_step is None:
                current_step = step_row

            next_actions.append(
                {
                    "step_code": step.step_code,
                    "title": step.title,
                    "step_type": step.step_type,
                    "action_code": step.action_code,
                    "document_code": step.document_code,
                    "eligible_at": None,
                }
            )

            if step.is_blocking:
                break
        else:
            blocked_steps.append(step_row)

    return {
        "playbook": _serialize_playbook(playbook),
        "steps": evaluated_steps,
        "current_step": current_step,
        "next_actions": next_actions,
        "waiting_buckets": waiting_buckets,
        "blocked_steps": blocked_steps,
        "context": context,
    }