from __future__ import annotations

from typing import Any

DOCUMENT_TITLES_RU: dict[str, str] = {
    "payment_due_notice": "Напоминание о наступлении срока оплаты",
    "debt_notice": "Уведомление о задолженности",
    "pretension": "Досудебная претензия",
    "lawsuit": "Исковое заявление",
    "court_order": "Заявление о выдаче судебного приказа",
    "fssp_application": "Заявление в ФССП",
}


def get_document_title_ru(code: str | None) -> str:
    normalized = str(code or "").strip()
    return DOCUMENT_TITLES_RU.get(normalized, normalized or "Документ")


def enrich_document_definitions(items: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []

    for item in items or []:
        row = dict(item or {})
        row["title_ru"] = get_document_title_ru(row.get("code"))
        result.append(row)

    return result