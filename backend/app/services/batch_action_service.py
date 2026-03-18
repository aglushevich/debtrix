from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models import Case
from backend.app.services.action_service import get_available_actions
from backend.app.services.case_service import apply_action_write
from backend.app.services.playbook_engine_service import evaluate_case_playbook
from backend.app.services.tenant_query_service import load_case_for_tenant_or_404


BUCKET_TITLES = {
    "eligible_now": "Готово к запуску",
    "waiting": "Ожидают",
    "blocked": "Заблокированы",
    "already_processed": "Уже обработаны",
    "not_applicable": "Не применимо",
    "error": "Ошибка",
    "success": "Успешно",
}


def _build_bucket(key: str, case_ids: list[int]) -> dict[str, Any]:
    return {
        "key": key,
        "title": BUCKET_TITLES.get(key, key),
        "count": len(case_ids),
        "case_ids": case_ids,
    }


def _normalize_action_codes(items: list[dict[str, Any]]) -> set[str]:
    result: set[str] = set()

    for item in items:
        code = str(item.get("code") or "").strip()
        if code:
            result.add(code)

    return result


def _extract_debtor_identifiers(case: Case) -> tuple[str | None, str | None]:
    contract_data = dict(case.contract_data or {})
    debtor = dict(contract_data.get("debtor") or {})

    inn = str(debtor.get("inn") or "").strip() or None
    ogrn = str(debtor.get("ogrn") or "").strip() or None
    return inn, ogrn


def _extract_stage_flags(case: Case) -> dict[str, Any]:
    contract_data = dict(case.contract_data or {})
    stage = dict(contract_data.get("stage") or {})
    return dict(stage.get("flags") or {})


