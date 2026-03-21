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


def _status_value(value: Any) -> str:
    return str(getattr(value, "value", value) or "").strip()


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


def _operational_lane(case: Case) -> str:
    status = _status_value(case.status)

    if status in {"court"}:
        return "court"
    if status in {"fssp", "enforcement"}:
        return "enforcement"
    if status in {"closed"}:
        return "closed"
    return "soft"


def _case_snapshot(case: Case) -> dict[str, Any]:
    return {
        "case_id": case.id,
        "debtor_name": case.debtor_name,
        "contract_type": _status_value(case.contract_type) or "unknown",
        "debtor_type": _status_value(case.debtor_type) or "unknown",
        "status": _status_value(case.status) or "unknown",
        "lane": _operational_lane(case),
        "is_archived": bool(getattr(case, "is_archived", False)),
    }


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


def _build_guardrails(
    cases: list[Case],
    preview_items: list[dict[str, Any]],
) -> dict[str, Any]:
    contract_type_counts = Counter(
        _status_value(case.contract_type) or "unknown" for case in cases
    )
    debtor_type_counts = Counter(
        _status_value(case.debtor_type) or "unknown" for case in cases
    )
    status_counts = Counter(
        _status_value(case.status) or "unknown" for case in cases
    )
    lane_counts = Counter(_operational_lane(case) for case in cases)

    bucket_counts = Counter(str(item.get("bucket") or "unknown") for item in preview_items)
    archived_count = sum(1 for case in cases if bool(getattr(case, "is_archived", False)))
    total = len(cases) or 1

    warnings: list[dict[str, Any]] = []

    def add_warning(code: str, message: str, severity: str) -> None:
        warnings.append(
            {
                "code": code,
                "message": message,
                "severity": severity,
            }
        )

    if len(contract_type_counts) > 1:
        add_warning(
            "mixed_contract_types",
            "В пакете смешаны разные типы договоров. Лучше запускать batch по одному типу договора.",
            "medium",
        )

    if len(debtor_type_counts) > 1:
        add_warning(
            "mixed_debtor_types",
            "В пакете смешаны разные типы должников. Это снижает однородность исполнения.",
            "medium",
        )

    if len(lane_counts) > 1:
        add_warning(
            "mixed_operational_lanes",
            "В пакете смешаны soft / court / enforcement кейсы. Лучше разделить пакет по operational lane.",
            "high",
        )

    if archived_count > 0:
        add_warning(
            "contains_archived_cases",
            "В пакете есть архивные дела. Проверь, действительно ли их нужно запускать повторно.",
            "medium",
        )

    if bucket_counts.get("blocked", 0) / total >= 0.3:
        add_warning(
            "high_blocked_share",
            "Слишком большая доля blocked-кейсов. Сначала выгоднее убрать blocker’ы.",
            "high",
        )

    if bucket_counts.get("waiting", 0) / total >= 0.4:
        add_warning(
            "high_waiting_share",
            "Большая часть пакета ещё waiting. Пакет лучше отложить или очистить до eligible subset.",
            "medium",
        )

    if bucket_counts.get("eligible_now", 0) == 0:
        add_warning(
            "no_eligible_now",
            "В пакете нет кейсов, готовых к немедленному запуску.",
            "high",
        )

    if bucket_counts.get("already_processed", 0) > 0:
        add_warning(
            "contains_already_processed",
            "В пакете есть уже обработанные кейсы. Проверь, не будет ли дубля действий.",
            "low",
        )

    severe = {item["severity"] for item in warnings}
    if "high" in severe:
        recommended_mode = "cleanup_first"
    elif warnings:
        recommended_mode = "review_before_run"
    else:
        recommended_mode = "safe_to_run"

    if recommended_mode == "safe_to_run":
        recommended_action = "Пакет выглядит однородным. Можно строить preview и запускать eligible subset."
    elif recommended_mode == "review_before_run":
        recommended_action = "Пакет рабочий, но перед запуском лучше очистить mixed cases и проверить waiting/blocked."
    else:
        recommended_action = "Сначала разберись с blocker’ами, waiting и смешанными operational lanes, затем запускай пакет."

    return {
        "is_homogeneous": (
            len(contract_type_counts) <= 1
            and len(debtor_type_counts) <= 1
            and len(lane_counts) <= 1
        ),
        "recommended_mode": recommended_mode,
        "recommended_action": recommended_action,
        "warnings": warnings,
        "selection": {
            "total_cases": len(cases),
            "archived_cases": archived_count,
            "counts_by_contract_type": dict(contract_type_counts),
            "counts_by_debtor_type": dict(debtor_type_counts),
            "counts_by_status": dict(status_counts),
            "counts_by_lane": dict(lane_counts),
            "counts_by_bucket": dict(bucket_counts),
        },
    }


