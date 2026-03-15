from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.app.integrations.base import BaseIntegrationProvider
from backend.app.models import Case


class FnsIntegrationProvider(BaseIntegrationProvider):
    code = "fns"

    def sync_case(
        self,
        db: Session,
        *,
        case: Case,
        tenant_id: int,
    ) -> dict[str, Any]:
        debtor_block = dict((case.contract_data or {}).get("debtor") or {})

        inn = debtor_block.get("inn")
        ogrn = debtor_block.get("ogrn")

        if not inn and not ogrn:
            return {
                "ok": False,
                "status": "error",
                "error": "ИНН или ОГРН не указаны",
                "details": {
                    "inn": inn,
                    "ogrn": ogrn,
                    "source": "fns_mock",
                },
            }

        details: dict[str, Any] = {
            "inn": inn or "4205301694",
            "ogrn": ogrn or "1154205000674",
            "name": debtor_block.get("name") or "ОРГАНИЗАЦИЯ ПО ДАННЫМ MOCK-ФНС",
            "name_full": debtor_block.get("name_full") or "ОРГАНИЗАЦИЯ ПО ДАННЫМ MOCK-ФНС",
            "name_short": debtor_block.get("name_short") or "ОРГАНИЗАЦИЯ MOCK",
            "kpp": debtor_block.get("kpp"),
            "address": debtor_block.get("address"),
            "director_name": debtor_block.get("director_name"),
            "status": debtor_block.get("status") or "unknown",
            "registration_date": debtor_block.get("registration_date"),
            "okved_main": debtor_block.get("okved_main"),
            "source": "fns_mock",
            "raw": {
                "mock": True,
                "note": "Совпадение в mock-справочнике не найдено",
            },
        }

        return {
            "ok": True,
            "status": "synced",
            "external_id": details["inn"] or details["ogrn"],
            "details": details,
        }