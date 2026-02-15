from __future__ import annotations

from datetime import date, timedelta
from typing import List

from backend.app.logs import DebtLogEntry, LogEventType


class DebtStatus(str):
    """
    Demo-статусы для реестра /debts (не равны CaseStatus из БД).
    """
    NEW = "new"
    OVERDUE = "overdue"
    NOTIFIED = "notified"
    DOCUMENTS = "documents"
    CLOSED = "closed"


class DebtCase:
    def __init__(self, debtor: str, amount: float, due_date: date):
        self.debtor = debtor
        self.amount = amount
        self.due_date = due_date

        # эти флаги мы будем подтягивать из case.contract_data["stage"]
        self.notified = False
        self.documents_prepared = False
        self.closed = False

        self.logs: List[DebtLogEntry] = []

    def days_overdue(self) -> int:
        today = date.today()
        overdue_start = self.due_date + timedelta(days=1)

        if today < overdue_start:
            return 0

        return (today - overdue_start).days + 1

    def status(self) -> str:
        if self.closed:
            return DebtStatus.CLOSED
        if self.documents_prepared:
            return DebtStatus.DOCUMENTS
        if self.notified:
            return DebtStatus.NOTIFIED
        if self.days_overdue() > 0:
            return DebtStatus.OVERDUE
        return DebtStatus.NEW

    def add_log(self, event_type: LogEventType, message: str):
        self.logs.append(DebtLogEntry(event_type=event_type, message=message))