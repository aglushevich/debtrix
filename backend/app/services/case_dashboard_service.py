from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models.case import Case
from backend.app.models.debtor_profile import DebtorProfile
from backend.app.services.action_service import get_available_actions
from backend.app.services.case_service import (
    debtor_widget,
    get_projection_data_or_rebuild,
)
from backend.app.services.debtor_intelligence_service import (
    build_debtor_intelligence_payload,
    build_organization_starter_kit_payload,
    build_routing_snapshot,
)
from backend.app.services.document_stage_service import get_available_documents
from backend.app.services.legal_labels_service import (
    enrich_action_item,
    enrich_document_item,
    enrich_status_block,
    get_case_status_title,
    get_contract_type_title,
    get_debtor_type_title,
    get_stage_status_title,
)


DEFAULT_SOFT_POLICY = {
    "payment_due_notice_delay_days": 0,
    "debt_notice_delay_days": 3,
    "pretension_delay_days": 10,
}


def _extract_case_identity(case: Case) -> tuple[str | None, str | None, str | None]:
    debtor = dict((case.contract_data or {}).get("debtor") or {})
    return debtor.get("inn"), debtor.get("ogrn"), case.debtor_name


def _get_soft_policy(case: Case) -> dict[str, int]:
    contract_data = dict(case.contract_data or {})
    raw = dict(contract_data.get("soft_policy") or {})

    return {
        "payment_due_notice_delay_days": int(
            raw.get(
                "payment_due_notice_delay_days",
                DEFAULT_SOFT_POLICY["payment_due_notice_delay_days"],
            )
        ),
        "debt_notice_delay_days": int(
            raw.get(
                "debt_notice_delay_days",
                DEFAULT_SOFT_POLICY["debt_notice_delay_days"],
            )
        ),
        "pretension_delay_days": int(
            raw.get(
                "pretension_delay_days",
                DEFAULT_SOFT_POLICY["pretension_delay_days"],
            )
        ),
    }


def _build_policy_timing(case: Case) -> dict[str, Any]:
    policy = _get_soft_policy(case)

    if not case.due_date:
        return {
            "base_due_date": None,
            "payment_due_notice_eligible_at": None,
            "debt_notice_eligible_at": None,
            "pretension_eligible_at": None,
        }

    due_date = case.due_date

    return {
        "base_due_date": due_date.isoformat(),
        "payment_due_notice_eligible_at": (
            due_date + timedelta(days=policy["payment_due_notice_delay_days"])
        ).isoformat(),
        "debt_notice_eligible_at": (
            due_date + timedelta(days=policy["debt_notice_delay_days"])
        ).isoformat(),
        "pretension_eligible_at": (
            due_date + timedelta(days=policy["pretension_delay_days"])
        ).isoformat(),
    }


def _related_cases(db: Session, case: Case) -> dict[str, Any]:
    inn, ogrn, debtor_name = _extract_case_identity(case)

    query = db.query(Case).filter(Case.tenant_id == case.tenant_id)
    items: list[dict[str, Any]] = []

    for item in query.order_by(Case.id.desc()).all():
        item_inn, item_ogrn, item_name = _extract_case_identity(item)

        same = False
        if inn and item_inn and inn == item_inn:
            same = True
        elif ogrn and item_ogrn and ogrn == item_ogrn:
            same = True
        elif debtor_name and item_name and debtor_name == item_name:
            same = True

        if not same:
            continue

        status_code = getattr(item.status, "value", item.status)
        contract_type_code = getattr(item.contract_type, "value", item.contract_type)

        items.append(
            {
                "case_id": item.id,
                "contract_type": contract_type_code,
                "contract_type_title": get_contract_type_title(contract_type_code),
                "principal_amount": str(item.principal_amount),
                "due_date": item.due_date.isoformat() if item.due_date else None,
                "status": status_code,
                "status_title": get_case_status_title(status_code),
                "is_current": item.id == case.id,
                "is_archived": bool(getattr(item, "is_archived", False)),
            }
        )

    debtor_profile = (
        db.query(DebtorProfile)
        .filter(DebtorProfile.case_id == case.id)
        .first()
    )

    total_amount = "0.00"
    try:
        total = sum(float(x["principal_amount"]) for x in items)
        total_amount = f"{total:.2f}"
    except Exception:
        pass

    return {
        "debtor": {
            "id": debtor_profile.id if debtor_profile else None,
            "name": debtor_profile.name if debtor_profile else case.debtor_name,
            "inn": debtor_profile.inn if debtor_profile else inn,
            "ogrn": debtor_profile.ogrn if debtor_profile else ogrn,
            "debtor_type": getattr(case.debtor_type, "value", case.debtor_type),
            "debtor_type_title": get_debtor_type_title(case.debtor_type),
        },
        "summary": {
            "cases_count": len(items),
            "total_principal_amount": total_amount,
        },
        "related_cases": items,
    }

