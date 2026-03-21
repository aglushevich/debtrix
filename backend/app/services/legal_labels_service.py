from __future__ import annotations

from typing import Any


CASE_STATUS_TITLES: dict[str, str] = {
    "draft": "Черновик",
    "overdue": "Просроченная задолженность",
    "pretrial": "Досудебное взыскание",
    "court": "Судебное взыскание",
    "fssp": "Работа с ФССП",
    "enforcement": "Исполнительное производство",
    "closed": "Дело завершено",
}

STAGE_STATUS_TITLES: dict[str, str] = {
    "new": "Новый кейс",
    "payment_due_notice_sent": "Направлено первое уведомление",
    "debt_notice_sent": "Направлено уведомление о задолженности",
    "pretrial": "Досудебная стадия",
    "documents": "Подготовка судебных документов",
    "enforcement": "Исполнительное производство",
    "closed": "Дело завершено",
}

DOCUMENT_TITLES: dict[str, str] = {
    "payment_due_notice": "Напоминание о наступлении срока оплаты",
    "debt_notice": "Уведомление о задолженности",
    "pretension": "Досудебная претензия",
    "lawsuit": "Исковое заявление",
    "court_order": "Заявление о выдаче судебного приказа",
    "fssp_application": "Заявление в ФССП",
}

ACTION_TITLES: dict[str, str] = {
    "send_payment_due_notice": "Направить первое уведомление",
    "send_debt_notice": "Направить уведомление о задолженности",
    "send_pretension": "Направить досудебную претензию",
    "prepare_lawsuit": "Подготовить исковое заявление",
    "submit_to_court": "Подать документы в суд",
    "prepare_fssp_application": "Подготовить заявление в ФССП",
    "send_to_fssp": "Направить документы в ФССП",
    "close_case": "Завершить дело",
    "archive_case": "Перевести дело в архив",
    "unarchive_case": "Вернуть дело из архива",
}

DEBTOR_TYPE_TITLES: dict[str, str] = {
    "company": "Юридическое лицо",
    "individual": "Физическое лицо",
    "entrepreneur": "Индивидуальный предприниматель",
}

CONTRACT_TYPE_TITLES: dict[str, str] = {
    "supply": "Поставка",
    "rent": "Аренда",
    "services": "Услуги",
    "loan": "Заем",
    "utility": "ЖКХ",
}

ROUTING_STATUS_TITLES: dict[str, str] = {
    "ready": "Готово к выполнению",
    "waiting": "Ожидание срока",
    "blocked": "Заблокировано",
    "idle": "Без активного шага",
    "eligible": "Можно выполнять",
    "not_applicable": "Не применяется",
}

ROUTING_BUCKET_TITLES: dict[str, str] = {
    "ready": "Готово к выполнению",
    "waiting": "Ожидают срока",
    "blocked": "Заблокированные",
    "idle": "Без активного шага",
    "eligible_now": "Готово к запуску",
    "not_applicable": "Не применимо",
    "already_processed": "Уже обработаны",
    "soft_lane": "Soft lane",
    "court_lane": "Court lane",
    "enforcement_lane": "Enforcement lane",
    "closed_lane": "Closed lane",
}

BLOCKER_REASON_TITLES: dict[str, str] = {
    "missing_debtor_name": "Не указано имя/наименование должника",
    "missing_principal_amount": "Не указана сумма долга",
    "missing_due_date": "Не указан срок оплаты",
    "missing_debtor_identifiers": "Не хватает ИНН/ОГРН должника",
}


def _normalize(value: Any) -> str | None:
    if value is None:
        return None
    return getattr(value, "value", value)


def get_case_status_title(value: Any) -> str:
    code = _normalize(value)
    return CASE_STATUS_TITLES.get(code or "", code or "—")


def get_stage_status_title(value: Any) -> str:
    code = _normalize(value)
    return STAGE_STATUS_TITLES.get(code or "", code or "—")


def get_document_title_ru(code: str | None) -> str:
    if not code:
        return "Документ"
    return DOCUMENT_TITLES.get(code, code)


def get_action_title_ru(code: str | None, fallback: str | None = None) -> str:
    if not code:
        return fallback or "Действие"
    return ACTION_TITLES.get(code, fallback or code)


def get_debtor_type_title(value: Any) -> str:
    code = _normalize(value)
    return DEBTOR_TYPE_TITLES.get(code or "", code or "—")


def get_contract_type_title(value: Any) -> str:
    code = _normalize(value)
    return CONTRACT_TYPE_TITLES.get(code or "", code or "—")


def get_routing_status_title(value: Any) -> str:
    code = _normalize(value)
    return ROUTING_STATUS_TITLES.get(code or "", code or "—")


def get_routing_bucket_title(value: Any) -> str:
    code = _normalize(value)
    return ROUTING_BUCKET_TITLES.get(code or "", code or "—")


def get_blocker_reason_title(value: Any) -> str:
    code = _normalize(value)
    return BLOCKER_REASON_TITLES.get(code or "", code or "—")


def enrich_action_item(item: dict[str, Any]) -> dict[str, Any]:
    code = item.get("code")
    title_ru = get_action_title_ru(code, item.get("title"))
    return {
        **item,
        "title_ru": title_ru,
        "title": title_ru,
    }


def enrich_document_item(item: dict[str, Any]) -> dict[str, Any]:
    code = item.get("code")
    title_ru = get_document_title_ru(code)
    return {
        **item,
        "title_ru": title_ru,
        "title": title_ru,
    }


def enrich_status_block(status_code: Any) -> dict[str, str]:
    code = _normalize(status_code) or ""
    return {
        "code": code,
        "title": get_case_status_title(code),
        "title_ru": get_case_status_title(code),
    }