def _sort_waiting_items(waiting_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def _key(item: dict[str, Any]) -> tuple[int, str]:
        eligible_at = item.get("eligible_at")
        if not eligible_at:
            return (1, "")
        return (0, str(eligible_at))

    return sorted(waiting_items, key=_key)


def _build_subset(
    *,
    code: str,
    title: str,
    description: str,
    case_ids: list[int],
    recommended: bool = False,
) -> dict[str, Any]:
    unique_case_ids = list(dict.fromkeys(case_ids))
    return {
        "code": code,
        "title": title,
        "description": description,
        "count": len(unique_case_ids),
        "case_ids": unique_case_ids,
        "recommended": recommended,
    }


def _build_suggested_subsets(
    cases: list[Case],
    preview_items: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], str | None]:
    preview_by_case_id = {
        int(item["case_id"]): item for item in preview_items if item.get("case_id") is not None
    }
    snapshots_by_case_id = {
        int(case.id): _case_snapshot(case) for case in cases
    }

    eligible_case_ids = [
        int(item["case_id"])
        for item in preview_items
        if str(item.get("bucket")) == "eligible_now"
    ]

    clean_ready_case_ids = [
        case_id
        for case_id in eligible_case_ids
        if not bool((snapshots_by_case_id.get(case_id) or {}).get("is_archived"))
    ]

    waiting_items = _sort_waiting_items(
        [item for item in preview_items if str(item.get("bucket")) == "waiting"]
    )
    waiting_soon_case_ids = [int(item["case_id"]) for item in waiting_items[:20]]

    subsets: list[dict[str, Any]] = []

    if clean_ready_case_ids:
        subsets.append(
            _build_subset(
                code="clean_ready",
                title="Готовые к запуску",
                description="Чистый пакет: только eligible_now и без архивных дел.",
                case_ids=clean_ready_case_ids,
                recommended=True,
            )
        )

    if eligible_case_ids and eligible_case_ids != clean_ready_case_ids:
        subsets.append(
            _build_subset(
                code="eligible_now_all",
                title="Все eligible now",
                description="Все дела, доступные к запуску прямо сейчас.",
                case_ids=eligible_case_ids,
            )
        )

    if waiting_soon_case_ids:
        subsets.append(
            _build_subset(
                code="waiting_soon",
                title="Waiting soon",
                description="Ближайшие waiting-кейсы по eligible_at.",
                case_ids=waiting_soon_case_ids,
            )
        )

    lane_groups: dict[str, list[int]] = {}
    for case_id in eligible_case_ids:
        lane = str((snapshots_by_case_id.get(case_id) or {}).get("lane") or "unknown")
        lane_groups.setdefault(lane, []).append(case_id)

    lane_titles = {
        "soft": ("Soft stage", "Однородный пакет для soft-stage действий."),
        "court": ("Court lane", "Однородный пакет для судебного контура."),
        "enforcement": ("Enforcement lane", "Однородный пакет для enforcement / ФССП."),
        "closed": ("Closed cases", "Закрытые дела, попавшие в выборку."),
    }

    for lane, case_ids in lane_groups.items():
        if not case_ids:
            continue
        title, description = lane_titles.get(
            lane,
            (f"Lane: {lane}", f"Подборка дел operational lane = {lane}."),
        )
        subsets.append(
            _build_subset(
                code=f"lane_{lane}",
                title=title,
                description=description,
                case_ids=case_ids,
            )
        )

    contract_type_groups: dict[str, list[int]] = {}
    for case_id in eligible_case_ids:
        contract_type = str(
            (snapshots_by_case_id.get(case_id) or {}).get("contract_type") or "unknown"
        )
        contract_type_groups.setdefault(contract_type, []).append(case_id)

    for contract_type, case_ids in contract_type_groups.items():
        if len(case_ids) < 2:
            continue
        subsets.append(
            _build_subset(
                code=f"contract_type_{contract_type}",
                title=f"Договор: {contract_type}",
                description="Однородный пакет по типу договора.",
                case_ids=case_ids,
            )
        )

    debtor_type_groups: dict[str, list[int]] = {}
    for case_id in eligible_case_ids:
        debtor_type = str(
            (snapshots_by_case_id.get(case_id) or {}).get("debtor_type") or "unknown"
        )
        debtor_type_groups.setdefault(debtor_type, []).append(case_id)

    for debtor_type, case_ids in debtor_type_groups.items():
        if len(case_ids) < 2:
            continue
        subsets.append(
            _build_subset(
                code=f"debtor_type_{debtor_type}",
                title=f"Должник: {debtor_type}",
                description="Однородный пакет по типу должника.",
                case_ids=case_ids,
            )
        )

    # убираем дубликаты subset по совпадающему набору ids
    deduped: list[dict[str, Any]] = []
    seen_keys: set[tuple[int, ...]] = set()
    for subset in subsets:
        key = tuple(sorted(int(case_id) for case_id in subset["case_ids"]))
        if not key:
            continue
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(subset)

    recommended_subset_code: str | None = None
    for subset in deduped:
        if subset.get("recommended"):
            recommended_subset_code = str(subset["code"])
            break

    if not recommended_subset_code and deduped:
        recommended_subset_code = str(deduped[0]["code"])

    return deduped, recommended_subset_code


