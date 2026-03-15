from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.events import CaseEvent, CaseEventType, emit_event
from backend.app.models import Case, CaseProjection, DebtorProfile
from backend.app.services.action_service import get_available_actions
from backend.app.services.document_stage_service import get_available_documents
from backend.app.services.tenant_query_service import load_case_for_tenant_or_404


def _status_value(value: Any) -> str:
    return getattr(value, "value", value) if value is not None else ""


def _stage_flags(case: Case) -> dict[str, bool]:
    stage = dict((case.contract_data or {}).get("stage") or {})
    raw_flags = dict(stage.get("flags") or {})
    return {
        "payment_due_notice_sent": bool(raw_flags.get("payment_due_notice_sent")),
        "debt_notice_sent": bool(raw_flags.get("debt_notice_sent")),
        "notified": bool(raw_flags.get("notified")),
        "documents_prepared": bool(raw_flags.get("documents_prepared")),
        "fssp_prepared": bool(raw_flags.get("fssp_prepared")),
        "closed": bool(raw_flags.get("closed")),
    }


def _derive_stage_status(case: Case) -> str:
    flags = _stage_flags(case)

    if flags["closed"]:
        return "closed"
    if flags["fssp_prepared"]:
        return "enforcement"
    if flags["documents_prepared"]:
        return "documents"
    if flags["notified"]:
        return "pretrial"
    if flags["debt_notice_sent"]:
        return "debt_notice_sent"
    if flags["payment_due_notice_sent"]:
        return "payment_due_notice_sent"
    return "new"


def _case_status_from_stage(stage_status: str) -> str:
    if stage_status == "closed":
        return "closed"
    if stage_status in {"pretrial"}:
        return "pretrial"
    if stage_status in {"documents", "enforcement"}:
        return "court"
    return "overdue"


def debtor_widget(db: Session, case_id: int) -> dict[str, Any]:
    profile = db.query(DebtorProfile).filter(DebtorProfile.case_id == case_id).first()
    if profile:
        return {
            "name": profile.name,
            "inn": profile.inn,
            "ogrn": profile.ogrn,
            "address": profile.address,
            "director_name": profile.director_name,
            "source": profile.source,
        }

    case = db.query(Case).filter(Case.id == case_id).first()
    debtor = dict((case.contract_data or {}).get("debtor") or {}) if case else {}
    return {
        "name": debtor.get("name") or (case.debtor_name if case else None),
        "inn": debtor.get("inn"),
        "ogrn": debtor.get("ogrn"),
        "address": debtor.get("address"),
        "director_name": debtor.get("director_name"),
        "source": debtor.get("source"),
    }


def _build_projection_payload(db: Session, case: Case) -> dict[str, Any]:
    stage_status = _derive_stage_status(case)
    documents = get_available_documents(db, case.id)
    actions = get_available_actions(db, case.id)

    return {
        "case": {
            "id": case.id,
            "tenant_id": case.tenant_id,
            "debtor_name": case.debtor_name,
            "debtor_type": _status_value(case.debtor_type),
            "contract_type": _status_value(case.contract_type),
            "principal_amount": str(case.principal_amount),
            "due_date": case.due_date.isoformat() if case.due_date else None,
            "status": _status_value(case.status),
            "is_archived": bool(getattr(case, "is_archived", False)),
        },
        "contract_data": case.contract_data or {},
        "stage": {
            "status": stage_status,
            "flags": _stage_flags(case),
            "actions": actions,
        },
        "documents": documents,
        "status": {
            "code": _status_value(case.status),
            "title": _status_value(case.status),
        },
        "debtor_widget": debtor_widget(db, case.id),
    }


def sync_and_persist_case(db: Session, case: Case) -> dict[str, Any]:
    payload = _build_projection_payload(db, case)
    now = datetime.utcnow()

    projection = (
        db.query(CaseProjection)
        .filter(CaseProjection.case_id == case.id)
        .first()
    )
    if not projection:
        projection = CaseProjection(
            case_id=case.id,
            data=payload,
            updated_at=now,
        )
        db.add(projection)
    else:
        projection.data = payload
        projection.updated_at = now
        db.add(projection)

    db.flush()
    return payload


