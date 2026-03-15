from __future__ import annotations

from datetime import datetime, UTC
from typing import Any

from backend.app.models import Case, ExternalAction
from backend.app.services.provider_adapters.base import BaseOutboundProvider


class RussianPostOutboundProvider(BaseOutboundProvider):
    code = "russian_post"

    def build_payload(self, case: Case, action: ExternalAction) -> dict[str, Any]:
        debtor = dict((case.contract_data or {}).get("debtor") or {})
        return {
            "provider": "russian_post",
            "case_id": case.id,
            "recipient_name": case.debtor_name,
            "recipient_address": debtor.get("address"),
            "document_bundle": action.action_code,
            "prepared_at": datetime.now(UTC).isoformat(),
        }

    def send(
        self,
        case: Case,
        action: ExternalAction,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        sent_at = datetime.now(UTC).isoformat()
        return {
            "provider": "russian_post",
            "status": "accepted",
            "tracking_number": f"RPOST-{case.id}-{action.id}",
            "sent_at": sent_at,
            "echo": payload,
        }