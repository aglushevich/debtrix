from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models.case import Case
from backend.app.models.case_participant import CaseParticipant
from backend.app.models.debtor_profile import DebtorProfile
from backend.app.models.organization import Organization


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_text(value: Any) -> str:
    return _as_str(value).lower()


def _safe_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0"))
    except Exception:
        return Decimal("0")


def _days_overdue(due_date: date | None) -> int:
    if not due_date:
        return 0
    return max((datetime.utcnow().date() - due_date).days, 0)


def _extract_debtor_block(case: Case) -> dict[str, Any]:
    return dict((case.contract_data or {}).get("debtor") or {})


def _extract_debtor_identity(
    case: Case,
    debtor_profile: DebtorProfile | None,
) -> dict[str, Any]:
    debtor_block = _extract_debtor_block(case)

    return {
        "name": (
            (debtor_profile.name if debtor_profile else None)
            or debtor_block.get("name_full")
            or debtor_block.get("name")
            or case.debtor_name
            or "Должник"
        ),
        "debtor_type": case.debtor_type,
        "inn": (debtor_profile.inn if debtor_profile else None) or debtor_block.get("inn"),
        "ogrn": (debtor_profile.ogrn if debtor_profile else None) or debtor_block.get("ogrn"),
        "address": (debtor_profile.address if debtor_profile else None) or debtor_block.get("address"),
        "director_name": (
            (debtor_profile.director_name if debtor_profile else None)
            or debtor_block.get("director_name")
        ),
    }


def _load_debtor_profile(db: Session, case: Case) -> DebtorProfile | None:
    return (
        db.query(DebtorProfile)
        .filter(DebtorProfile.case_id == case.id)
        .first()
    )


def _find_related_cases(
    db: Session,
    case: Case,
    debtor_profile: DebtorProfile | None,
) -> list[Case]:
    identity = _extract_debtor_identity(case, debtor_profile)
    current_inn = _as_str(identity.get("inn"))
    current_ogrn = _as_str(identity.get("ogrn"))
    current_name = _normalize_text(identity.get("name"))

    query = (
        db.query(Case)
        .filter(Case.tenant_id == case.tenant_id)
        .order_by(Case.id.desc())
    )

    related: list[Case] = []

    for item in query.all():
        item_profile = (
            db.query(DebtorProfile)
            .filter(DebtorProfile.case_id == item.id)
            .first()
        )
        item_identity = _extract_debtor_identity(item, item_profile)

        item_inn = _as_str(item_identity.get("inn"))
        item_ogrn = _as_str(item_identity.get("ogrn"))
        item_name = _normalize_text(item_identity.get("name"))

        same = False
        if current_inn and item_inn and current_inn == item_inn:
            same = True
        elif current_ogrn and item_ogrn and current_ogrn == item_ogrn:
            same = True
        elif current_name and item_name and current_name == item_name:
            same = True

        if same:
            related.append(item)

    return related


