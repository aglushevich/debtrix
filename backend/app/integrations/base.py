from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models import Case


class BaseIntegrationProvider(ABC):
    code: str

    @abstractmethod
    def sync_case(
        self,
        db: Session,
        *,
        case: Case,
        tenant_id: int,
    ) -> dict[str, Any]:
        raise NotImplementedError