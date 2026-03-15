from __future__ import annotations

from typing import Any


def lookup_organization_by_identifiers(
    *,
    inn: str | None = None,
    ogrn: str | None = None,
) -> dict[str, Any]:
    if not inn and not ogrn:
        raise ValueError("Need inn or ogrn")

    resolved_inn = inn or "4205301694"
    resolved_ogrn = ogrn or "1154205000674"

    return {
        "inn": resolved_inn,
        "ogrn": resolved_ogrn,
        "name": "ОРГАНИЗАЦИЯ ПО ДАННЫМ MOCK-ФНС",
        "name_full": "ОРГАНИЗАЦИЯ ПО ДАННЫМ MOCK-ФНС",
        "name_short": "ОРГАНИЗАЦИЯ MOCK",
        "kpp": None,
        "address": None,
        "director_name": None,
        "status": "unknown",
        "registration_date": None,
        "okved_main": None,
        "source": "fns_mock",
        "raw": {
            "mock": True,
            "note": "Совпадение в mock-справочнике не найдено",
        },
    }