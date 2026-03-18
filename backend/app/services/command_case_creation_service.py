from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models import DebtorProfile, Organization
from backend.app.services.case_service import create_case_write, sync_and_persist_case
from backend.app.services.debtor_service import normalize_and_validate_inn_ogrn
from backend.app.services.organization_lookup_service import lookup_organization_by_identifiers
from backend.app.services.tenant_query_service import filter_debtor_profiles_by_tenant


def _clean_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_amount(value: Any) -> str:
    if value is None:
        raise HTTPException(status_code=422, detail="principal_amount is required")

    raw = str(value).strip().replace(",", ".")
    if not raw:
        raise HTTPException(status_code=422, detail="principal_amount is required")

    try:
        amount = Decimal(raw)
    except InvalidOperation:
        raise HTTPException(status_code=422, detail="principal_amount must be a valid decimal")

    if amount <= 0:
        raise HTTPException(status_code=422, detail="principal_amount must be > 0")

    return f"{amount:.2f}"


def _serialize_case(item: Any) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "organization_id": item.organization_id,
        "debtor_name": item.debtor_name,
        "debtor_type": item.debtor_type,
        "contract_type": item.contract_type,
        "principal_amount": str(item.principal_amount),
        "due_date": item.due_date.isoformat() if item.due_date else None,
        "status": item.status,
        "is_archived": bool(getattr(item, "is_archived", False)),
        "contract_data": item.contract_data or {},
        "meta": item.meta or {},
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def preview_command_case_creation(
    *,
    payload: dict[str, Any],
) -> dict[str, Any]:
    debtor_type = _clean_str(payload.get("debtor_type"))
    contract_type = _clean_str(payload.get("contract_type"))
    debtor_name = _clean_str(payload.get("debtor_name"))
    note = _clean_str(payload.get("note"))
    principal_amount = _normalize_amount(payload.get("principal_amount"))
    due_date = payload.get("due_date")

    if not debtor_type:
        raise HTTPException(status_code=422, detail="debtor_type is required")
    if not contract_type:
        raise HTTPException(status_code=422, detail="contract_type is required")

    raw_inn = payload.get("debtor_inn") or payload.get("inn")
    raw_ogrn = payload.get("debtor_ogrn") or payload.get("ogrn")

    inn_norm = None
    ogrn_norm = None
    if raw_inn or raw_ogrn:
        inn_norm, ogrn_norm = normalize_and_validate_inn_ogrn(raw_inn, raw_ogrn)

    warnings: list[str] = []
    resolved_debtor: dict[str, Any] | None = None

    if inn_norm or ogrn_norm:
        try:
            org = lookup_organization_by_identifiers(inn=inn_norm, ogrn=ogrn_norm)
            resolved_debtor = {
                "name": org.get("name"),
                "name_full": org.get("name_full"),
                "name_short": org.get("name_short"),
                "inn": org.get("inn"),
                "ogrn": org.get("ogrn"),
                "kpp": org.get("kpp"),
                "address": org.get("address"),
                "director_name": org.get("director_name"),
                "status": org.get("status"),
                "registration_date": org.get("registration_date"),
                "okved_main": org.get("okved_main"),
                "source": org.get("source"),
                "raw": org.get("raw") or {},
            }

            if not debtor_name:
                debtor_name = (
                    _clean_str(org.get("name_full"))
                    or _clean_str(org.get("name"))
                    or _clean_str(org.get("name_short"))
                )
        except Exception as exc:
            warnings.append(f"lookup_failed: {exc}")

    if not debtor_name:
        raise HTTPException(
            status_code=422,
            detail="debtor_name is required (or pass debtor_inn/debtor_ogrn for lookup)",
        )

    normalized = {
        "debtor_type": debtor_type,
        "contract_type": contract_type,
        "debtor_name": debtor_name,
        "principal_amount": principal_amount,
        "due_date": due_date.isoformat() if hasattr(due_date, "isoformat") and due_date else due_date,
        "inn": inn_norm,
        "ogrn": ogrn_norm,
        "note": note,
    }

    return {
        "ok": True,
        "normalized": normalized,
        "resolved_debtor": resolved_debtor,
        "warnings": warnings,
        "can_create": True,
    }


