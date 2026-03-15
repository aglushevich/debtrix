from __future__ import annotations

from datetime import datetime, UTC
from typing import Any

from backend.app.models import Case, ExternalAction
from backend.app.services.provider_adapters.base import BaseOutboundProvider


class CourtOutboundProvider(BaseOutboundProvider):
    code = "court"

    def build_payload(self, case: Case, action: ExternalAction) -> dict[str, Any]:
        return {
            "provider": "court",
            "case_id": case.id,
            "debtor_name": case.debtor_name,
            "contract_type": case.contract_type,
            "principal_amount": str(case.principal_amount),
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
            "provider": "court",
            "status": "accepted",
            "filing_id": f"COURT-{case.id}-{action.id}",
            "sent_at": sent_at,
            "echo": payload,
        }