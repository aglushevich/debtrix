from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models import Case, DebtorProfile
from backend.app.services.creditor_profile_service import get_creditor_profile
from backend.app.services.document_catalog_service import get_document_title_ru


def _format_date(value: Any) -> str:
    if value is None:
        return "—"

    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y")

    if isinstance(value, date):
        return value.strftime("%d.%m.%Y")

    text = str(value).strip()
    if not text:
        return "—"

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.strftime("%d.%m.%Y")
    except Exception:
        return text


def _format_money(value: Any) -> str:
    if value is None or value == "":
        return "0,00"

    try:
        amount = Decimal(str(value))
    except Exception:
        return str(value)

    normalized = f"{amount:,.2f}"
    return normalized.replace(",", " ").replace(".", ",")


def _extract_creditor(case: Case) -> dict[str, Any]:
    contract_data = dict(case.contract_data or {})
    creditor = dict(contract_data.get("creditor") or {})
    signer = dict(creditor.get("signer") or {})

    signer_name = (
        signer.get("name")
        or creditor.get("signer_name")
        or "Уполномоченное лицо"
    )
    signer_basis = (
        signer.get("basis")
        or creditor.get("signer_basis")
        or "действует на основании полномочий"
    )

    return {
        "name": creditor.get("name") or "Кредитор",
        "name_full": creditor.get("name_full") or creditor.get("name") or "Кредитор",
        "name_short": creditor.get("name_short") or creditor.get("name") or "Кредитор",
        "inn": creditor.get("inn") or "—",
        "ogrn": creditor.get("ogrn") or "—",
        "kpp": creditor.get("kpp") or "—",
        "address": creditor.get("address") or "—",
        "bank_name": creditor.get("bank_name") or "—",
        "bank_bik": creditor.get("bank_bik") or "—",
        "bank_account": creditor.get("bank_account") or "—",
        "bank_corr_account": creditor.get("bank_corr_account") or "—",
        "email": creditor.get("email") or "—",
        "phone": creditor.get("phone") or "—",
        "signer_name": signer_name,
        "signer_basis": signer_basis,
        "signer": {
            "name": signer_name,
            "position": signer.get("position") or creditor.get("signer_position") or "—",
            "basis": signer_basis,
        },
    }


def _extract_debtor(case: Case, debtor_profile: DebtorProfile | None) -> dict[str, Any]:
    contract_data = dict(case.contract_data or {})
    debtor_block = dict(contract_data.get("debtor") or {})

    return {
        "name": (debtor_profile.name if debtor_profile else None)
        or debtor_block.get("name_full")
        or debtor_block.get("name")
        or case.debtor_name
        or "Должник",
        "inn": (debtor_profile.inn if debtor_profile else None) or debtor_block.get("inn") or "—",
        "ogrn": (debtor_profile.ogrn if debtor_profile else None) or debtor_block.get("ogrn") or "—",
        "address": (debtor_profile.address if debtor_profile else None)
        or debtor_block.get("address")
        or "—",
        "director_name": (debtor_profile.director_name if debtor_profile else None)
        or debtor_block.get("director_name")
        or "—",
    }


def _base_context(
    db: Session,
    tenant_id: int,
    case: Case,
    projection: dict[str, Any],
    debtor_profile: DebtorProfile | None,
) -> dict[str, Any]:
    creditor = _extract_creditor(db, tenant_id, case)
    debtor = _extract_debtor(case, debtor_profile)

    case_data = dict(projection.get("case") or {})

    return {
        "case_id": case.id,
        "case": case_data,
        "creditor": creditor,
        "debtor": debtor,
        "document_date": _format_date(datetime.utcnow()),
        "due_date": _format_date(case.due_date or case_data.get("due_date")),
        "principal_amount": _format_money(case.principal_amount or case_data.get("principal_amount")),
        "contract_type": getattr(case.contract_type, "value", case.contract_type) or "—",
        "debtor_type": getattr(case.debtor_type, "value", case.debtor_type) or "—",
    }


