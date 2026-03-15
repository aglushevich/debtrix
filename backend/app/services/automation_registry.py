from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from sqlalchemy.orm import Session

from backend.app.models import Case


AutomationHandler = Callable[[Session, Case, int, dict[str, Any]], dict[str, Any]]


@dataclass(frozen=True)
class AutomationActionDefinition:
    code: str
    title: str
    handler: AutomationHandler


def _run_fns_sync(
    db: Session,
    case: Case,
    tenant_id: int,
    context: dict[str, Any],
) -> dict[str, Any]:
    from backend.app.services.fns_sync_service import run_fns_case_sync

    return run_fns_case_sync(
        db,
        case=case,
        tenant_id=tenant_id,
    )


def _run_fssp_check(
    db: Session,
    case: Case,
    tenant_id: int,
    context: dict[str, Any],
) -> dict[str, Any]:
    from backend.app.services.fssp_sync_service import run_fssp_case_check

    return run_fssp_case_check(
        db,
        case=case,
        tenant_id=tenant_id,
    )


def _prepare_external_send_to_fssp(
    db: Session,
    case: Case,
    tenant_id: int,
    context: dict[str, Any],
) -> dict[str, Any]:
    from backend.app.services.external_action_service import prepare_external_action

    return prepare_external_action(
        db,
        case_id=case.id,
        action_code="send_to_fssp",
        tenant_id=tenant_id,
    )


def _prepare_external_send_post(
    db: Session,
    case: Case,
    tenant_id: int,
    context: dict[str, Any],
) -> dict[str, Any]:
    from backend.app.services.external_action_service import prepare_external_action

    return prepare_external_action(
        db,
        case_id=case.id,
        action_code="send_russian_post_letter",
        tenant_id=tenant_id,
    )


def _prepare_external_submit_court(
    db: Session,
    case: Case,
    tenant_id: int,
    context: dict[str, Any],
) -> dict[str, Any]:
    from backend.app.services.external_action_service import prepare_external_action

    return prepare_external_action(
        db,
        case_id=case.id,
        action_code="submit_to_court",
        tenant_id=tenant_id,
    )


AUTOMATION_ACTIONS: dict[str, AutomationActionDefinition] = {
    "sync_fns": AutomationActionDefinition(
        code="sync_fns",
        title="Синхронизация ФНС",
        handler=_run_fns_sync,
    ),
    "check_fssp": AutomationActionDefinition(
        code="check_fssp",
        title="Проверка ФССП",
        handler=_run_fssp_check,
    ),
    "prepare_send_to_fssp": AutomationActionDefinition(
        code="prepare_send_to_fssp",
        title="Подготовить внешнее действие: отправка в ФССП",
        handler=_prepare_external_send_to_fssp,
    ),
    "prepare_send_russian_post_letter": AutomationActionDefinition(
        code="prepare_send_russian_post_letter",
        title="Подготовить внешнее действие: Почта России",
        handler=_prepare_external_send_post,
    ),
    "prepare_submit_to_court": AutomationActionDefinition(
        code="prepare_submit_to_court",
        title="Подготовить внешнее действие: подача в суд",
        handler=_prepare_external_submit_court,
    ),
}


def get_automation_action(code: str) -> AutomationActionDefinition:
    item = AUTOMATION_ACTIONS.get((code or "").strip())
    if not item:
        raise ValueError(f"Unsupported automation action: {code}")
    return item


def list_automation_actions() -> list[dict[str, str]]:
    return [
        {"code": item.code, "title": item.title}
        for item in AUTOMATION_ACTIONS.values()
    ]