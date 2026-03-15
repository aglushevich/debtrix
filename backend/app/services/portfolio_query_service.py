from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Query, Session

from backend.app.models import Case
from backend.app.models.automation_run import AutomationRun
from backend.app.models.external_action import ExternalAction
from backend.app.services.tenant_query_service import filter_cases_by_tenant


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


@dataclass
class PortfolioCaseRow:
    case_id: int
    debtor_name: str | None
    debtor_type: str | None
    contract_type: str | None
    principal_amount: str
    due_date: str | None
    case_status: str | None
    is_archived: bool
    days_overdue: int | None
    debtor_inn: str | None
    debtor_ogrn: str | None
    waiting_runs_count: int
    blocked_runs_count: int
    pending_runs_count: int
    external_actions_count: int


def _case_status_value(case: Case) -> str | None:
    return getattr(case.status, "value", case.status if case.status else None)


def _contract_type_value(case: Case) -> str | None:
    return getattr(case.contract_type, "value", case.contract_type if case.contract_type else None)


def _debtor_type_value(case: Case) -> str | None:
    return getattr(case.debtor_type, "value", case.debtor_type if case.debtor_type else None)


def _extract_debtor_identifiers(case: Case) -> tuple[str | None, str | None]:
    debtor = dict((case.contract_data or {}).get("debtor") or {})
    return debtor.get("inn"), debtor.get("ogrn")


def _calc_days_overdue(case: Case) -> int | None:
    if not case.due_date:
        return None

    today = _utcnow().date()
    delta = (today - case.due_date).days
    return max(delta, 0)


def _apply_case_filters(
    db: Session,
    *,
    tenant_id: int,
    filters: dict[str, Any],
) -> list[Case]:
    include_archived = bool(filters.get("include_archived", False))

    query: Query = db.query(Case).order_by(Case.id.desc())
    query = filter_cases_by_tenant(
        query,
        tenant_id,
        include_archived=include_archived,
    )

    case_ids = [int(item) for item in (filters.get("case_ids") or [])]
    if case_ids:
        query = query.filter(Case.id.in_(case_ids))

    case_status_in = [str(item) for item in (filters.get("case_status_in") or [])]
    if case_status_in:
        query = query.filter(Case.status.in_(case_status_in))

    contract_type_in = [str(item) for item in (filters.get("contract_type_in") or [])]
    if contract_type_in:
        query = query.filter(Case.contract_type.in_(contract_type_in))

    debtor_type_in = [str(item) for item in (filters.get("debtor_type_in") or [])]
    if debtor_type_in:
        query = query.filter(Case.debtor_type.in_(debtor_type_in))

    search = (filters.get("search") or "").strip()
    if search:
        like_value = f"%{search}%"
        query = query.filter(
            or_(
                Case.debtor_name.ilike(like_value),
            )
        )

    cases = query.all()

    min_days_overdue = filters.get("min_days_overdue")
    max_days_overdue = filters.get("max_days_overdue")
    require_debtor_identifiers = bool(filters.get("require_debtor_identifiers", False))

    filtered_cases: list[Case] = []
    for case in cases:
        days_overdue = _calc_days_overdue(case)
        inn, ogrn = _extract_debtor_identifiers(case)

        if min_days_overdue is not None:
            if days_overdue is None or days_overdue < int(min_days_overdue):
                continue

        if max_days_overdue is not None:
            if days_overdue is None or days_overdue > int(max_days_overdue):
                continue

        if require_debtor_identifiers and not (inn or ogrn):
            continue

        filtered_cases.append(case)

    return filtered_cases


def _count_runs_by_status(
    db: Session,
    *,
    tenant_id: int,
    case_ids: list[int],
    status: str,
) -> dict[int, int]:
    if not case_ids:
        return {}

    rows = (
        db.query(
            AutomationRun.case_id,
            func.count(AutomationRun.id),
        )
        .filter(
            AutomationRun.tenant_id == tenant_id,
            AutomationRun.case_id.in_(case_ids),
            AutomationRun.status == status,
        )
        .group_by(AutomationRun.case_id)
        .all()
    )
    return {int(case_id): int(count) for case_id, count in rows}


def _count_external_actions(
    db: Session,
    *,
    tenant_id: int,
    case_ids: list[int],
) -> dict[int, int]:
    if not case_ids:
        return {}

    rows = (
        db.query(
            ExternalAction.case_id,
            func.count(ExternalAction.id),
        )
        .filter(
            ExternalAction.tenant_id == tenant_id,
            ExternalAction.case_id.in_(case_ids),
        )
        .group_by(ExternalAction.case_id)
        .all()
    )
    return {int(case_id): int(count) for case_id, count in rows}