def _payment_due_notice(context: dict[str, Any]) -> dict[str, Any]:
    debtor = context["debtor"]
    creditor = context["creditor"]

    return {
        "code": "payment_due_notice",
        "title": get_document_title_ru("payment_due_notice"),
        "file_stub": "napominanie_o_sroke_oplaty",
        "paragraphs": [
            f"Кому: {debtor['name']}",
            f"Адрес: {debtor['address']}",
            "",
            f"От: {creditor['name']}",
            f"Адрес: {creditor['address']}",
            "",
            "УВЕДОМЛЕНИЕ",
            "о наступлении срока оплаты",
            "",
            f"По делу № {context['case_id']} сообщаем, что срок исполнения денежного обязательства истёк {context['due_date']}.",
            f"Размер основного долга по состоянию на дату подготовки уведомления составляет {context['principal_amount']} руб.",
            "Просим незамедлительно произвести оплату задолженности и при необходимости связаться с кредитором для сверки расчётов.",
            "Настоящее уведомление направляется в рамках досудебной работы по урегулированию задолженности.",
            "",
            f"Дата: {context['document_date']}",
            f"{creditor['signer_position']}: {creditor['signer_name']}",
        ],
    }


def _debt_notice(context: dict[str, Any]) -> dict[str, Any]:
    debtor = context["debtor"]
    creditor = context["creditor"]

    return {
        "code": "debt_notice",
        "title": get_document_title_ru("debt_notice"),
        "file_stub": "uvedomlenie_o_zadolzhennosti",
        "paragraphs": [
            f"Кому: {debtor['name']}",
            f"ИНН/ОГРН: {debtor['inn']} / {debtor['ogrn']}",
            f"Адрес: {debtor['address']}",
            "",
            f"От: {creditor['name']}",
            f"ИНН/ОГРН: {creditor['inn']} / {creditor['ogrn']}",
            f"Адрес: {creditor['address']}",
            "",
            "УВЕДОМЛЕНИЕ",
            "о наличии задолженности",
            "",
            f"По делу № {context['case_id']} зафиксирована просроченная задолженность в размере {context['principal_amount']} руб.",
            f"Срок исполнения обязательства истёк {context['due_date']}.",
            "Просим погасить задолженность в добровольном порядке, а также сообщить о произведённой оплате либо представить мотивированные возражения по расчёту задолженности.",
            "При отсутствии оплаты кредитор оставляет за собой право перейти к следующей стадии взыскания и подготовке досудебной претензии.",
            "",
            f"Дата: {context['document_date']}",
            f"{creditor['signer_position']}: {creditor['signer_name']}",
        ],
    }


def _pretension(context: dict[str, Any]) -> dict[str, Any]:
    debtor = context["debtor"]
    creditor = context["creditor"]

    return {
        "code": "pretension",
        "title": get_document_title_ru("pretension"),
        "file_stub": "dosudebnaya_pretenziya",
        "paragraphs": [
            f"Кому: {debtor['name']}",
            f"Адрес: {debtor['address']}",
            "",
            f"От: {creditor['name_full']}",
            f"ИНН/ОГРН/КПП: {creditor['inn']} / {creditor['ogrn']} / {creditor['kpp']}",
            f"Адрес: {creditor['address']}",
            "",
            "ДОСУДЕБНАЯ ПРЕТЕНЗИЯ",
            "",
            f"По делу № {context['case_id']} кредитором установлено ненадлежащее исполнение денежного обязательства.",
            f"Размер основного долга составляет {context['principal_amount']} руб.",
            f"Срок исполнения обязательства истёк {context['due_date']}.",
            "Требуем в добровольном порядке погасить задолженность в полном объёме, а также исполнить иные обязательства, предусмотренные договором и применимым законодательством.",
            "В случае неисполнения настоящей претензии в установленный срок кредитор будет вынужден обратиться в суд за защитой своих прав и взысканием задолженности, а также судебных расходов.",
            "",
            f"Дата: {context['document_date']}",
            f"{creditor['signer_position']}, {creditor['signer_name']}",
            f"{creditor['signer_basis']}",
        ],
    }


