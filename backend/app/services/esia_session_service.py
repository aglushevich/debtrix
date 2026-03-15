from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.events import CaseEvent, CaseEventType, emit_event
from backend.app.models import EsiaSession
from backend.app.services.external_action_service import (
    authorize_external_action,
    get_external_action_or_404,
)
from backend.app.services.provider_adapters.esia_provider import EsiaProviderAdapter


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _serialize(session: EsiaSession) -> dict[str, Any]:
    return {
        "id": session.id,
        "tenant_id": session.tenant_id,
        "case_id": session.case_id,
        "external_action_id": session.external_action_id,
        "provider": session.provider,
        "status": session.status,
        "state_token": session.state_token,
        "redirect_url": session.redirect_url,
        "access_scope": session.access_scope,
        "user_identifier": session.user_identifier,
        "is_active": session.is_active,
        "error_message": session.error_message,
        "payload": session.payload or {},
        "result": session.result or {},
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        "confirmed_at": session.confirmed_at.isoformat() if session.confirmed_at else None,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }


def start_esia_session_for_action(
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

    if not action.requires_user_auth:
        raise HTTPException(
            status_code=409,
            detail="This action does not require ESIA authorization",
        )

    if action.status not in {"pending_auth", "authorized"}:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot start ESIA session for action in status={action.status}",
        )

    existing = (
        db.query(EsiaSession)
        .filter(
            EsiaSession.external_action_id == action.id,
            EsiaSession.tenant_id == tenant_id,
            EsiaSession.is_active.is_(True),
        )
        .order_by(EsiaSession.id.desc())
        .first()
    )
    if existing:
        return {"ok": True, "reused": True, "session": _serialize(existing)}

    now = _now()
    state_token = secrets.token_urlsafe(24)

    esia = EsiaProviderAdapter()
    auth_meta = esia.build_authorization_url(
        state_token=state_token,
        action_id=action.id,
        provider=action.provider,
    )

    session = EsiaSession(
        tenant_id=tenant_id,
        case_id=action.case_id,
        external_action_id=action.id,
        provider="esia",
        status="pending",
        state_token=state_token,
        redirect_url=auth_meta["auth_url"],
        access_scope="basic_profile external_submission",
        is_active=True,
        payload={"action_id": action.id, "provider": action.provider},
        result={},
        expires_at=now + timedelta(minutes=30),
        created_at=now,
        updated_at=now,
    )
    db.add(session)
    db.flush()
    db.refresh(session)

    emit_event(
        db,
        CaseEvent(
            case_id=action.case_id,
            type=CaseEventType.ESIA_SESSION_STARTED,
            title="Запущена сессия ЕСИА",
            details="Сформирована redirect-ссылка для пользовательской авторизации.",
            payload={
                "action_id": action.id,
                "session_id": session.id,
                "provider": action.provider,
            },
        ),
    )

    return {"ok": True, "reused": False, "session": _serialize(session)}


def authorize_esia_session(
    db: Session,
    *,
    session_id: int,
    tenant_id: int,
) -> dict[str, Any]:
    session = (
        db.query(EsiaSession)
        .filter(
            EsiaSession.id == session_id,
            EsiaSession.tenant_id == tenant_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="ESIA session not found")

    now = _now()
    session.status = "authorized"
    session.is_active = False
    session.confirmed_at = now
    session.result = {
        **(session.result or {}),
        "authorized_at": now.isoformat(),
    }
    session.updated_at = now
    db.add(session)

    if session.external_action_id:
        authorize_external_action(
            db,
            action_id=session.external_action_id,
            tenant_id=tenant_id,
        )

    db.flush()
    db.refresh(session)

    emit_event(
        db,
        CaseEvent(
            case_id=session.case_id,
            type=CaseEventType.ESIA_SESSION_AUTHORIZED,
            title="Сессия ЕСИА подтверждена",
            details="Пользовательская авторизация для внешнего действия завершена.",
            payload={
                "session_id": session.id,
                "external_action_id": session.external_action_id,
                "provider": session.provider,
            },
        ),
    )

    return {"ok": True, "session": _serialize(session)}