def _serialize_related_cases(
    db: Session,
    case: Case,
    related_cases: list[Case],
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []

    for item in related_cases:
        result.append(
            {
                "case_id": item.id,
                "contract_type": item.contract_type,
                "principal_amount": str(item.principal_amount),
                "due_date": item.due_date.isoformat() if item.due_date else None,
                "status": item.status,
                "is_current": item.id == case.id,
                "is_archived": bool(item.is_archived),
            }
        )

    return result


def _load_case_participants(db: Session, case: Case) -> list[CaseParticipant]:
    return (
        db.query(CaseParticipant)
        .filter(CaseParticipant.case_id == case.id)
        .order_by(CaseParticipant.id.asc())
        .all()
    )


def _build_signals(
    case: Case,
    debtor: dict[str, Any],
    related_cases: list[Case],
    participants_count: int,
) -> list[str]:
    signals: list[str] = []

    amount = _safe_decimal(case.principal_amount)
    overdue_days = _days_overdue(case.due_date)

    if not _as_str(debtor.get("inn")) and not _as_str(debtor.get("ogrn")):
        signals.append("Не заполнены ИНН/ОГРН должника")

    if not _as_str(debtor.get("address")):
        signals.append("Не заполнен адрес должника")

    if not _as_str(debtor.get("director_name")):
        signals.append("Не заполнен руководитель должника")

    if participants_count == 0:
        signals.append("У дела пока нет участников")

    if len(related_cases) > 1:
        signals.append(f"Обнаружены связанные дела: {len(related_cases)}")

    if overdue_days >= 90:
        signals.append(f"Сильная просрочка: {overdue_days} дней")
    elif overdue_days >= 30:
        signals.append(f"Просрочка более месяца: {overdue_days} дней")

    if amount >= Decimal("500000"):
        signals.append("Крупная сумма задолженности")
    elif amount >= Decimal("100000"):
        signals.append("Сумма долга выше среднего")

    if case.status in {"pretrial"}:
        signals.append("Дело готово к переходу в судебный трек")

    if case.status in {"court", "enforcement", "fssp"}:
        signals.append("Дело уже находится в продвинутом треке взыскания")

    return signals


def _build_risk_score(
    case: Case,
    debtor: dict[str, Any],
    related_cases: list[Case],
    participants_count: int,
) -> int:
    score = 0
    amount = _safe_decimal(case.principal_amount)
    overdue_days = _days_overdue(case.due_date)

    if amount >= Decimal("500000"):
        score += 25
    elif amount >= Decimal("200000"):
        score += 18
    elif amount >= Decimal("100000"):
        score += 10

    if not _as_str(debtor.get("inn")) and not _as_str(debtor.get("ogrn")):
        score += 18

    if not _as_str(debtor.get("address")):
        score += 12

    if not _as_str(debtor.get("director_name")):
        score += 6

    if participants_count == 0:
        score += 8

    related_count = len(related_cases)
    if related_count >= 4:
        score += 20
    elif related_count >= 2:
        score += 12

    if overdue_days >= 120:
        score += 18
    elif overdue_days >= 60:
        score += 12
    elif overdue_days >= 30:
        score += 7

    if case.status == "pretrial":
        score += 10
    elif case.status in {"court", "enforcement", "fssp"}:
        score += 15

    return min(score, 100)


def _risk_level(score: int) -> str:
    if score >= 75:
        return "critical"
    if score >= 55:
        return "high"
    if score >= 30:
        return "medium"
    return "low"


def _build_recommendations(
    case: Case,
    debtor: dict[str, Any],
    related_cases: list[Case],
    score: int,
) -> list[str]:
    recommendations: list[str] = []

    if not _as_str(debtor.get("inn")) and not _as_str(debtor.get("ogrn")):
        recommendations.append("Сначала заполнить ИНН/ОГРН должника — без этого портфельное взыскание будет терять качество.")

    if not _as_str(debtor.get("address")):
        recommendations.append("Заполнить адрес должника для претензий, почтовых отправлений и судебного трека.")

    if len(related_cases) > 1:
        recommendations.append("Посмотреть все связанные дела по должнику и принимать решения на уровне портфеля, а не одного кейса.")

    if case.status in {"draft", "overdue"}:
        recommendations.append("Проверить готовность soft stage и запустить ближайшее доступное уведомление.")

    if case.status == "pretrial":
        recommendations.append("Проверить комплектность реквизитов и готовить судебный пакет по делу.")

    if case.status in {"court", "enforcement", "fssp"}:
        recommendations.append("Контролировать исполнительный/судебный трек и следующие внешние действия.")

    if score >= 55:
        recommendations.append("Это приоритетный кейс для операционного контроля Recovery Control Room.")

    return recommendations[:5]


def _build_graph_hints(
    debtor: dict[str, Any],
    related_cases: list[Case],
    participants_count: int,
) -> list[str]:
    hints: list[str] = []

    if _as_str(debtor.get("inn")):
        hints.append("Связь по ИНН доступна для поиска связанных дел.")
    if _as_str(debtor.get("ogrn")):
        hints.append("Связь по ОГРН доступна для поиска связанных дел.")
    if _as_str(debtor.get("director_name")):
        hints.append("Руководитель может использоваться как дополнительный intelligence-сигнал.")
    if participants_count > 0:
        hints.append("Участники дела можно использовать для расширения debtor graph.")
    if len(related_cases) > 1:
        hints.append("Есть несколько кейсов на одного должника — это база для портфельной аналитики.")

    return hints[:5]


def _build_auto_links(
    debtor: dict[str, Any],
    related_cases_serialized: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    auto_links: list[dict[str, Any]] = []

    for item in related_cases_serialized:
        if item.get("is_current"):
            continue

        if _as_str(debtor.get("inn")):
            auto_links.append(
                {
                    "type": "inn_match",
                    "label": f"Совпадение по ИНН {debtor['inn']}",
                    "value": debtor["inn"],
                    "from": {
                        "node_id": "debtor",
                        "title": debtor.get("name") or "Должник",
                    },
                    "to": {
                        "node_id": f"case:{item['case_id']}",
                        "title": f"Дело #{item['case_id']}",
                    },
                }
            )
        elif _as_str(debtor.get("ogrn")):
            auto_links.append(
                {
                    "type": "ogrn_match",
                    "label": f"Совпадение по ОГРН {debtor['ogrn']}",
                    "value": debtor["ogrn"],
                    "from": {
                        "node_id": "debtor",
                        "title": debtor.get("name") or "Должник",
                    },
                    "to": {
                        "node_id": f"case:{item['case_id']}",
                        "title": f"Дело #{item['case_id']}",
                    },
                }
            )

    return auto_links[:20]


def _build_graph(
    case: Case,
    debtor: dict[str, Any],
    related_cases_serialized: list[dict[str, Any]],
    participants: list[CaseParticipant],
) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = [
        {
            "id": "debtor",
            "type": "debtor",
            "title": debtor.get("name") or "Должник",
            "subtitle": debtor.get("inn") or debtor.get("ogrn") or case.debtor_type,
            "is_current": True,
        }
    ]
    edges: list[dict[str, Any]] = []

    for item in related_cases_serialized:
        node_id = f"case:{item['case_id']}"
        nodes.append(
            {
                "id": node_id,
                "type": "case",
                "title": f"Дело #{item['case_id']}",
                "subtitle": f"{item.get('contract_type') or '—'} · {item.get('principal_amount') or '—'} ₽",
                "is_current": bool(item.get("is_current")),
            }
        )
        edges.append(
            {
                "source": "debtor",
                "target": node_id,
                "label": "связанное дело",
                "kind": "related_case",
            }
        )

    for participant in participants:
        party = getattr(participant, "party", None)
        party_name = getattr(party, "name", None) or f"Участник #{participant.party_id}"
        party_node_id = f"participant:{participant.id}"

        nodes.append(
            {
                "id": party_node_id,
                "type": "participant",
                "title": party_name,
                "subtitle": participant.role,
                "is_current": False,
            }
        )
        edges.append(
            {
                "source": "debtor",
                "target": party_node_id,
                "label": participant.role,
                "kind": "participant_link",
            }
        )

    return {
        "nodes": nodes[:50],
        "edges": edges[:80],
    }


def build_debtor_intelligence_payload(db: Session, case: Case) -> dict[str, Any]:
    debtor_profile = _load_debtor_profile(db, case)
    debtor = _extract_debtor_identity(case, debtor_profile)
    related_cases = _find_related_cases(db, case, debtor_profile)
    participants = _load_case_participants(db, case)

    risk_score = _build_risk_score(
        case=case,
        debtor=debtor,
        related_cases=related_cases,
        participants_count=len(participants),
    )
    risk_level = _risk_level(risk_score)
    signals = _build_signals(
        case=case,
        debtor=debtor,
        related_cases=related_cases,
        participants_count=len(participants),
    )
    recommendations = _build_recommendations(
        case=case,
        debtor=debtor,
        related_cases=related_cases,
        score=risk_score,
    )
    graph_hints = _build_graph_hints(
        debtor=debtor,
        related_cases=related_cases,
        participants_count=len(participants),
    )

    related_cases_serialized = _serialize_related_cases(db, case, related_cases)
    auto_links = _build_auto_links(debtor, related_cases_serialized)
    graph = _build_graph(case, debtor, related_cases_serialized, participants)

    return {
        "case_id": case.id,
        "debtor": {
            "id": debtor_profile.id if debtor_profile else None,
            "name": debtor.get("name"),
            "debtor_type": debtor.get("debtor_type"),
            "inn": debtor.get("inn"),
            "ogrn": debtor.get("ogrn"),
            "address": debtor.get("address"),
            "director_name": debtor.get("director_name"),
        },
        "summary": {
            "cases_count": len(related_cases_serialized),
            "participants_count": len(participants),
            "auto_links_count": len(auto_links),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "signals": signals,
        },
        "signals": signals,
        "recommendations": recommendations,
        "graph_hints": graph_hints,
        "related_cases": related_cases_serialized,
        "participants": [
            {
                "id": item.id,
                "role": item.role,
                "is_primary": item.is_primary,
                "party_id": item.party_id,
            }
            for item in participants
        ],
        "auto_links": auto_links,
        "graph": graph,
    }


def build_organization_starter_kit_payload(db: Session, case: Case) -> dict[str, Any]:
    debtor_profile = _load_debtor_profile(db, case)
    debtor = _extract_debtor_identity(case, debtor_profile)
    related_cases = _find_related_cases(db, case, debtor_profile)

    organization = None
    if case.organization_id:
        organization = db.query(Organization).filter(Organization.id == case.organization_id).first()

    checks = [
        {
            "code": "name",
            "label": "Наименование",
            "value": debtor.get("name"),
            "ok": bool(_as_str(debtor.get("name"))),
            "hint": "Нужно наименование должника",
        },
        {
            "code": "inn_or_ogrn",
            "label": "ИНН / ОГРН",
            "value": debtor.get("inn") or debtor.get("ogrn"),
            "ok": bool(_as_str(debtor.get("inn")) or _as_str(debtor.get("ogrn"))),
            "hint": "Для устойчивого сопоставления нужен ИНН или ОГРН",
        },
        {
            "code": "address",
            "label": "Адрес",
            "value": debtor.get("address"),
            "ok": bool(_as_str(debtor.get("address"))),
            "hint": "Адрес нужен для претензий и отправки документов",
        },
        {
            "code": "director_name",
            "label": "Руководитель",
            "value": debtor.get("director_name"),
            "ok": bool(_as_str(debtor.get("director_name"))),
            "hint": "Полезно для проверки карточки должника",
        },
    ]

    filled_fields = sum(1 for item in checks if item["ok"])
    missing_fields = [item["code"] for item in checks if not item["ok"]]
    completion_percent = int((filled_fields / len(checks)) * 100) if checks else 0

    total_principal_amount = "0.00"
    try:
        total = sum(_safe_decimal(item.principal_amount) for item in related_cases)
        total_principal_amount = f"{total:.2f}"
    except Exception:
        total_principal_amount = "0.00"

    readiness_level = "ready" if not missing_fields else ("partial" if filled_fields > 0 else "missing")

    return {
        "case_id": case.id,
        "organization": {
            "id": organization.id if organization else None,
            "name": organization.name if organization else debtor.get("name"),
            "name_full": organization.name_full if organization else debtor.get("name"),
            "name_short": organization.name_short if organization else None,
            "inn": organization.inn if organization else debtor.get("inn"),
            "ogrn": organization.ogrn if organization else debtor.get("ogrn"),
            "kpp": organization.kpp if organization else None,
            "address": organization.address if organization else debtor.get("address"),
            "director_name": organization.director_name if organization else debtor.get("director_name"),
            "status": organization.status if organization else None,
            "registration_date": (
                organization.registration_date.isoformat()
                if organization and organization.registration_date
                else None
            ),
            "okved_main": organization.okved_main if organization else None,
            "source": organization.source if organization else (debtor_profile.source if debtor_profile else None),
            "is_active": bool(organization.is_active) if organization else True,
        },
        "creditor": None,
        "summary": {
            "completion_percent": completion_percent,
            "filled_fields": filled_fields,
            "missing_fields_count": len(missing_fields),
            "linked_cases_count": len(related_cases),
            "linked_debtors_count": 1,
            "active_cases_count": len([item for item in related_cases if not item.is_archived]),
            "archived_cases_count": len([item for item in related_cases if item.is_archived]),
            "total_principal_amount": total_principal_amount,
            "readiness_score": completion_percent,
        },
        "readiness": {
            "level": readiness_level,
            "ready": len(missing_fields) == 0,
            "missing_fields": missing_fields,
            "checks": checks,
        },
        "linked_cases": [
            {
                "case_id": item.id,
                "debtor_name": item.debtor_name,
                "contract_type": item.contract_type,
                "principal_amount": str(item.principal_amount),
                "due_date": item.due_date.isoformat() if item.due_date else None,
                "status": item.status,
                "is_archived": bool(item.is_archived),
                "is_current": item.id == case.id,
            }
            for item in related_cases
        ],
        "graph_hints": _build_graph_hints(
            debtor=debtor,
            related_cases=related_cases,
            participants_count=len(_load_case_participants(db, case)),
        ),
        "signals": _build_signals(
            case=case,
            debtor=debtor,
            related_cases=related_cases,
            participants_count=len(_load_case_participants(db, case)),
        ),
        "recommendations": _build_recommendations(
            case=case,
            debtor=debtor,
            related_cases=related_cases,
            score=_build_risk_score(
                case=case,
                debtor=debtor,
                related_cases=related_cases,
                participants_count=len(_load_case_participants(db, case)),
            ),
        ),
    }


def build_routing_snapshot(case: Case) -> dict[str, Any]:
    debtor_block = _extract_debtor_block(case)
    has_identifiers = bool(_as_str(debtor_block.get("inn")) or _as_str(debtor_block.get("ogrn")))

    if case.is_archived or case.status == "closed":
        return {
            "bucket_code": "closed",
            "status": "completed",
            "reason_code": "case_closed",
            "eligible_at": None,
        }

    if case.eligible_at and case.eligible_at > datetime.utcnow():
        return {
            "bucket_code": "waiting",
            "status": "waiting",
            "reason_code": "time_window",
            "eligible_at": case.eligible_at.isoformat(),
        }

    if not has_identifiers:
        return {
            "bucket_code": "blocked",
            "status": "blocked",
            "reason_code": "missing_debtor_identifiers",
            "eligible_at": None,
        }

    if case.status in {"draft"}:
        return {
            "bucket_code": "intake",
            "status": "queued",
            "reason_code": "draft_case",
            "eligible_at": None,
        }

    if case.status in {"overdue", "pretrial"}:
        return {
            "bucket_code": "active_collection",
            "status": "eligible",
            "reason_code": "recovery_stage",
            "eligible_at": None,
        }

    if case.status in {"court"}:
        return {
            "bucket_code": "court_lane",
            "status": "in_progress",
            "reason_code": "court_track",
            "eligible_at": None,
        }

    if case.status in {"fssp", "enforcement"}:
        return {
            "bucket_code": "enforcement_lane",
            "status": "in_progress",
            "reason_code": "fssp_track",
            "eligible_at": None,
        }

    return {
        "bucket_code": "general",
        "status": "in_progress",
        "reason_code": "default_routing",
        "eligible_at": None,
    }