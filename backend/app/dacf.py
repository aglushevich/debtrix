from typing import List
from debt_case import DebtCase
from actions import DebtAction


from logs import LogEventType

def detect_actions(debt: DebtCase) -> List[DebtAction]:
    actions = []

    days = debt.days_overdue()

    if days >= 1 and not debt.notified:
        actions.append(DebtAction.REMIND)
        debt.add_log(
            LogEventType.ACTION_SUGGESTED,
            "Предложено отправить напоминание должнику"
        )

    if days >= 30 and not debt.notified:
        actions.append(DebtAction.PRETENSION)
        debt.add_log(
            LogEventType.ACTION_SUGGESTED,
            "Предложено сформировать досудебную претензию"
        )

    if days >= 60 and not debt.documents_prepared:
        actions.append(DebtAction.PREPARE_DOCS)
        debt.add_log(
            LogEventType.ACTION_SUGGESTED,
            "Предложено подготовить документы в суд"
        )

    return actions