def _build_decision_explain(case: Case, projection: dict[str, Any] | None) -> dict[str, Any]:
    positives: list[str] = []
    blockers: list[str] = []
    signals: list[str] = []

    projection = projection or {}
    smart = dict((case.meta or {}).get("smart") or {})
    stage = dict(projection.get("stage") or {})
    routing = build_routing_snapshot(case) or {}

    contract_type = getattr(case.contract_type, "value", case.contract_type)
    debtor_type = getattr(case.debtor_type, "value", case.debtor_type)

    if case.principal_amount is not None:
        try:
            if float(case.principal_amount) > 0:
                positives.append("Есть непогашенная сумма задолженности")
        except Exception:
            signals.append("Сумма долга требует дополнительной проверки")

    if case.due_date:
        positives.append("У дела указан срок оплаты")
    else:
        blockers.append("Не указан срок оплаты")

    if contract_type:
        positives.append("Тип договора определён")
    else:
        blockers.append("Не указан тип договора")

    if debtor_type:
        positives.append("Тип должника определён")
    else:
        blockers.append("Не определён тип должника")

    warnings = smart.get("warnings") or []
    if isinstance(warnings, list):
        for item in warnings[:3]:
            blockers.append(str(item))

    smart_signals = smart.get("signals") or []
    if isinstance(smart_signals, list):
        for item in smart_signals[:4]:
            signals.append(str(item))

    readiness_level = smart.get("readiness_level")
    readiness_score = smart.get("readiness_score")

    if readiness_level == "ready":
        positives.append("Карточка дела готова к следующему действию")
    elif readiness_level == "partial":
        signals.append("Карточка частично готова, есть пробелы в данных")
    elif readiness_level == "waiting":
        blockers.append("Дело находится в waiting-состоянии")
    elif readiness_level == "draft":
        blockers.append("Дело пока находится в черновом состоянии")

    if readiness_score is not None:
        signals.append(f"Readiness score: {readiness_score}")

    stage_status = stage.get("status")
    if stage_status:
        signals.append(f"Текущая стадия: {stage_status}")

    routing_bucket = routing.get("bucket_code")
    if routing_bucket == "ready":
        positives.append("Маршрутизация показывает, что кейс можно двигать сейчас")
    elif routing_bucket == "waiting":
        blockers.append("Маршрутизация поместила кейс в waiting bucket")
    elif routing_bucket == "blocked":
        blockers.append("Маршрутизация поместила кейс в blocked bucket")
    elif routing_bucket:
        signals.append(f"Routing bucket: {routing_bucket}")

    next_actions = stage.get("actions") or []
    if isinstance(next_actions, list) and next_actions:
        next_action = next_actions[0]
        title = next_action.get("title_ru") or next_action.get("title") or next_action.get("code")
        if title:
            positives.append(f"Следующее доступное действие: {title}")
    else:
        blockers.append("Нет доступных действий на текущем этапе")

    return {
        "positives": list(dict.fromkeys(positives)),
        "blockers": list(dict.fromkeys(blockers)),
        "signals": list(dict.fromkeys(signals)),
    }

def build_case_dashboard(db: Session, case_id: int) -> dict[str, Any]:
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return {}

    projection = get_projection_data_or_rebuild(db, case_id)
    raw_actions = get_available_actions(db, case_id)
    raw_documents = get_available_documents(db, case_id)

    actions = [enrich_action_item(item) for item in raw_actions]
    documents = [enrich_document_item(item) for item in raw_documents]

    next_step = actions[0] if actions else None

    case_status_code = getattr(case.status, "value", case.status)
    stage_status_code = (
        ((projection or {}).get("stage") or {}).get("status")
        if isinstance(projection, dict)
        else None
    )

    # 🔥 ВАЖНО: извлекаем smart из meta
    smart = ((case.meta or {}).get("smart") or {})

    dashboard_case = {
        "id": case.id,
        "tenant_id": case.tenant_id,
        "organization_id": case.organization_id,
        "debtor_name": case.debtor_name,
        "debtor_type": getattr(case.debtor_type, "value", case.debtor_type),
        "debtor_type_title": get_debtor_type_title(case.debtor_type),
        "contract_type": getattr(case.contract_type, "value", case.contract_type),
        "contract_type_title": get_contract_type_title(case.contract_type),
        "principal_amount": str(case.principal_amount) if case.principal_amount is not None else None,
        "due_date": case.due_date.isoformat() if case.due_date else None,
        "status": case_status_code,
        "status_title": get_case_status_title(case_status_code),
        "is_archived": bool(getattr(case, "is_archived", False)),
        "meta": case.meta or {},
    }

    stage_block = dict((projection or {}).get("stage") or {})
    stage_block["status_title"] = get_stage_status_title(stage_status_code)
    stage_block["actions"] = actions

    return {
        **projection,
        "case": dashboard_case,

        # 🔥 КЛЮЧЕВОЕ — теперь smart доступен напрямую
        "smart": smart,

        "status": enrich_status_block(case_status_code),
        "stage": stage_block,
        "next_step": next_step,
        "actions": actions,
        "documents": documents,
        "debtor_widget": debtor_widget(db, case_id),
        "debtor_registry": _related_cases(db, case),
        "soft_policy": _get_soft_policy(case),
        "policy_timing": _build_policy_timing(case),
        "debtor_intelligence": build_debtor_intelligence_payload(db, case),
        "organization_starter_kit": build_organization_starter_kit_payload(db, case),
        "routing": build_routing_snapshot(case),
        "decision_explain": _build_decision_explain(case, projection),
    }