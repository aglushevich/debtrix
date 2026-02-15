from enum import Enum


class DebtorType(str, Enum):
    individual = "individual"
    company = "company"


class ContractType(str, Enum):
    supply = "supply"
    lease = "lease"
    services = "services"
    work = "work"
    loan = "loan"
    utilities = "utilities"
    other = "other"


class CaseStatus(str, Enum):
    draft = "draft"
    overdue = "overdue"
    pretrial = "pretrial"
    court = "court"
    enforcement = "enforcement"
    closed = "closed"