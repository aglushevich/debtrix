from enum import Enum

class DebtStatus(str, Enum):
    NEW = "new"
    OVERDUE = "overdue"
    NOTIFIED = "notified"
    DOCUMENTS = "documents"
    CLOSED = "closed"