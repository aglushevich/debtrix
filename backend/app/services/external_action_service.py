from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.events import CaseEvent, CaseEventType, emit_event
from backend.app.integrations.registry import get_provider
from backend.app.models import ExternalAction
from backend.app.services.tenant_query_service import current_tenant_id


ACTION_CATALOG: dict[str, dict[str, Any]] = {
    "send_to_fssp": {
        "provider": "fssp",
        "title": "Отправка в ФССП",
        "description": "Подготовка пакета для направления обращения приставам.",
        "auth_type": "esia",
        "requires_user_auth": True,
    },
    "send_russian_post_letter": {
        "provider": "russian_post",
        "title": "Письмо через Почту России",
        "description": "Подготовка отправки заказного письма через внешний сервис.",
        "auth_type": "esia",
        "requires_user_auth": True,
    },
    "submit_to_court": {
        "provider": "court",
        "title": "Подача документов в суд",
        "description": "Подготовка комплекта для внешней подачи в суд.",
        "auth_type": "esia",
        "requires_user_auth": True,
    },
}

OPEN_ACTION_STATUSES = {
    "pending_auth",
    "authorized",
    "prepared",
}


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _serialize_action(item: ExternalAction) -> dict[str, Any]:
    return {
        "id": item.id,
        "action_code": item.action_code,
        "provider": item.provider,
        "status": item.status,
        "auth_type": item.auth_type,
        "requires_user_auth": item.requires_user_auth,
        "title": item.title,
        "description": item.description,
        "external_reference": item.external_reference,
        "redirect_url": item.redirect_url,
        "error_message": item.error_message,
        "payload": item.payload or {},
        "result": item.result or {},
        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
        "confirmed_at": item.confirmed_at.isoformat() if item.confirmed_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def get_external_action_or_404(
    db: Session,
    *,
    action_id: int,
    tenant_id: int | None = None,
) -> ExternalAction:
    tenant_id = tenant_id or current_tenant_id(db)

    item = (
        db.query(ExternalAction)
        .filter(
            ExternalAction.id == action_id,
            ExternalAction.tenant_id == tenant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="External action not found")
    return item


def list_external_actions(
    db: Session,
    case_id: int,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    items = (
        db.query(ExternalAction)
        .filter(
            ExternalAction.case_id == case_id,
            ExternalAction.tenant_id == tenant_id,
        )
        .order_by(ExternalAction.id.desc())
        .all()
    )

    return {
        "case_id": case_id,
        "actions": [_serialize_action(item) for item in items],
    }


def _find_reusable_action(
    db: Session,
    *,
    case_id: int,
    tenant_id: int,
    action_code: str,
) -> ExternalAction | None:
    return (
        db.query(ExternalAction)
        .filter(
            ExternalAction.case_id == case_id,
            ExternalAction.tenant_id == tenant_id,
            ExternalAction.action_code == action_code,
            ExternalAction.status.in_(tuple(OPEN_ACTION_STATUSES)),
        )
        .order_by(ExternalAction.id.desc())
        .first()
    )


def prepare_external_action(
    db: Session,
    case_id: int,
    action_code: str,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    from backend.app.models import Case

    tenant_id = tenant_id or current_tenant_id(db)

    meta = ACTION_CATALOG.get(action_code)
    if not meta:
        raise HTTPException(status_code=422, detail=f"Unsupported external action: {action_code}")

    reusable = _find_reusable_action(
        db,
        case_id=case_id,
        tenant_id=tenant_id,
        action_code=action_code,
    )
    if reusable:
        return {
            "ok": True,
            "case_id": case_id,
            "reused": True,
            "action": _serialize_action(reusable),
        }

    case = (
        db.query(Case)
        .filter(
            Case.id == case_id,
            Case.tenant_id == tenant_id,
        )
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    provider = get_provider(meta["provider"])
    provider_result = provider.prepare_action(
        db,
        case=case,
        tenant_id=tenant_id,
        action_code=action_code,
        context={"case_id": case_id},
    )

    redirect_url = None
    if meta["requires_user_auth"]:
        redirect_url = (
            f"https://esia.example.local/auth?"
            f"provider={meta['provider']}&case_id={case_id}&action={action_code}"
        )

    item = ExternalAction(
        case_id=case_id,
        tenant_id=tenant_id,
        action_code=action_code,
        provider=meta["provider"],
        title=meta["title"],
        description=meta["description"],
        status="pending_auth" if meta["requires_user_auth"] else (provider_result.get("status") or "prepared"),
        auth_type=meta["auth_type"],
        requires_user_auth=bool(meta["requires_user_auth"]),
        external_reference=f"{action_code}-{case_id}-{int(_utcnow().timestamp())}",
        redirect_url=redirect_url,
        payload={
            "case_id": case_id,
            "action_code": action_code,
            "prepared_via": "debtrix",
            "requires_user_auth": bool(meta["requires_user_auth"]),
            "provider_prepare_result": provider_result.get("details") or {},
        },
        result={},
        expires_at=_utcnow() + timedelta(hours=1),
    )

    db.add(item)
    db.flush()
    db.refresh(item)

    emit_event(
        db,
        CaseEvent(
            case_id=case_id,
            type=CaseEventType.EXTERNAL_ACTION_PREPARED,
            title=f"Подготовлено внешнее действие: {item.title}",
            details="Создана external action запись.",
            payload={
                "action_id": item.id,
                "action_code": item.action_code,
                "provider": item.provider,
                "status": item.status,
            },
        ),
    )

    return {
        "ok": True,
        "case_id": case_id,
        "reused": False,
        "action": _serialize_action(item),
    }


def authorize_external_action(
    db: Session,
    *,
    action_id: int,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)
    item = get_external_action_or_404(db, action_id=action_id, tenant_id=tenant_id)

    if not item.requires_user_auth:
        raise HTTPException(
            status_code=409,
            detail="This external action does not require authorization",
        )

    if item.status not in {"pending_auth", "authorized"}:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot authorize action in status={item.status}",
        )

    now = _utcnow()
    item.status = "authorized"
    item.confirmed_at = now
    item.error_message = None
    item.result = {
        **(item.result or {}),
        "authorized_at": now.isoformat(),
    }

    db.add(item)
    db.flush()
    db.refresh(item)

    emit_event(
        db,
        CaseEvent(
            case_id=item.case_id,
            type=CaseEventType.EXTERNAL_ACTION_AUTHORIZED,
            title=f"Подтверждена авторизация действия: {item.title}",
            details="Внешнее действие прошло пользовательскую авторизацию.",
            payload={
                "action_id": item.id,
                "action_code": item.action_code,
                "provider": item.provider,
                "status": item.status,
            },
        ),
    )

    return {
        "ok": True,
        "action": _serialize_action(item),
    }


def mark_external_action_prepared(
    db: Session,
    *,
    action_id: int,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)
    item = get_external_action_or_404(db, action_id=action_id, tenant_id=tenant_id)

    if item.status not in {"authorized", "prepared"}:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot mark prepared for action in status={item.status}",
        )

    now = _utcnow()
    item.status = "prepared"
    item.error_message = None
    item.result = {
        **(item.result or {}),
        "prepared_at": now.isoformat(),
    }

    db.add(item)
    db.flush()
    db.refresh(item)

    return {
        "ok": True,
        "action": _serialize_action(item),
    }


def mark_external_action_sent(
    db: Session,
    *,
    action_id: int,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)
    item = get_external_action_or_404(db, action_id=action_id, tenant_id=tenant_id)

    if item.status not in {"prepared", "sent"}:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot mark sent for action in status={item.status}",
        )

    now = _utcnow()
    item.status = "sent"
    item.error_message = None
    item.result = {
        **(item.result or {}),
        "sent_at": now.isoformat(),
    }

    db.add(item)
    db.flush()
    db.refresh(item)

    return {
        "ok": True,
        "action": _serialize_action(item),
    }


def fail_external_action(
    db: Session,
    *,
    action_id: int,
    tenant_id: int | None = None,
    error_message: str,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)
    item = get_external_action_or_404(db, action_id=action_id, tenant_id=tenant_id)

    message = (error_message or "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="error_message is required")

    now = _utcnow()
    item.status = "failed"
    item.error_message = message
    item.result = {
        **(item.result or {}),
        "failed_at": now.isoformat(),
        "error_message": message,
    }

    db.add(item)
    db.flush()
    db.refresh(item)

    emit_event(
        db,
        CaseEvent(
            case_id=item.case_id,
            type=CaseEventType.EXTERNAL_ACTION_FAILED,
            title=f"Ошибка внешнего действия: {item.title}",
            details=message,
            payload={
                "action_id": item.id,
                "action_code": item.action_code,
                "provider": item.provider,
                "status": item.status,
            },
        ),
    )

    return {
        "ok": True,
        "action": _serialize_action(item),
    }