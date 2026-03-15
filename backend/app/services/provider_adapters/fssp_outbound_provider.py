from __future__ import annotations

from datetime import datetime, UTC
from typing import Any

from backend.app.models import Case, ExternalAction
from backend.app.services.provider_adapters.base import BaseOutboundProvider


class FsspOutboundProvider(BaseOutboundProvider):
    code = "fssp"

    def build_payload(self, case: Case, action: ExternalAction) -> dict[str, Any]:
        debtor = dict((case.contract_data or {}).get("debtor") or {})
        return {
            "provider": "fssp",
            "case_id": case.id,
            "debtor_name": case.debtor_name,
            "debtor_inn": debtor.get("inn"),
            "debtor_ogrn": debtor.get("ogrn"),
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
            "provider": "fssp",
            "status": "accepted",
            "submission_id": f"FSSP-{case.id}-{action.id}",
            "sent_at": sent_at,
            "echo": payload,
        }