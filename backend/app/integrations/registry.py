from __future__ import annotations

from backend.app.integrations.base import BaseIntegrationProvider
from backend.app.integrations.fns_provider import FnsIntegrationProvider


_INTEGRATION_PROVIDERS: dict[str, BaseIntegrationProvider] = {
    "fns": FnsIntegrationProvider(),
}


def get_provider(code: str) -> BaseIntegrationProvider:
    normalized = (code or "").strip().lower()
    provider = _INTEGRATION_PROVIDERS.get(normalized)
    if not provider:
        raise ValueError(f"Unknown integration provider: {code}")
    return provider