def get_projection_data_or_rebuild(db: Session, case_id: int) -> dict[str, Any]:
    row = db.query(CaseProjection).filter(CaseProjection.case_id == case_id).first()
    if row and row.data:
        return row.data

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return sync_and_persist_case(db, case)


def create_case_write(
    db: Session,
    *,
    tenant_id: int,
    debtor_type: str,
    debtor_name: str,
    contract_type: str,
    principal_amount: Any,
    due_date: Any,
    contract_data: dict[str, Any] | None = None,
) -> Case:
    now = datetime.utcnow()
    case = Case(
        tenant_id=tenant_id,
        debtor_type=debtor_type,
        debtor_name=debtor_name,
        contract_type=contract_type,
        principal_amount=principal_amount,
        due_date=due_date,
        status="draft",
        contract_data=contract_data or {},
        is_archived=False,
        created_at=now,
        updated_at=now,
    )
    db.add(case)
    db.flush()
    db.refresh(case)

    emit_event(
        db,
        CaseEvent(
            case_id=case.id,
            type=CaseEventType.CASE_CREATED,
            title="Дело создано",
            details="Создан новый кейс взыскания.",
            payload={
                "debtor_name": case.debtor_name,
                "contract_type": _status_value(case.contract_type),
                "principal_amount": str(case.principal_amount),
            },
        ),
    )

    sync_and_persist_case(db, case)
    db.flush()
    db.refresh(case)
    return case


def _ensure_stage_flags(case: Case) -> dict[str, Any]:
    cd = dict(case.contract_data or {})
    stage = dict(cd.get("stage") or {})
    flags = dict(stage.get("flags") or {})

    flags.setdefault("payment_due_notice_sent", False)
    flags.setdefault("debt_notice_sent", False)
    flags.setdefault("notified", False)
    flags.setdefault("documents_prepared", False)
    flags.setdefault("fssp_prepared", False)
    flags.setdefault("closed", False)

    stage["flags"] = flags
    cd["stage"] = stage
    case.contract_data = cd
    return flags


def apply_action_write(
    db: Session,
    *,
    case_id: int,
    tenant_id: int,
    action_code: str,
) -> dict[str, Any]:
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    flags = _ensure_stage_flags(case)

    if action_code == "send_payment_due_notice":
        flags["payment_due_notice_sent"] = True
    elif action_code == "send_debt_notice":
        flags["debt_notice_sent"] = True
    elif action_code == "send_pretension":
        flags["notified"] = True
    elif action_code == "prepare_lawsuit":
        flags["documents_prepared"] = True
    elif action_code == "prepare_fssp_application":
        flags["fssp_prepared"] = True
    elif action_code == "close_case":
        flags["closed"] = True
    else:
        raise HTTPException(status_code=422, detail=f"Unknown action: {action_code}")

    stage_status = _derive_stage_status(case)
    case.status = _case_status_from_stage(stage_status)
    case.updated_at = datetime.utcnow()
    db.add(case)

    emit_event(
        db,
        CaseEvent(
            case_id=case.id,
            type=CaseEventType.STAGE_ACTION_APPLIED,
            title="Применено действие по делу",
            details=f"Выполнено действие: {action_code}",
            payload={
                "action_code": action_code,
                "stage_status": stage_status,
                "case_status": _status_value(case.status),
            },
        ),
    )

    if action_code == "close_case":
        emit_event(
            db,
            CaseEvent(
                case_id=case.id,
                type=CaseEventType.CASE_CLOSED,
                title="Дело закрыто",
                details="Дело переведено в закрытое состояние.",
            ),
        )

    payload = sync_and_persist_case(db, case)
    db.flush()
    db.refresh(case)

    return {
        "ok": True,
        "case_id": case.id,
        "action": action_code,
        "status": _status_value(case.status),
        "snapshot": payload,
    }