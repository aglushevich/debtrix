from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.events import CaseEvent, CaseEventType, emit_event
from backend.app.models import AutomationRule, AutomationRun, AutomationRunItem, Case
from backend.app.services.external_action_service import prepare_external_action
from backend.app.services.fssp_sync_service import run_fssp_case_check
from backend.app.services.tenant_query_service import current_tenant_id


def _utcnow() -> datetime:
    return datetime.utcnow()


def _dump(value: dict[str, Any] | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def _load(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return parsed
        return {}
    except Exception:
        return {}


def _serialize_run(run: AutomationRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "tenant_id": run.tenant_id,
        "rule_id": run.rule_id,
        "rule_code": run.rule_code,
        "scope_type": run.scope_type,
        "trigger_type": run.trigger_type,
        "status": run.status,
        "total_items": run.total_items,
        "queued_items": run.queued_items,
        "success_items": run.success_items,
        "failed_items": run.failed_items,
        "blocked_items": run.blocked_items,
        "waiting_items": run.waiting_items,
        "not_applicable_items": run.not_applicable_items,
        "requested_by": run.requested_by,
        "correlation_id": run.correlation_id,
        "payload": _load(run.payload_json),
        "result": _load(run.result_json),
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
        "external_action_id": _load(run.result_json).get("external_action_id"),
        "eligibility_code": _load(run.result_json).get("eligibility_code"),
        "eligibility_reason": _load(run.result_json).get("eligibility_reason"),
        "eligible_at": _load(run.result_json).get("eligible_at"),
        "evaluation_payload": _load(run.payload_json),
    }


def _serialize_run_item(item: AutomationRunItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "run_id": item.run_id,
        "case_id": item.case_id,
        "status": item.status,
        "reason_code": item.reason_code,
        "reason_text": item.reason_text,
        "action_code": item.action_code,
        "eligible_at": item.eligible_at.isoformat() if item.eligible_at else None,
        "execution_started_at": (
            item.execution_started_at.isoformat() if item.execution_started_at else None
        ),
        "execution_finished_at": (
            item.execution_finished_at.isoformat() if item.execution_finished_at else None
        ),
        "payload": _load(item.payload_json),
        "result": _load(item.result_json),
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _get_rule_or_404(
    db: Session,
    *,
    rule_id: int,
    tenant_id: int,
) -> AutomationRule:
    item = (
        db.query(AutomationRule)
        .filter(
            AutomationRule.id == rule_id,
            AutomationRule.tenant_id == tenant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    return item


def get_automation_run_or_404(
    db: Session,
    *,
    run_id: int,
    tenant_id: int | None = None,
) -> AutomationRun:
    tenant_id = tenant_id or current_tenant_id(db)

    item = (
        db.query(AutomationRun)
        .filter(
            AutomationRun.id == run_id,
            AutomationRun.tenant_id == tenant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Automation run not found")
    return item


def list_automation_runs(
    db: Session,
    *,
    tenant_id: int | None = None,
    case_id: int | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    query = db.query(AutomationRun).filter(AutomationRun.tenant_id == tenant_id)

    if case_id is not None:
        query = query.filter(AutomationRun.case_id == case_id)
    if status:
        query = query.filter(AutomationRun.status == status)

    items = query.order_by(AutomationRun.id.desc()).limit(200).all()

    return {"items": [_serialize_run(item) for item in items]}


def get_automation_run_detail(
    db: Session,
    *,
    run_id: int,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)
    run = get_automation_run_or_404(db, run_id=run_id, tenant_id=tenant_id)

    items = (
        db.query(AutomationRunItem)
        .filter(
            AutomationRunItem.run_id == run.id,
            AutomationRunItem.tenant_id == tenant_id,
        )
        .order_by(AutomationRunItem.id.asc())
        .all()
    )

    return {
        "run": _serialize_run(run),
        "items": [_serialize_run_item(item) for item in items],
    }


def _evaluate_case_eligibility(
    case: Case,
    *,
    rule: AutomationRule,
) -> dict[str, Any]:
    eligibility = _load(rule.eligibility_json)
    debtor = dict((case.contract_data or {}).get("debtor") or {})

    case_status_value = getattr(case.status, "value", case.status)

    if eligibility.get("requires_case_open") and case_status_value == "closed":
        return {
            "status": "not_applicable",
            "reason_code": "case_closed",
            "reason_text": "Дело закрыто.",
            "eligible_at": None,
        }

    if eligibility.get("requires_identifiers"):
        if not (debtor.get("inn") or debtor.get("ogrn") or case.debtor_name):
            return {
                "status": "blocked",
                "reason_code": "missing_debtor_identifiers",
                "reason_text": "Не хватает debtor_name / inn / ogrn для выполнения.",
                "eligible_at": None,
            }

    due_date = getattr(case, "due_date", None)
    if due_date and due_date > _utcnow().date():
        eligible_at = datetime.combine(due_date, datetime.min.time())
        return {
            "status": "waiting",
            "reason_code": "not_due_yet",
            "reason_text": "Срок оплаты еще не наступил.",
            "eligible_at": eligible_at,
        }

    return {
        "status": "eligible",
        "reason_code": None,
        "reason_text": None,
        "eligible_at": None,
    }


def _execute_case_action(
    db: Session,
    *,
    case: Case,
    tenant_id: int,
    rule: AutomationRule,
) -> dict[str, Any]:
    action_code = rule.action_code or ""

    if action_code == "check_fssp":
        result = run_fssp_case_check(db, case=case, tenant_id=tenant_id)
        return {
            "status": "done" if result.get("ok") else "failed",
            "result": result,
            "external_action_id": None,
        }

    if action_code == "send_to_fssp":
        result = prepare_external_action(
            db,
            case_id=case.id,
            action_code="send_to_fssp",
            tenant_id=tenant_id,
        )
        external_action_id = ((result or {}).get("action") or {}).get("id")
        return {
            "status": "done" if result.get("ok") else "failed",
            "result": result,
            "external_action_id": external_action_id,
        }

    if action_code == "send_payment_due_notice":
        return {
            "status": "done",
            "result": {
                "ok": True,
                "kind": "scaffold",
                "action_code": action_code,
                "message": "Scaffold automation action completed.",
            },
            "external_action_id": None,
        }

    return {
        "status": "not_applicable",
        "result": {
            "ok": False,
            "reason": f"Unsupported automation action_code={action_code}",
        },
        "external_action_id": None,
    }


def _recount_run(run: AutomationRun, items: list[AutomationRunItem]) -> None:
    run.total_items = len(items)
    run.queued_items = sum(1 for item in items if item.status == "queued")
    run.success_items = sum(1 for item in items if item.status in {"done", "succeeded"})
    run.failed_items = sum(1 for item in items if item.status == "failed")
    run.blocked_items = sum(1 for item in items if item.status == "blocked")
    run.waiting_items = sum(1 for item in items if item.status == "waiting")
    run.not_applicable_items = sum(
        1 for item in items if item.status == "not_applicable"
    )

    if run.queued_items > 0:
        run.status = "running"
    elif run.failed_items > 0 and run.success_items == 0:
        run.status = "failed"
    elif run.waiting_items > 0 and run.success_items == 0:
        run.status = "waiting"
    elif run.blocked_items > 0 and run.success_items == 0:
        run.status = "blocked"
    else:
        run.status = "finished"


def start_automation_run_for_cases(
    db: Session,
    *,
    rule_id: int,
    case_ids: list[int],
    tenant_id: int | None = None,
    requested_by: str | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    if not case_ids:
        raise HTTPException(status_code=422, detail="case_ids is required")

    rule = _get_rule_or_404(db, rule_id=rule_id, tenant_id=tenant_id)
    if not rule.is_enabled:
        raise HTTPException(status_code=409, detail="Automation rule is disabled")

    cases = (
        db.query(Case)
        .filter(
            Case.tenant_id == tenant_id,
            Case.id.in_(case_ids),
        )
        .order_by(Case.id.asc())
        .all()
    )

    found_ids = {case.id for case in cases}
    missing_ids = [case_id for case_id in case_ids if case_id not in found_ids]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Cases not found for tenant: {missing_ids}",
        )

    now = _utcnow()
    correlation_id = f"automation-{rule.code}-{int(now.timestamp())}"

    run = AutomationRun(
        tenant_id=tenant_id,
        rule_id=rule.id,
        rule_code=rule.code,
        scope_type=rule.scope_type,
        trigger_type="manual",
        status="running",
        total_items=0,
        queued_items=0,
        success_items=0,
        failed_items=0,
        blocked_items=0,
        waiting_items=0,
        not_applicable_items=0,
        requested_by=requested_by,
        correlation_id=correlation_id,
        payload_json=_dump(
            {
                "case_ids": case_ids,
                "rule": {
                    "id": rule.id,
                    "code": rule.code,
                    "title": rule.title,
                    "action_code": rule.action_code,
                },
            }
        ),
        result_json=_dump({}),
        started_at=now,
        finished_at=None,
        created_at=now,
        updated_at=now,
    )
    db.add(run)
    db.flush()
    db.refresh(run)

    items: list[AutomationRunItem] = []

    for case in cases:
        evaluation = _evaluate_case_eligibility(case, rule=rule)

        item = AutomationRunItem(
            tenant_id=tenant_id,
            run_id=run.id,
            case_id=case.id,
            status="queued",
            reason_code=evaluation.get("reason_code"),
            reason_text=evaluation.get("reason_text"),
            action_code=rule.action_code,
            eligible_at=evaluation.get("eligible_at"),
            execution_started_at=None,
            execution_finished_at=None,
            payload_json=_dump(
                {
                    "rule_code": rule.code,
                    "evaluation": evaluation,
                }
            ),
            result_json=_dump({}),
            created_at=now,
            updated_at=now,
        )
        db.add(item)
        db.flush()
        db.refresh(item)

        if evaluation["status"] == "blocked":
            item.status = "blocked"
            item.result_json = _dump({"ok": False, "evaluation": evaluation})
            item.execution_finished_at = _utcnow()
            item.updated_at = _utcnow()
            db.add(item)

        elif evaluation["status"] == "waiting":
            item.status = "waiting"
            item.result_json = _dump({"ok": False, "evaluation": evaluation})
            item.execution_finished_at = _utcnow()
            item.updated_at = _utcnow()
            db.add(item)

        elif evaluation["status"] == "not_applicable":
            item.status = "not_applicable"
            item.result_json = _dump({"ok": False, "evaluation": evaluation})
            item.execution_finished_at = _utcnow()
            item.updated_at = _utcnow()
            db.add(item)

        else:
            # eligible, execution deferred to execute_automation_run()
            item.status = "queued"
            item.updated_at = _utcnow()
            db.add(item)

        items.append(item)

    _recount_run(run, items)
    run.result_json = _dump(
        {
            "missing_case_ids": missing_ids,
            "eligibility_code": None,
            "eligibility_reason": None,
            "eligible_at": None,
            "summary": {
                "total_items": run.total_items,
                "queued_items": run.queued_items,
                "success_items": run.success_items,
                "failed_items": run.failed_items,
                "blocked_items": run.blocked_items,
                "waiting_items": run.waiting_items,
                "not_applicable_items": run.not_applicable_items,
            },
        }
    )
    run.updated_at = _utcnow()
    db.add(run)
    db.flush()
    db.refresh(run)

    if case_ids:
        emit_event(
            db,
            CaseEvent(
                case_id=case_ids[0],
                type=CaseEventType.CASE_UPDATED,
                title=f"Automation run started: {rule.title}",
                details="Запущен automation run по набору дел.",
                payload={
                    "run_id": run.id,
                    "rule_code": rule.code,
                    "cases_count": len(case_ids),
                },
            ),
        )

    return get_automation_run_detail(db, run_id=run.id, tenant_id=tenant_id)


def execute_automation_run(
    db: Session,
    *,
    run_id: int,
    tenant_id: int | None = None,
    force: bool = False,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    run = get_automation_run_or_404(db, run_id=run_id, tenant_id=tenant_id)
    rule = _get_rule_or_404(db, rule_id=run.rule_id, tenant_id=tenant_id)

    items = (
        db.query(AutomationRunItem)
        .filter(
            AutomationRunItem.run_id == run.id,
            AutomationRunItem.tenant_id == tenant_id,
        )
        .order_by(AutomationRunItem.id.asc())
        .all()
    )

    if not items:
        raise HTTPException(status_code=409, detail="Automation run has no items")

    if run.status in {"finished", "succeeded"} and not force:
        return get_automation_run_detail(db, run_id=run.id, tenant_id=tenant_id)

    external_action_id = None
    now = _utcnow()
    run.status = "running"
    run.started_at = run.started_at or now
    run.updated_at = now
    db.add(run)
    db.flush()

    for item in items:
        if item.status not in {"queued"} and not force:
            continue

        case = (
            db.query(Case)
            .filter(
                Case.id == item.case_id,
                Case.tenant_id == tenant_id,
            )
            .first()
        )
        if not case:
            item.status = "failed"
            item.reason_code = "case_not_found"
            item.reason_text = "Дело не найдено."
            item.execution_finished_at = _utcnow()
            item.updated_at = _utcnow()
            item.result_json = _dump({"ok": False, "error": "case_not_found"})
            db.add(item)
            continue

        item.execution_started_at = _utcnow()
        item.updated_at = _utcnow()
        db.add(item)
        db.flush()

        execution = _execute_case_action(
            db,
            case=case,
            tenant_id=tenant_id,
            rule=rule,
        )

        item.execution_finished_at = _utcnow()
        item.updated_at = _utcnow()
        item.result_json = _dump(execution.get("result") or {})
        external_action_id = execution.get("external_action_id") or external_action_id

        if execution["status"] == "done":
            item.status = "succeeded"
            emit_event(
                db,
                CaseEvent(
                    case_id=case.id,
                    type=CaseEventType.CASE_UPDATED,
                    title=f"Automation done: {rule.title}",
                    details="Automation action completed.",
                    payload={
                        "run_id": run.id,
                        "rule_code": rule.code,
                        "action_code": rule.action_code,
                        "external_action_id": execution.get("external_action_id"),
                    },
                ),
            )
        elif execution["status"] == "not_applicable":
            item.status = "not_applicable"
            item.reason_code = "unsupported_action"
            item.reason_text = "Automation action is not supported."
        else:
            item.status = "failed"
            item.reason_code = "execution_failed"
            item.reason_text = "Automation action failed."

        db.add(item)

    db.flush()

    refreshed_items = (
        db.query(AutomationRunItem)
        .filter(
            AutomationRunItem.run_id == run.id,
            AutomationRunItem.tenant_id == tenant_id,
        )
        .order_by(AutomationRunItem.id.asc())
        .all()
    )

    _recount_run(run, refreshed_items)

    if run.failed_items == 0 and run.queued_items == 0 and run.blocked_items == 0 and run.waiting_items == 0:
        run.status = "succeeded"
    elif run.waiting_items > 0 and run.success_items == 0 and run.failed_items == 0:
        run.status = "waiting"
    elif run.blocked_items > 0 and run.success_items == 0 and run.failed_items == 0:
        run.status = "blocked"
    elif run.failed_items > 0 and run.success_items == 0:
        run.status = "failed"
    elif run.queued_items == 0:
        run.status = "finished"

    run.finished_at = _utcnow()
    run.updated_at = _utcnow()
    run.result_json = _dump(
        {
            "external_action_id": external_action_id,
            "eligibility_code": None,
            "eligibility_reason": None,
            "eligible_at": None,
            "summary": {
                "total_items": run.total_items,
                "queued_items": run.queued_items,
                "success_items": run.success_items,
                "failed_items": run.failed_items,
                "blocked_items": run.blocked_items,
                "waiting_items": run.waiting_items,
                "not_applicable_items": run.not_applicable_items,
            },
        }
    )
    db.add(run)
    db.flush()
    db.refresh(run)

    return get_automation_run_detail(db, run_id=run.id, tenant_id=tenant_id)


def get_waiting_bucket(
    db: Session,
    *,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    items = (
        db.query(AutomationRunItem)
        .filter(
            AutomationRunItem.tenant_id == tenant_id,
            AutomationRunItem.status == "waiting",
        )
        .order_by(
            AutomationRunItem.eligible_at.asc(),
            AutomationRunItem.id.asc(),
        )
        .all()
    )

    return {
        "items": [_serialize_run_item(item) for item in items],
        "count": len(items),
    }