def preview_batch_action(
    db: Session,
    *,
    tenant_id: int,
    action_code: str,
    case_ids: list[int],
) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    cases: list[Case] = []

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
        cases.append(case)

        result = _detect_case_bucket(db, case, tenant_id, action_code)
        bucket = str(result["bucket"])

        grouped.setdefault(bucket, []).append(case.id)
        items.append(
            {
                "case_id": case.id,
                "bucket": bucket,
                "reason": result.get("reason"),
                "eligible_at": result.get("eligible_at"),
                "snapshot": _case_snapshot(case),
            }
        )

    guardrails = _build_guardrails(cases, items)
    subsets, recommended_subset_code = _build_suggested_subsets(cases, items)

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
        "guardrails": guardrails,
        "subsets": subsets,
        "recommended_subset_code": recommended_subset_code,
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
    cases: list[Case] = []
    executed_count = 0

    for case_id in case_ids:
        case = load_case_for_tenant_or_404(
            db,
            case_id=case_id,
            tenant_id=tenant_id,
            include_archived=True,
        )
        cases.append(case)

        preview = _detect_case_bucket(db, case, tenant_id, action_code)

        if preview["bucket"] in {"already_processed", "not_applicable"}:
            results.append(
                {
                    "case_id": case.id,
                    "status": preview["bucket"],
                    "reason": preview.get("reason"),
                    "eligible_at": preview.get("eligible_at"),
                    "payload": None,
                    "snapshot": _case_snapshot(case),
                }
            )
            continue

        if (
            preview["bucket"] == "blocked"
            and preview.get("reason") == "Не хватает идентификаторов должника"
        ):
            results.append(
                {
                    "case_id": case.id,
                    "status": "blocked",
                    "reason": preview.get("reason"),
                    "eligible_at": None,
                    "payload": None,
                    "snapshot": _case_snapshot(case),
                }
            )
            continue

        if preview["bucket"] != "eligible_now" and not force:
            results.append(
                {
                    "case_id": case.id,
                    "status": preview["bucket"],
                    "reason": preview.get("reason"),
                    "eligible_at": preview.get("eligible_at"),
                    "payload": None,
                    "snapshot": _case_snapshot(case),
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
                    "snapshot": _case_snapshot(case),
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
                    "snapshot": _case_snapshot(case),
                }
            )

    summary_counter = Counter(item["status"] for item in results)
    guardrails = _build_guardrails(cases, results)

    return {
        "ok": True,
        "action_code": action_code,
        "total_selected": len(case_ids),
        "queued": executed_count,
        "results": results,
        "summary": dict(summary_counter),
        "guardrails": {
            **guardrails,
            "force_used": bool(force),
            "executed_cases": executed_count,
        },
    }