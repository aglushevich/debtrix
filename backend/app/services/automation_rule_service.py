from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models import AutomationRule
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


def _slugify(value: str) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-zA-Z0-9а-яА-ЯёЁ]+", "_", text)
    text = re.sub(r"_+", "_", text)
    text = text.strip("_")
    return text or "automation_rule"


def _build_rule_code(
    db: Session,
    *,
    tenant_id: int,
    base_text: str,
) -> str:
    base_code = _slugify(base_text)
    candidate = base_code
    index = 2

    while (
        db.query(AutomationRule)
        .filter(
            AutomationRule.tenant_id == tenant_id,
            AutomationRule.code == candidate,
        )
        .first()
        is not None
    ):
        candidate = f"{base_code}_{index}"
        index += 1

    return candidate


def _serialize_rule(item: AutomationRule) -> dict[str, Any]:
    config = _load(item.config_json)
    eligibility = _load(item.eligibility_json)

    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "code": item.code,
        "title": item.title,
        "description": item.description,
        "is_enabled": item.is_enabled,
        "trigger_type": item.trigger_type,
        "scope_type": item.scope_type,
        "action_code": item.action_code,
        "playbook_code": item.playbook_code,
        "contract_type": item.contract_type,
        "stage_code": item.stage_code,
        "priority": item.priority,
        "config": config,
        "eligibility": eligibility,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def list_automation_rules(
    db: Session,
    *,
    tenant_id: int | None = None,
    scope_type: str | None = None,
    is_enabled: bool | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    query = (
        db.query(AutomationRule)
        .filter(AutomationRule.tenant_id == tenant_id)
        .order_by(AutomationRule.priority.asc(), AutomationRule.id.asc())
    )

    if scope_type:
        query = query.filter(AutomationRule.scope_type == scope_type)

    if is_enabled is not None:
        query = query.filter(AutomationRule.is_enabled.is_(is_enabled))

    items = query.all()

    return {
        "items": [_serialize_rule(item) for item in items],
    }


def get_automation_rule_or_404(
    db: Session,
    *,
    rule_id: int,
    tenant_id: int | None = None,
) -> AutomationRule:
    tenant_id = tenant_id or current_tenant_id(db)

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


def create_automation_rule(
    db: Session,
    *,
    tenant_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="name is required")

    code = _build_rule_code(
        db,
        tenant_id=tenant_id,
        base_text=name,
    )

    filters = dict(payload.get("filters") or {})
    action_params = dict(payload.get("action_params") or {})

    config = {
        "execution_mode": payload.get("execution_mode") or "manual_review",
        "cooldown_seconds": int(payload.get("cooldown_seconds") or 0),
        "filters": filters,
        "action_params": action_params,
    }

    eligibility = {
        "eligible_from": (
            payload.get("eligible_from").isoformat()
            if payload.get("eligible_from")
            else None
        ),
        "eligible_until": (
            payload.get("eligible_until").isoformat()
            if payload.get("eligible_until")
            else None
        ),
    }

    row = AutomationRule(
        tenant_id=tenant_id,
        code=code,
        title=name,
        description=payload.get("description"),
        is_enabled=True,
        trigger_type=payload.get("trigger_code") or "manual",
        scope_type=payload.get("scope_type") or "case",
        action_code=payload.get("action_code"),
        playbook_code=payload.get("playbook_code"),
        contract_type=payload.get("contract_type"),
        stage_code=payload.get("stage_code"),
        priority=int(payload.get("priority") or 100),
        config_json=_dump(config),
        eligibility_json=_dump(eligibility),
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )

    db.add(row)
    db.flush()
    db.refresh(row)

    return {
        "ok": True,
        "rule": _serialize_rule(row),
    }


def update_automation_rule(
    db: Session,
    *,
    rule_id: int,
    tenant_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    row = get_automation_rule_or_404(
        db,
        rule_id=rule_id,
        tenant_id=tenant_id,
    )

    config = _load(row.config_json)
    eligibility = _load(row.eligibility_json)

    if "name" in payload and payload["name"] is not None:
        name = str(payload["name"]).strip()
        if not name:
            raise HTTPException(status_code=422, detail="name must not be empty")
        row.title = name

    if "description" in payload:
        row.description = payload.get("description")

    if "is_enabled" in payload and payload["is_enabled"] is not None:
        row.is_enabled = bool(payload["is_enabled"])

    if "scope_type" in payload and payload["scope_type"] is not None:
        row.scope_type = payload["scope_type"]

    if "trigger_code" in payload and payload["trigger_code"] is not None:
        row.trigger_type = payload["trigger_code"]

    if "action_code" in payload and payload["action_code"] is not None:
        row.action_code = payload["action_code"]

    if "priority" in payload and payload["priority"] is not None:
        row.priority = int(payload["priority"])

    if "execution_mode" in payload and payload["execution_mode"] is not None:
        config["execution_mode"] = payload["execution_mode"]

    if "cooldown_seconds" in payload and payload["cooldown_seconds"] is not None:
        config["cooldown_seconds"] = int(payload["cooldown_seconds"])

    if "filters" in payload and payload["filters"] is not None:
        config["filters"] = dict(payload["filters"] or {})

    if "action_params" in payload and payload["action_params"] is not None:
        config["action_params"] = dict(payload["action_params"] or {})

    if "eligible_from" in payload:
        eligibility["eligible_from"] = (
            payload["eligible_from"].isoformat()
            if payload["eligible_from"]
            else None
        )

    if "eligible_until" in payload:
        eligibility["eligible_until"] = (
            payload["eligible_until"].isoformat()
            if payload["eligible_until"]
            else None
        )

    row.config_json = _dump(config)
    row.eligibility_json = _dump(eligibility)
    row.updated_at = _utcnow()

    db.add(row)
    db.flush()
    db.refresh(row)

    return {
        "ok": True,
        "rule": _serialize_rule(row),
    }


def upsert_default_automation_rules(
    db: Session,
    *,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    tenant_id = tenant_id or current_tenant_id(db)

    defaults: list[dict[str, Any]] = [
        {
            "code": "soft_reminder_dispatch",
            "title": "Автоматическое напоминание по просрочке",
            "description": "Подготавливает стандартное действие на ранней стадии взыскания.",
            "trigger_type": "manual",
            "scope_type": "case_batch",
            "action_code": "send_payment_due_notice",
            "playbook_code": None,
            "priority": 100,
            "config": {"mode": "scaffold"},
            "eligibility": {"requires_case_open": True},
        },
        {
            "code": "fssp_portfolio_check",
            "title": "Пакетная проверка ФССП",
            "description": "Проверяет портфель дел на предмет доступности проверки ФССП.",
            "trigger_type": "manual",
            "scope_type": "case_batch",
            "action_code": "check_fssp",
            "playbook_code": None,
            "priority": 200,
            "config": {"mode": "scaffold"},
            "eligibility": {"requires_identifiers": True},
        },
        {
            "code": "prepare_fssp_dispatch",
            "title": "Подготовка внешней отправки в ФССП",
            "description": "Подготавливает внешний outbound flow для выбранных дел.",
            "trigger_type": "manual",
            "scope_type": "case_batch",
            "action_code": "send_to_fssp",
            "playbook_code": None,
            "priority": 300,
            "config": {"mode": "external_action"},
            "eligibility": {"requires_identifiers": True},
        },
    ]

    created = 0
    updated = 0

    for item in defaults:
        existing = (
            db.query(AutomationRule)
            .filter(
                AutomationRule.tenant_id == tenant_id,
                AutomationRule.code == item["code"],
            )
            .first()
        )

        if existing:
            existing.title = item["title"]
            existing.description = item["description"]
            existing.trigger_type = item["trigger_type"]
            existing.scope_type = item["scope_type"]
            existing.action_code = item["action_code"]
            existing.playbook_code = item["playbook_code"]
            existing.priority = item["priority"]
            existing.is_enabled = True
            existing.config_json = _dump(item["config"])
            existing.eligibility_json = _dump(item["eligibility"])
            existing.updated_at = _utcnow()
            db.add(existing)
            updated += 1
            continue

        row = AutomationRule(
            tenant_id=tenant_id,
            code=item["code"],
            title=item["title"],
            description=item["description"],
            is_enabled=True,
            trigger_type=item["trigger_type"],
            scope_type=item["scope_type"],
            action_code=item["action_code"],
            playbook_code=item["playbook_code"],
            contract_type=None,
            stage_code=None,
            priority=item["priority"],
            config_json=_dump(item["config"]),
            eligibility_json=_dump(item["eligibility"]),
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        db.add(row)
        created += 1

    db.flush()

    return {
        "ok": True,
        "created": created,
        "updated": updated,
    }