def _build_contract_data(
    *,
    payload: dict[str, Any],
    preview: dict[str, Any],
) -> dict[str, Any]:
    source_contract_data = dict(payload.get("contract_data") or {})
    note = preview["normalized"].get("note")
    inn = preview["normalized"].get("inn")
    ogrn = preview["normalized"].get("ogrn")
    resolved_debtor = preview.get("resolved_debtor") or {}

    contract_data = dict(source_contract_data)

    debtor_block = dict(contract_data.get("debtor") or {})
    if inn:
        debtor_block["inn"] = inn
    if ogrn:
        debtor_block["ogrn"] = ogrn

    if resolved_debtor:
        debtor_block["name"] = resolved_debtor.get("name")
        debtor_block["name_full"] = resolved_debtor.get("name_full")
        debtor_block["name_short"] = resolved_debtor.get("name_short")
        debtor_block["kpp"] = resolved_debtor.get("kpp")
        debtor_block["address"] = resolved_debtor.get("address")
        debtor_block["director_name"] = resolved_debtor.get("director_name")
        debtor_block["status"] = resolved_debtor.get("status")
        debtor_block["registration_date"] = resolved_debtor.get("registration_date")
        debtor_block["okved_main"] = resolved_debtor.get("okved_main")
        debtor_block["source"] = resolved_debtor.get("source")

    if debtor_block:
        contract_data["debtor"] = debtor_block

    if note:
        contract_data["note"] = note

    return contract_data