def _apply_run_presence_filters(
    rows: list[PortfolioCaseRow],
    *,
    filters: dict[str, Any],
) -> list[PortfolioCaseRow]:
    has_waiting_runs = filters.get("has_waiting_runs")
    has_blocked_runs = filters.get("has_blocked_runs")
    has_pending_runs = filters.get("has_pending_runs")
    has_external_actions = filters.get("has_external_actions")

    result: list[PortfolioCaseRow] = []
    for row in rows:
        if has_waiting_runs is True and row.waiting_runs_count <= 0:
            continue
        if has_waiting_runs is False and row.waiting_runs_count > 0:
            continue

        if has_blocked_runs is True and row.blocked_runs_count <= 0:
            continue
        if has_blocked_runs is False and row.blocked_runs_count > 0:
            continue

        if has_pending_runs is True and row.pending_runs_count <= 0:
            continue
        if has_pending_runs is False and row.pending_runs_count > 0:
            continue

        if has_external_actions is True and row.external_actions_count <= 0:
            continue
        if has_external_actions is False and row.external_actions_count > 0:
            continue

        result.append(row)

    return result


def _sort_rows(
    rows: list[PortfolioCaseRow],
    *,
    order_by: str,
) -> list[PortfolioCaseRow]:
    if order_by == "id_asc":
        return sorted(rows, key=lambda x: x.case_id)
    if order_by == "due_date_asc":
        return sorted(rows, key=lambda x: (x.due_date is None, x.due_date or ""))
    if order_by == "due_date_desc":
        return sorted(rows, key=lambda x: (x.due_date is None, x.due_date or ""), reverse=True)
    if order_by == "principal_amount_asc":
        return sorted(rows, key=lambda x: float(x.principal_amount or "0"))
    if order_by == "principal_amount_desc":
        return sorted(rows, key=lambda x: float(x.principal_amount or "0"), reverse=True)
    return sorted(rows, key=lambda x: x.case_id, reverse=True)


def build_portfolio_rows(
    db: Session,
    *,
    tenant_id: int,
    filters: dict[str, Any],
    order_by: str = "id_desc",
) -> list[PortfolioCaseRow]:
    cases = _apply_case_filters(
        db,
        tenant_id=tenant_id,
        filters=filters,
    )
    case_ids = [case.id for case in cases]

    waiting_counts = _count_runs_by_status(
        db,
        tenant_id=tenant_id,
        case_ids=case_ids,
        status="waiting",
    )
    blocked_counts = _count_runs_by_status(
        db,
        tenant_id=tenant_id,
        case_ids=case_ids,
        status="blocked",
    )
    pending_counts = _count_runs_by_status(
        db,
        tenant_id=tenant_id,
        case_ids=case_ids,
        status="pending",
    )
    external_counts = _count_external_actions(
        db,
        tenant_id=tenant_id,
        case_ids=case_ids,
    )

    rows: list[PortfolioCaseRow] = []
    for case in cases:
        inn, ogrn = _extract_debtor_identifiers(case)
        row = PortfolioCaseRow(
            case_id=case.id,
            debtor_name=case.debtor_name,
            debtor_type=_debtor_type_value(case),
            contract_type=_contract_type_value(case),
            principal_amount=str(case.principal_amount),
            due_date=case.due_date.isoformat() if case.due_date else None,
            case_status=_case_status_value(case),
            is_archived=bool(getattr(case, "is_archived", False)),
            days_overdue=_calc_days_overdue(case),
            debtor_inn=inn,
            debtor_ogrn=ogrn,
            waiting_runs_count=waiting_counts.get(case.id, 0),
            blocked_runs_count=blocked_counts.get(case.id, 0),
            pending_runs_count=pending_counts.get(case.id, 0),
            external_actions_count=external_counts.get(case.id, 0),
        )
        rows.append(row)

    rows = _apply_run_presence_filters(
        rows,
        filters=filters,
    )
    rows = _sort_rows(
        rows,
        order_by=order_by,
    )

    return rows


