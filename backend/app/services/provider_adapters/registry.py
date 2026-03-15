from __future__ import annotations

from backend.app.services.provider_adapters.base import BaseOutboundProvider
from backend.app.services.provider_adapters.court_outbound_provider import (
    CourtOutboundProvider,
)
from backend.app.services.provider_adapters.fssp_outbound_provider import (
    FsspOutboundProvider,
)
from backend.app.services.provider_adapters.russian_post_outbound_provider import (
    RussianPostOutboundProvider,
)


_OUTBOUND_PROVIDERS: dict[str, BaseOutboundProvider] = {
    "fssp": FsspOutboundProvider(),
    "russian_post": RussianPostOutboundProvider(),
    "court": CourtOutboundProvider(),
}


def get_outbound_provider(code: str) -> BaseOutboundProvider:
    normalized = (code or "").strip().lower()
    provider = _OUTBOUND_PROVIDERS.get(normalized)
    if not provider:
        raise ValueError(f"Unknown outbound provider: {code}")
    return provider