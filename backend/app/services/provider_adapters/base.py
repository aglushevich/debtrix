from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from backend.app.models import Case, ExternalAction


class BaseOutboundProvider(ABC):
    code: str

    @abstractmethod
    def build_payload(self, case: Case, action: ExternalAction) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def send(
        self,
        case: Case,
        action: ExternalAction,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        raise NotImplementedError