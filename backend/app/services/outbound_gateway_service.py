from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.events import CaseEvent, CaseEventType, emit_event
from backend.app.models import OutboundDispatch
from backend.app.services.external_action_service import (
    fail_external_action,
    get_external_action_or_404,
    mark_external_action_prepared,
    mark_external_action_sent,
)
from backend.app.services.provider_adapters.registry import get_outbound_provider
from backend.app.services.tenant_query_service import load_case_for_tenant_or_404


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _serialize_dispatch(item: OutboundDispatch) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "case_id": item.case_id,
        "external_action_id": item.external_action_id,
        "provider": item.provider,
        "channel": item.channel,
        "status": item.status,
        "request_payload": item.request_payload or {},
        "response_payload": item.response_payload or {},
        "external_reference": item.external_reference,
        "error_message": item.error_message,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def dispatch_external_action(
    db: Session,
    *,
    action_id: int,
    tenant_id: int,
) -> dict[str, Any]:
    action = get_external_action_or_404(
        db,
        action_id=action_id,
        tenant_id=tenant_id,
    )
    case = load_case_for_tenant_or_404(
        db,
        action.case_id,
        tenant_id,
        include_archived=True,
    )

    if action.requires_user_auth and action.status == "pending_auth":
        raise HTTPException(
            status_code=409,
            detail="Action requires ESIA authorization before dispatch",
        )

    if action.status not in {"authorized", "prepared", "sent"}:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot dispatch action in status={action.status}",
        )

    provider = get_outbound_provider(action.provider)
    payload = provider.build_payload(case, action)

    if action.status != "prepared":
        mark_external_action_prepared(
            db,
            action_id=action.id,
            tenant_id=tenant_id,
        )

    send_result = provider.send(case, action, payload)
    ok = bool(send_result.get("status") in {"accepted", "sent", "ok", "queued"})

    dispatch = OutboundDispatch(
        tenant_id=tenant_id,
        case_id=case.id,
        external_action_id=action.id,
        provider=action.provider,
        channel="api",
        status="sent" if ok else "failed",
        request_payload=payload,
        response_payload=send_result,
        external_reference=(
            send_result.get("submission_id")
            or send_result.get("tracking_number")
            or send_result.get("filing_id")
        ),
        error_message=None if ok else (send_result.get("error") or "Outbound dispatch failed"),
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(dispatch)
    db.flush()
    db.refresh(dispatch)

    if ok:
        sent = mark_external_action_sent(
            db,
            action_id=action.id,
            tenant_id=tenant_id,
        )

        action = get_external_action_or_404(
            db,
            action_id=action.id,
            tenant_id=tenant_id,
        )
        action.result = {
            **(action.result or {}),
            "dispatch_id": dispatch.id,
            "dispatch_response": send_result,
        }
        action.updated_at = _now()
        db.add(action)
        db.flush()
        db.refresh(action)

        emit_event(
            db,
            CaseEvent(
                case_id=case.id,
                type=CaseEventType.EXTERNAL_ACTION_DISPATCHED,
                title=f"Внешнее действие отправлено: {action.title}",
                details="Сформирован outbound dispatch.",
                payload={
                    "action_id": action.id,
                    "dispatch_id": dispatch.id,
                    "provider": action.provider,
                    "external_reference": dispatch.external_reference,
                },
            ),
        )

        return {
            "ok": True,
            "action": sent["action"],
            "dispatch": _serialize_dispatch(dispatch),
        }

    fail_external_action(
        db,
        action_id=action.id,
        tenant_id=tenant_id,
        error_message=dispatch.error_message or "Outbound dispatch failed",
    )

    emit_event(
        db,
        CaseEvent(
            case_id=case.id,
            type=CaseEventType.EXTERNAL_ACTION_FAILED,
            title=f"Ошибка отправки внешнего действия: {action.title}",
            details=dispatch.error_message or "Outbound dispatch failed",
            payload={
                "action_id": action.id,
                "dispatch_id": dispatch.id,
                "provider": action.provider,
            },
        ),
    )

    return {
        "ok": False,
        "action": {
            "id": action.id,
            "status": "failed",
        },
        "dispatch": _serialize_dispatch(dispatch),
    }