def _upsert_debtor_profile_from_preview(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
    preview: dict[str, Any],
) -> None:
    resolved_debtor = preview.get("resolved_debtor") or {}
    if not resolved_debtor:
        return

    profile_query = db.query(DebtorProfile).filter(DebtorProfile.case_id == case_id)
    profile_query = filter_debtor_profiles_by_tenant(profile_query, tenant_id)
    profile = profile_query.first()

    if not profile:
        profile = DebtorProfile(
            case_id=case_id,
            tenant_id=tenant_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(profile)

    profile.tenant_id = tenant_id
    profile.inn = resolved_debtor.get("inn")
    profile.ogrn = resolved_debtor.get("ogrn")
    profile.name = resolved_debtor.get("name") or resolved_debtor.get("name_full")
    profile.address = resolved_debtor.get("address")
    profile.director_name = resolved_debtor.get("director_name")
    profile.source = resolved_debtor.get("source") or "command_case_creation"
    profile.raw = {
        "name_full": resolved_debtor.get("name_full"),
        "name_short": resolved_debtor.get("name_short"),
        "kpp": resolved_debtor.get("kpp"),
        "status": resolved_debtor.get("status"),
        "registration_date": resolved_debtor.get("registration_date"),
        "okved_main": resolved_debtor.get("okved_main"),
        "provider_payload": resolved_debtor.get("raw") or {},
    }
    profile.updated_at = datetime.utcnow()
    db.add(profile)


def _compute_readiness(preview: dict[str, Any]) -> dict[str, Any]:
    normalized = preview["normalized"]
    resolved = preview.get("resolved_debtor") or {}

    score = 0
    signals = []
    warnings = list(preview.get("warnings") or [])

    if normalized.get("debtor_name"):
        score += 20
    else:
        warnings.append("missing_debtor_name")

    if normalized.get("inn"):
        score += 20
    else:
        warnings.append("missing_inn")

    if normalized.get("ogrn"):
        score += 10

    if resolved:
        score += 20
        signals.append("organization_resolved")

    if normalized.get("principal_amount"):
        score += 15

    if normalized.get("due_date"):
        score += 15
    else:
        warnings.append("missing_due_date")

    level = "draft"
    if score >= 70:
        level = "ready"
    elif score >= 40:
        level = "partial"

    return {
        "score": score,
        "level": level,
        "warnings": warnings,
        "signals": signals,
    }


def _detect_potential_duplicates(
    db: Session,
    *,
    tenant_id: int,
    normalized: dict[str, Any],
) -> list[dict[str, Any]]:
    query = db.query(DebtorProfile)
    query = filter_debtor_profiles_by_tenant(query, tenant_id)

    inn = normalized.get("inn")
    ogrn = normalized.get("ogrn")

    if not inn and not ogrn:
        return []

    results = query.filter(
        (DebtorProfile.inn == inn) | (DebtorProfile.ogrn == ogrn)
    ).limit(5).all()

    return [
        {
            "case_id": row.case_id,
            "name": row.name,
            "inn": row.inn,
            "ogrn": row.ogrn,
        }
        for row in results
    ]


def _build_case_meta(
    *,
    preview: dict[str, Any],
    readiness: dict[str, Any],
    duplicates: list[dict[str, Any]],
) -> dict[str, Any]:
    resolved = preview.get("resolved_debtor") or {}
    normalized = preview.get("normalized") or {}

    return {
        "command_creation": {
            "timestamp": datetime.utcnow().isoformat(),
            "readiness": readiness,
            "duplicates_detected": len(duplicates),
        },

        # 🔥 НОВОЕ — ядро smart layer
        "smart": {
            "readiness_score": readiness.get("score"),
            "readiness_level": readiness.get("level"),
            "warnings": readiness.get("warnings") or [],
            "signals": readiness.get("signals") or [],

            "organization": {
                "resolved": bool(resolved),
                "inn": resolved.get("inn"),
                "ogrn": resolved.get("ogrn"),
                "name": resolved.get("name"),
            },

            "duplicates": duplicates,

            "completeness": {
                "has_inn": bool(normalized.get("inn")),
                "has_ogrn": bool(normalized.get("ogrn")),
                "has_due_date": bool(normalized.get("due_date")),
                "has_amount": bool(normalized.get("principal_amount")),
            },
        },

        # legacy (оставляем)
        "signals": readiness.get("signals") or [],
        "warnings": readiness.get("warnings") or [],
    }


def _get_or_create_organization(
    db: Session,
    *,
    tenant_id: int,
    resolved_debtor: dict[str, Any] | None,
) -> int | None:
    if not resolved_debtor:
        return None

    inn = resolved_debtor.get("inn")
    ogrn = resolved_debtor.get("ogrn")

    if not inn and not ogrn:
        return None

    query = db.query(Organization).filter(Organization.tenant_id == tenant_id)
    existing = query.filter(
        (Organization.inn == inn) | (Organization.ogrn == ogrn)
    ).first()

    if existing:
        existing.name = resolved_debtor.get("name")
        existing.name_full = resolved_debtor.get("name_full")
        existing.name_short = resolved_debtor.get("name_short")
        existing.kpp = resolved_debtor.get("kpp")
        existing.address = resolved_debtor.get("address")
        existing.director_name = resolved_debtor.get("director_name")
        existing.status = resolved_debtor.get("status")
        existing.registration_date = resolved_debtor.get("registration_date")
        existing.okved_main = resolved_debtor.get("okved_main")
        existing.source = resolved_debtor.get("source")
        existing.raw = resolved_debtor.get("raw") or {}
        existing.updated_at = datetime.utcnow()
        db.add(existing)
        db.flush()
        return existing.id

    item = Organization(
        tenant_id=tenant_id,
        name=resolved_debtor.get("name"),
        name_full=resolved_debtor.get("name_full"),
        name_short=resolved_debtor.get("name_short"),
        inn=inn,
        ogrn=ogrn,
        kpp=resolved_debtor.get("kpp"),
        address=resolved_debtor.get("address"),
        director_name=resolved_debtor.get("director_name"),
        status=resolved_debtor.get("status"),
        registration_date=resolved_debtor.get("registration_date"),
        okved_main=resolved_debtor.get("okved_main"),
        source=resolved_debtor.get("source"),
        is_active=True,
        raw=resolved_debtor.get("raw") or {},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(item)
    db.flush()
    db.refresh(item)
    return item.id


def execute_command_case_creation(
    db: Session,
    *,
    tenant_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    preview = preview_command_case_creation(payload=payload)
    normalized = preview["normalized"]

    readiness = _compute_readiness(preview)
    duplicates = _detect_potential_duplicates(
        db,
        tenant_id=tenant_id,
        normalized=normalized,
    )

    contract_data = _build_contract_data(payload=payload, preview=preview)
    meta = _build_case_meta(
        preview=preview,
        readiness=readiness,
        duplicates=duplicates,
    )

    organization_id = _get_or_create_organization(
        db,
        tenant_id=tenant_id,
        resolved_debtor=preview.get("resolved_debtor"),
    )

    created = create_case_write(
        db,
        tenant_id=tenant_id,
        debtor_type=normalized["debtor_type"],
        debtor_name=normalized["debtor_name"],
        contract_type=normalized["contract_type"],
        principal_amount=normalized["principal_amount"],
        due_date=normalized["due_date"],
        contract_data=contract_data,
    )

    created.meta = meta
    created.organization_id = organization_id
    
    level = readiness.get("level")
    if level == "ready":
     status = "active"
    elif level == "partial":
     status = "waiting"
    else:
     status = "draft"

    created.status = status
    created.updated_at = datetime.utcnow()
    db.add(created)

    db.flush()
    db.refresh(created)

    _upsert_debtor_profile_from_preview(
        db,
        tenant_id=tenant_id,
        case_id=created.id,
        preview=preview,
    )

    sync_and_persist_case(db, created)

    db.flush()
    db.refresh(created)

    return {
        "ok": True,
        "case": _serialize_case(created),
        "smart": created.meta.get("smart"),
        "command": {
            "resolved_debtor_name": normalized.get("debtor_name"),
            "debtor_inn": normalized.get("inn"),
            "debtor_ogrn": normalized.get("ogrn"),
            "lookup_performed": bool(
                payload.get("debtor_inn")
                or payload.get("debtor_ogrn")
                or payload.get("inn")
                or payload.get("ogrn")
            ),
            "organization_resolved": bool(preview.get("resolved_debtor")),
            "organization": preview.get("resolved_debtor"),
            "organization_id": organization_id,
            "duplicates_found": duplicates,
            "readiness": readiness,
        },
    }