def _lawsuit(context: dict[str, Any]) -> dict[str, Any]:
    debtor = context["debtor"]
    creditor = context["creditor"]

    return {
        "code": "lawsuit",
        "title": get_document_title_ru("lawsuit"),
        "file_stub": "iskovoe_zayavlenie",
        "paragraphs": [
            "В суд по подсудности",
            "",
            f"Истец: {creditor['name_full']}",
            f"ИНН/ОГРН/КПП: {creditor['inn']} / {creditor['ogrn']} / {creditor['kpp']}",
            f"Адрес: {creditor['address']}",
            "",
            f"Ответчик: {debtor['name']}",
            f"ИНН/ОГРН: {debtor['inn']} / {debtor['ogrn']}",
            f"Адрес: {debtor['address']}",
            "",
            "ИСКОВОЕ ЗАЯВЛЕНИЕ",
            "о взыскании задолженности",
            "",
            f"По делу № {context['case_id']} ответчиком не исполнено денежное обязательство в установленный срок.",
            f"Размер задолженности по основному долгу составляет {context['principal_amount']} руб.",
            f"Срок исполнения обязательства истёк {context['due_date']}.",
            "Истец просит суд взыскать с ответчика сумму основного долга, а также иные подлежащие взысканию суммы в соответствии с договором и законом.",
            "Приложения подлежат формированию по составу документов дела и правилам соответствующего вида судопроизводства.",
            "",
            f"Дата: {context['document_date']}",
            f"Подписант: {creditor['signer_position']}, {creditor['signer_name']}",
            f"{creditor['signer_basis']}",
        ],
    }


def _court_order(context: dict[str, Any]) -> dict[str, Any]:
    debtor = context["debtor"]
    creditor = context["creditor"]

    return {
        "code": "court_order",
        "title": get_document_title_ru("court_order"),
        "file_stub": "zayavlenie_o_sudebnom_prikaze",
        "paragraphs": [
            "Мировому судье / в суд по подсудности",
            "",
            f"Заявитель: {creditor['name_full']}",
            f"ИНН/ОГРН/КПП: {creditor['inn']} / {creditor['ogrn']} / {creditor['kpp']}",
            f"Адрес: {creditor['address']}",
            "",
            f"Должник: {debtor['name']}",
            f"Адрес: {debtor['address']}",
            "",
            "ЗАЯВЛЕНИЕ",
            "о выдаче судебного приказа",
            "",
            f"По делу № {context['case_id']} должником не исполнено денежное обязательство.",
            f"Размер заявленного ко взысканию основного долга составляет {context['principal_amount']} руб.",
            "Прошу выдать судебный приказ о взыскании задолженности и иных сумм, подлежащих взысканию в приказном порядке.",
            "",
            f"Дата: {context['document_date']}",
            f"Подписант: {creditor['signer_position']}, {creditor['signer_name']}",
            f"{creditor['signer_basis']}",
        ],
    }


def _fssp_application(context: dict[str, Any]) -> dict[str, Any]:
    creditor = context["creditor"]

    return {
        "code": "fssp_application",
        "title": get_document_title_ru("fssp_application"),
        "file_stub": "zayavlenie_v_fssp",
        "paragraphs": [
            "В территориальный орган ФССП России",
            "",
            f"От взыскателя: {creditor['name_full']}",
            f"ИНН/ОГРН/КПП: {creditor['inn']} / {creditor['ogrn']} / {creditor['kpp']}",
            f"Адрес: {creditor['address']}",
            "",
            "ЗАЯВЛЕНИЕ",
            "о возбуждении исполнительного производства",
            "",
            f"По делу № {context['case_id']} просим принять исполнительный документ к исполнению и возбудить исполнительное производство.",
            f"Сумма основного долга: {context['principal_amount']} руб.",
            "Просим осуществить исполнительные действия в порядке, установленном законодательством об исполнительном производстве.",
            "",
            f"Дата: {context['document_date']}",
            f"Подписант: {creditor['signer_position']}, {creditor['signer_name']}",
            f"{creditor['signer_basis']}",
        ],
    }


_TEMPLATE_BUILDERS = {
    "payment_due_notice": _payment_due_notice,
    "debt_notice": _debt_notice,
    "pretension": _pretension,
    "lawsuit": _lawsuit,
    "court_order": _court_order,
    "fssp_application": _fssp_application,
}


def build_legal_document_template(
    *,
    db: Session,
    tenant_id: int,
    document_code: str,
    case: Case,
    projection: dict[str, Any],
    debtor_profile: DebtorProfile | None,
) -> dict[str, Any]:
    builder = _TEMPLATE_BUILDERS.get(document_code)
    if not builder:
        raise ValueError(f"Unsupported document code: {document_code}")

    context = _base_context(
        db=db,
        tenant_id=tenant_id,
        case=case,
        projection=projection,
        debtor_profile=debtor_profile,
    )
    return builder(context)