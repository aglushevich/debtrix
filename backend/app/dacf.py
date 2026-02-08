from typing import List
from debt_case import DebtCase
from actions import DebtAction


def detect_actions(debt: DebtCase) -> List[DebtAction]:
    actions = []

    days = debt.days_overdue()

    if days >= 1 and not debt.notified:
        actions.append(DebtAction.REMIND)

    if days >= 30 and not debt.notified:
        actions.append(DebtAction.PRETENSION)

    if days >= 60 and not debt.documents_prepared:
        actions.append(DebtAction.PREPARE_DOCS)

    if debt.closed:
        actions.append(DebtAction.CLOSE)

    return actions