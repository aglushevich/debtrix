from __future__ import annotations

from enum import Enum


class DebtorType(str, Enum):
    company = "company"
    individual = "individual"
    entrepreneur = "entrepreneur"


class ContractType(str, Enum):
    supply = "supply"
    rent = "rent"
    services = "services"
    loan = "loan"
    подряд = "подряд"
    agency = "agency"
    mixed = "mixed"


class CaseStatus(str, Enum):
    draft = "draft"
    overdue = "overdue"
    pretrial = "pretrial"
    court = "court"
    enforcement = "enforcement"
    closed = "closed"


class OrganizationStatus(str, Enum):
    unknown = "unknown"
    active = "active"
    inactive = "inactive"
    ликвидирована = "ликвидирована"