def _format_dt(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.isoformat()

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def _first_waiting_bucket(playbook_eval: dict[str, Any]) -> dict[str, Any] | None:
    buckets = playbook_eval.get("waiting_buckets") or []
    if not buckets:
        return None

    first = buckets[0]
    if not isinstance(first, dict):
        return None

    return first


def _first_blocked_step(playbook_eval: dict[str, Any]) -> Any:
    blocked_steps = playbook_eval.get("blocked_steps") or []
    if not blocked_steps:
        return None
    return blocked_steps[0]


def _blocked_reason_from_playbook(playbook_eval: dict[str, Any]) -> str | None:
    first = _first_blocked_step(playbook_eval)
    if not first:
        return None

    if isinstance(first, dict):
        return (
            first.get("reason")
            or first.get("title")
            or first.get("label")
            or first.get("step_code")
            or "Действие заблокировано правилами playbook"
        )

    return str(first)


def _already_processed_reason(action_code: str, stage_flags: dict[str, Any]) -> str | None:
    if action_code == "send_payment_due_notice" and stage_flags.get("payment_due_notice_sent"):
        return "Первое уведомление уже отправлено"

    if action_code == "send_debt_notice" and stage_flags.get("debt_notice_sent"):
        return "Уведомление о задолженности уже отправлено"

    if action_code == "send_pretension" and stage_flags.get("notified"):
        return "Досудебная претензия уже отправлена"

    if action_code == "generate_lawsuit" and stage_flags.get("documents_prepared"):
        return "Судебные документы уже подготовлены"

    if action_code == "send_to_fssp" and stage_flags.get("fssp_prepared"):
        return "Материалы для ФССП уже подготовлены"

    return None


def _missing_identifier_reason(case: Case) -> str | None:
    inn, ogrn = _extract_debtor_identifiers(case)
    if not inn and not ogrn:
        return "Не хватает идентификаторов должника"
    return None


def _detect_case_bucket(
    db: Session,
    case: Case,
    tenant_id: int,
    action_code: str,
) -> dict[str, Any]:
    available_actions = get_available_actions(db, case.id)
    action_codes = _normalize_action_codes(available_actions)

    if action_code in action_codes:
        return {
            "bucket": "eligible_now",
            "reason": None,
            "eligible_at": None,
        }

    stage_flags = _extract_stage_flags(case)

    already_processed_reason = _already_processed_reason(action_code, stage_flags)
    if already_processed_reason:
        return {
            "bucket": "already_processed",
            "reason": already_processed_reason,
            "eligible_at": None,
        }

    missing_identifier_reason = _missing_identifier_reason(case)
    if missing_identifier_reason:
        return {
            "bucket": "blocked",
            "reason": missing_identifier_reason,
            "eligible_at": None,
        }

    playbook_eval = evaluate_case_playbook(db, case, tenant_id=tenant_id)

    waiting_bucket = _first_waiting_bucket(playbook_eval)
    if waiting_bucket:
        return {
            "bucket": "waiting",
            "reason": (
                waiting_bucket.get("reason_text")
                or waiting_bucket.get("reason")
                or "Ожидает eligibility window"
            ),
            "eligible_at": _format_dt(waiting_bucket.get("eligible_at")),
        }

    blocked_reason = _blocked_reason_from_playbook(playbook_eval)
    if blocked_reason:
        return {
            "bucket": "blocked",
            "reason": blocked_reason,
            "eligible_at": None,
        }

    return {
        "bucket": "not_applicable",
        "reason": "Действие сейчас недоступно для этого дела",
        "eligible_at": None,
    }


def preview_batch_action(
    db: Session,
    *,
    tenant_id: int,
    action_code: str,
    case_ids: list[int],
) -> dict[str, Any]:
    items: list[dict[str, Any]] = []

    grouped: dict[str, list[int]] = {
        "eligible_now": [],
        "waiting": [],
        "blocked": [],
        "already_processed": [],
        "not_applicable": [],
    }

    for case_id in case_ids:
        case = load_case_for_tenant_or_404(
            db,
            case_id=case_id,
            tenant_id=tenant_id,
            include_archived=True,
        )

        result = _detect_case_bucket(db, case, tenant_id, action_code)
        bucket = str(result["bucket"])

        grouped.setdefault(bucket, []).append(case.id)
        items.append(
            {
                "case_id": case.id,
                "bucket": bucket,
                "reason": result.get("reason"),
                "eligible_at": result.get("eligible_at"),
            }
        )

    return {
        "ok": True,
        "action_code": action_code,
        "total_selected": len(case_ids),
        "preview": {
            "eligible_now": _build_bucket("eligible_now", grouped["eligible_now"]),
            "waiting": _build_bucket("waiting", grouped["waiting"]),
            "blocked": _build_bucket("blocked", grouped["blocked"]),
            "already_processed": _build_bucket("already_processed", grouped["already_processed"]),
            "not_applicable": _build_bucket("not_applicable", grouped["not_applicable"]),
        },
        "items": items,
    }


def execute_batch_action(
    db: Session,
    *,
    tenant_id: int,
    action_code: str,
    case_ids: list[int],
    force: bool = False,
) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    executed_count = 0

    for case_id in case_ids:
        case = load_case_for_tenant_or_404(
            db,
            case_id=case_id,
            tenant_id=tenant_id,
            include_archived=True,
        )

        preview = _detect_case_bucket(db, case, tenant_id, action_code)

        if preview["bucket"] != "eligible_now" and not force:
            results.append(
                {
                    "case_id": case.id,
                    "status": preview["bucket"],
                    "reason": preview.get("reason"),
                    "eligible_at": preview.get("eligible_at"),
                    "payload": None,
                }
            )
            continue

        try:
            payload = apply_action_write(
                db,
                case_id=case.id,
                tenant_id=tenant_id,
                action_code=action_code,
            )
            executed_count += 1
            results.append(
                {
                    "case_id": case.id,
                    "status": "success",
                    "reason": None,
                    "eligible_at": None,
                    "payload": payload if isinstance(payload, dict) else None,
                }
            )
        except Exception as exc:
            results.append(
                {
                    "case_id": case.id,
                    "status": "error",
                    "reason": str(exc),
                    "eligible_at": None,
                    "payload": None,
                }
            )

    summary_counter = Counter(item["status"] for item in results)

    return {
        "ok": True,
        "action_code": action_code,
        "total_selected": len(case_ids),
        "queued": executed_count,
        "results": results,
        "summary": dict(summary_counter),
    }