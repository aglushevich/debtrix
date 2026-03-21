from __future__ import annotations

from datetime import date, datetime
from typing import Any

from backend.app.models.case import Case


def _safe_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except Exception:
        return 0.0


def _safe_int(value: Any) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except Exception:
        return 0


def _to_str(value: Any) -> str:
    return str(value or "").strip()


def _unique(items: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()

    for item in items:
        value = _to_str(item)
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)

    return result


def _days_overdue(case: Case) -> int:
    if not case.due_date:
        return 0
    try:
        return max((date.today() - case.due_date).days, 0)
    except Exception:
        return 0


def _priority_band(score: int) -> str:
    if score >= 85:
        return "critical"
    if score >= 65:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _band_label(band: str) -> str:
    mapping = {
        "critical": "Критический",
        "high": "Высокий",
        "medium": "Средний",
        "low": "Низкий",
    }
    return mapping.get(band, band)


def _operator_focus(
    *,
    routing_status: str,
    next_step_title: str | None,
    blockers: list[str],
    waiting_eligible_at: str | None,
    route_lane: str | None,
) -> str:
    if routing_status == "blocked":
        if blockers:
            return f"Снять blocker: {blockers[0]}"
        return "Снять blocker’ы и вернуть кейс в работу"

    if routing_status == "waiting":
        if waiting_eligible_at:
            return f"Контролировать eligible_at: {waiting_eligible_at}"
        return "Контролировать waiting window"

    if route_lane == "court_lane":
        return "Проверить следующий шаг судебного трека"

    if route_lane == "enforcement_lane":
        return "Проверить следующий шаг исполнительного трека"

    if next_step_title:
        return f"Выполнить: {next_step_title}"

    return "Открыть карточку и проверить следующий шаг"


def build_case_priority_snapshot(
    *,
    case: Case,
    dashboard: dict[str, Any],
    routing_row: dict[str, Any] | None = None,
    blocked_reasons: list[str] | None = None,
) -> dict[str, Any]:
    routing_row = routing_row or {}
    blocked_reasons = blocked_reasons or []

    smart = dict(dashboard.get("smart") or {})
    decision_explain = dict(dashboard.get("decision_explain") or {})
    debtor_intelligence = dict(dashboard.get("debtor_intelligence") or {})
    debtor_intelligence_summary = dict(debtor_intelligence.get("summary") or {})
    debtor_registry = dict(dashboard.get("debtor_registry") or {})
    next_step = dict(dashboard.get("next_step") or {})

    positives = list(decision_explain.get("positives") or [])
    blockers = list(decision_explain.get("blockers") or [])
    signals = list(decision_explain.get("signals") or [])

    merged_blockers = _unique(blockers + list(blocked_reasons))
    merged_signals = _unique(signals + list(debtor_intelligence.get("signals") or []))

    amount = _safe_float(case.principal_amount)
    days_overdue = _days_overdue(case)
    smart_level = _to_str(smart.get("readiness_level") or "draft").lower()
    smart_score = _safe_int(smart.get("readiness_score"))
    routing_status = _to_str(routing_row.get("routing_status") or dashboard.get("routing", {}).get("status"))
    route_lane = _to_str(routing_row.get("route_lane"))
    waiting_eligible_at = routing_row.get("waiting_eligible_at")
    related_cases_count = _safe_int((debtor_registry.get("summary") or {}).get("cases_count"))
    debtor_risk_score = _safe_int(debtor_intelligence_summary.get("risk_score"))
    next_step_title = (
        next_step.get("title_ru")
        or next_step.get("title")
        or next_step.get("code")
    )

    score = 0
    reasons: list[str] = []

    if amount >= 1_000_000:
        score += 24
        reasons.append("Крупная сумма долга")
    elif amount >= 500_000:
        score += 18
        reasons.append("Выше среднего сумма долга")
    elif amount >= 100_000:
        score += 12
        reasons.append("Значимая сумма долга")
    elif amount > 0:
        score += 6
        reasons.append("Есть непогашенная сумма долга")

    if days_overdue >= 365:
        score += 20
        reasons.append("Сильная просрочка")
    elif days_overdue >= 90:
        score += 14
        reasons.append("Длительная просрочка")
    elif days_overdue > 0:
        score += 8
        reasons.append("Есть просрочка")

    if routing_status == "ready":
        score += 18
        reasons.append("Кейс доступен к выполнению сейчас")
    elif routing_status == "waiting":
        score -= 10
        reasons.append("Кейс находится в waiting bucket")
    elif routing_status == "blocked":
        score -= 22
        reasons.append("Кейс заблокирован")
    elif routing_status == "queued":
        score -= 6
        reasons.append("Кейс ещё не выведен в активный throughput")

    if smart_level == "ready":
        score += 16
        reasons.append("Карточка хорошо подготовлена")
    elif smart_level == "partial":
        score += 6
        reasons.append("Карточка частично готова")
    elif smart_level == "waiting":
        score -= 8
        reasons.append("Readiness указывает на waiting-состояние")
    elif smart_level == "draft":
        score -= 16
        reasons.append("Карточка ещё черновая")

    if smart_score >= 80:
        score += 8
    elif smart_score >= 60:
        score += 4
    elif smart_score <= 20:
        score -= 6

    if next_step_title:
        score += 10
        reasons.append("Есть конкретное следующее действие")

    if related_cases_count >= 3:
        score += 10
        reasons.append("Есть портфельный контекст по должнику")
    elif related_cases_count == 2:
        score += 6
        reasons.append("Есть связанные кейсы по должнику")

    if debtor_risk_score >= 80:
        score += 10
        reasons.append("Высокий debtor intelligence risk")
    elif debtor_risk_score >= 60:
        score += 6
        reasons.append("Повышенный debtor intelligence risk")

    score -= min(len(merged_blockers) * 8, 32)

    if route_lane == "court_lane":
        score += 6
        reasons.append("Кейс находится в court lane")
    elif route_lane == "enforcement_lane":
        score += 5
        reasons.append("Кейс находится в enforcement lane")

    score = max(0, min(100, int(score)))

    band = _priority_band(score)

    return {
        "priority_score": score,
        "priority_band": band,
        "priority_band_label": _band_label(band),
        "priority_reasons": _unique(reasons),
        "decision_positives": _unique(positives),
        "decision_blockers": _unique(merged_blockers),
        "decision_signals": _unique(merged_signals),
        "operator_focus": _operator_focus(
            routing_status=routing_status,
            next_step_title=next_step_title,
            blockers=merged_blockers,
            waiting_eligible_at=waiting_eligible_at,
            route_lane=route_lane or None,
        ),
        "ready_now": routing_status == "ready" and not merged_blockers,
        "blocked": routing_status == "blocked" or bool(merged_blockers),
        "waiting": routing_status == "waiting",
        "computed_at": datetime.utcnow().isoformat(),
    }