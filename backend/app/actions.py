from enum import Enum

class DebtAction(str, Enum):
    REMIND = "remind"
    PRETENSION = "pretension"
    PREPARE_DOCS = "prepare_docs"
    CLOSE = "close"