def query_portfolio(
    db: Session,
    *,
    tenant_id: int,
    filters: dict[str, Any],
    limit: int = 100,
    offset: int = 0,
    order_by: str = "id_desc",
) -> dict[str, Any]:
    rows = build_portfolio_rows(
        db,
        tenant_id=tenant_id,
        filters=filters,
        order_by=order_by,
    )

    total = len(rows)
    items = rows[offset : offset + limit]

    return {
        "filters": filters,
        "order_by": order_by,
        "limit": limit,
        "offset": offset,
        "total": total,
        "items": [
            {
                "case_id": item.case_id,
                "debtor_name": item.debtor_name,
                "debtor_type": item.debtor_type,
                "contract_type": item.contract_type,
                "principal_amount": item.principal_amount,
                "due_date": item.due_date,
                "case_status": item.case_status,
                "is_archived": item.is_archived,
                "days_overdue": item.days_overdue,
                "debtor_inn": item.debtor_inn,
                "debtor_ogrn": item.debtor_ogrn,
                "waiting_runs_count": item.waiting_runs_count,
                "blocked_runs_count": item.blocked_runs_count,
                "pending_runs_count": item.pending_runs_count,
                "external_actions_count": item.external_actions_count,
            }
            for item in items
        ],
    }


def portfolio_summary(
    db: Session,
    *,
    tenant_id: int,
    filters: dict[str, Any],
    order_by: str = "id_desc",
) -> dict[str, Any]:
    rows = build_portfolio_rows(
        db,
        tenant_id=tenant_id,
        filters=filters,
        order_by=order_by,
    )

    total_cases = len(rows)
    total_principal_amount = sum(float(item.principal_amount or "0") for item in rows)

    by_case_status: dict[str, int] = {}
    by_contract_type: dict[str, int] = {}
    by_debtor_type: dict[str, int] = {}

    total_waiting = 0
    total_blocked = 0
    total_pending = 0
    total_with_external_actions = 0

    for item in rows:
        case_status = item.case_status or "unknown"
        contract_type = item.contract_type or "unknown"
        debtor_type = item.debtor_type or "unknown"

        by_case_status[case_status] = by_case_status.get(case_status, 0) + 1
        by_contract_type[contract_type] = by_contract_type.get(contract_type, 0) + 1
        by_debtor_type[debtor_type] = by_debtor_type.get(debtor_type, 0) + 1

        if item.waiting_runs_count > 0:
            total_waiting += 1
        if item.blocked_runs_count > 0:
            total_blocked += 1
        if item.pending_runs_count > 0:
            total_pending += 1
        if item.external_actions_count > 0:
            total_with_external_actions += 1

    return {
        "filters": filters,
        "total_cases": total_cases,
        "total_principal_amount": f"{total_principal_amount:.2f}",
        "by_case_status": by_case_status,
        "by_contract_type": by_contract_type,
        "by_debtor_type": by_debtor_type,
        "total_waiting_cases": total_waiting,
        "total_blocked_cases": total_blocked,
        "total_pending_cases": total_pending,
        "total_cases_with_external_actions": total_with_external_actions,
    }


def portfolio_buckets(
    db: Session,
    *,
    tenant_id: int,
    filters: dict[str, Any],
    order_by: str = "id_desc",
) -> dict[str, Any]:
    rows = build_portfolio_rows(
        db,
        tenant_id=tenant_id,
        filters=filters,
        order_by=order_by,
    )

    waiting_items: list[dict[str, Any]] = []
    blocked_items: list[dict[str, Any]] = []
    ready_items: list[dict[str, Any]] = []
    passive_items: list[dict[str, Any]] = []

    for item in rows:
        payload = {
            "case_id": item.case_id,
            "debtor_name": item.debtor_name,
            "case_status": item.case_status,
            "contract_type": item.contract_type,
            "principal_amount": item.principal_amount,
            "days_overdue": item.days_overdue,
            "waiting_runs_count": item.waiting_runs_count,
            "blocked_runs_count": item.blocked_runs_count,
            "pending_runs_count": item.pending_runs_count,
            "external_actions_count": item.external_actions_count,
        }

        if item.waiting_runs_count > 0:
            waiting_items.append(payload)
        elif item.blocked_runs_count > 0:
            blocked_items.append(payload)
        elif item.pending_runs_count > 0:
            ready_items.append(payload)
        else:
            passive_items.append(payload)

    return {
        "filters": filters,
        "buckets": {
            "waiting": {
                "count": len(waiting_items),
                "items": waiting_items,
            },
            "blocked": {
                "count": len(blocked_items),
                "items": blocked_items,
            },
            "ready": {
                "count": len(ready_items),
                "items": ready_items,
            },
            "passive": {
                "count": len(passive_items),
                "items": passive_items,
            },
        },
    }


def resolve_case_ids_for_portfolio(
    db: Session,
    *,
    tenant_id: int,
    filters: dict[str, Any],
    order_by: str = "id_desc",
    limit: int = 1000,
) -> list[int]:
    rows = build_portfolio_rows(
        db,
        tenant_id=tenant_id,
        filters=filters,
        order_by=order_by,
    )
    return [item.case_id for item in rows[:limit]]