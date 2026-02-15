from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, List, Mapping, Optional

from backend.app.debt_case import DebtCase
from backend.app.enums import ContractType
from backend.app.logs import LogEventType


class StageAction(str, Enum):
    REMIND = "remind"
    PRETENSION = "pretension"
    PREPARE_DOCS = "prepare_docs"
    CLOSE = "close"


class StageStatus(str, Enum):
    NEW = "new"
    OVERDUE = "overdue"
    NOTIFIED = "notified"
    DOCUMENTS = "documents"
    CLOSED = "closed"


@dataclass
class StageResult:
    status: StageStatus
    actions: List[StageAction]


def compute_stage(
    debt: DebtCase,
    contract_type: ContractType,
    contract_data: Optional[Mapping[str, Any]] = None,
) -> StageResult:
    """
    Возвращает статус и список предлагаемых действий для UI.
    contract_data — это расширяемые данные карточки (case.contract_data из БД).
    """
    contract_data = contract_data or {}

    if contract_type == ContractType.loan:
        return _stage_for_loan(debt, contract_data)

    if contract_type == ContractType.utilities:
        return _stage_for_utilities(debt, contract_data)

    # default: supply / lease / services / work / other
    return _stage_default(debt)


def _calc_status(debt: DebtCase) -> StageStatus:
    days = debt.days_overdue()

    if debt.closed:
        return StageStatus.CLOSED
    if debt.documents_prepared:
        return StageStatus.DOCUMENTS
    if debt.notified:
        return StageStatus.NOTIFIED
    if days > 0:
        return StageStatus.OVERDUE
    return StageStatus.NEW


def _maybe_log(debt: DebtCase, message: str) -> None:
    """
    Чтобы /debts не "раздувал" логи на каждом GET.
    Добавляем лог только если такого сообщения ещё нет.
    """
    for entry in debt.logs:
        if entry.event_type == LogEventType.ACTION_SUGGESTED and entry.message == message:
            return
    debt.add_log(LogEventType.ACTION_SUGGESTED, message)


def _stage_default(debt: DebtCase) -> StageResult:
    days = debt.days_overdue()
    status = _calc_status(debt)

    actions: List[StageAction] = []

    if days >= 1 and not debt.notified:
        actions.append(StageAction.REMIND)
        _maybe_log(debt, "Предложено отправить напоминание должнику")

    if days >= 30 and not debt.notified:
        actions.append(StageAction.PRETENSION)
        _maybe_log(debt, "Предложено сформировать досудебную претензию")

    if days >= 60 and not debt.documents_prepared:
        actions.append(StageAction.PREPARE_DOCS)
        _maybe_log(debt, "Предложено подготовить документы в суд")

    actions.append(StageAction.CLOSE)
    return StageResult(status=status, actions=actions)


def _stage_for_loan(debt: DebtCase, contract_data: Mapping[str, Any]) -> StageResult:
    days = debt.days_overdue()
    status = _calc_status(debt)

    # Для ПКО/займов: пороги можно менять на основе карточки
    is_319 = bool(contract_data.get("is_319_applicable", False))

    pretension_day = 10 if is_319 else 14
    docs_day = 25 if is_319 else 30

    actions: List[StageAction] = []

    if days >= 1 and not debt.notified:
        actions.append(StageAction.REMIND)
        _maybe_log(debt, "Займ: предложено отправить напоминание")

    if days >= pretension_day and not debt.notified:
        actions.append(StageAction.PRETENSION)
        _maybe_log(debt, f"Займ: предложено сформировать претензию (порог {pretension_day} дн.)")

    if days >= docs_day and not debt.documents_prepared:
        actions.append(StageAction.PREPARE_DOCS)
        _maybe_log(debt, f"Займ: предложено подготовить документы в суд (порог {docs_day} дн.)")

    actions.append(StageAction.CLOSE)
    return StageResult(status=status, actions=actions)


def _stage_for_utilities(debt: DebtCase, contract_data: Mapping[str, Any]) -> StageResult:
    days = debt.days_overdue()
    status = _calc_status(debt)

    actions: List[StageAction] = []

    if days >= 1 and not debt.notified:
        actions.append(StageAction.REMIND)
        _maybe_log(debt, "ЖКУ: предложено уведомить должника")

    if days >= 10 and not debt.notified:
        actions.append(StageAction.PRETENSION)
        _maybe_log(debt, "ЖКУ: предложено сформировать претензию")

    if days >= 45 and not debt.documents_prepared:
        actions.append(StageAction.PREPARE_DOCS)
        _maybe_log(debt, "ЖКУ: предложено подготовить документы в суд")

    actions.append(StageAction.CLOSE)
    return StageResult(status=status, actions=actions)