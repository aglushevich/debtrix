from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models import Case, DocumentTemplate, GeneratedDocument
from backend.app.services.storage_service import LocalStorageService


def _serialize_template(item: DocumentTemplate) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "code": item.code,
        "title": item.title,
        "contract_type": item.contract_type,
        "document_kind": item.document_kind,
        "template_body": item.template_body,
        "template_format": item.template_format,
        "is_active": item.is_active,
        "meta": item.meta or {},
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _serialize_generated(item: GeneratedDocument) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "case_id": item.case_id,
        "template_id": item.template_id,
        "code": item.code,
        "title": item.title,
        "status": item.status,
        "format": item.format,
        "file_path": item.file_path,
        "storage_provider": item.storage_provider,
        "rendered_content": item.rendered_content,
        "context_snapshot": item.context_snapshot or {},
        "meta": item.meta or {},
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def create_document_template(
    db: Session,
    *,
    tenant_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    item = DocumentTemplate(
        tenant_id=tenant_id,
        code=payload["code"],
        title=payload["title"],
        contract_type=payload.get("contract_type"),
        document_kind=payload["document_kind"],
        template_body=payload["template_body"],
        template_format=payload.get("template_format") or "txt",
        is_active=True,
        meta={},
    )

    db.add(item)
    db.flush()
    db.refresh(item)

    return {"ok": True, "template": _serialize_template(item)}


def list_document_templates(
    db: Session,
    *,
    tenant_id: int,
    contract_type: str | None = None,
) -> dict[str, Any]:
    query = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.tenant_id == tenant_id,
            DocumentTemplate.is_active.is_(True),
        )
        .order_by(DocumentTemplate.id.desc())
    )

    if contract_type:
        query = query.filter(
            (DocumentTemplate.contract_type == contract_type)
            | (DocumentTemplate.contract_type.is_(None))
        )

    items = query.all()

    return {
        "items": [_serialize_template(item) for item in items],
    }


def _build_case_context(case: Case) -> dict[str, Any]:
    contract_data = case.contract_data or {}
    debtor = contract_data.get("debtor") or {}

    return {
        "case_id": case.id,
        "debtor_name": case.debtor_name,
        "debtor_type": getattr(case.debtor_type, "value", case.debtor_type),
        "contract_type": getattr(case.contract_type, "value", case.contract_type),
        "principal_amount": str(case.principal_amount),
        "due_date": case.due_date.isoformat() if case.due_date else None,
        "debtor": debtor,
        "contract_data": contract_data,
    }


def _render_template(template_body: str, context: dict[str, Any]) -> str:
    rendered = template_body

    flat_values = {
        "case_id": context.get("case_id"),
        "debtor_name": context.get("debtor_name"),
        "debtor_type": context.get("debtor_type"),
        "contract_type": context.get("contract_type"),
        "principal_amount": context.get("principal_amount"),
        "due_date": context.get("due_date"),
        "debtor_inn": (context.get("debtor") or {}).get("inn"),
        "debtor_ogrn": (context.get("debtor") or {}).get("ogrn"),
        "debtor_address": (context.get("debtor") or {}).get("address"),
        "debtor_director_name": (context.get("debtor") or {}).get("director_name"),
    }

    for key, value in flat_values.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", "" if value is None else str(value))

    return rendered


def generate_document_for_case(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    case = (
        db.query(Case)
        .filter(
            Case.id == case_id,
            Case.tenant_id == tenant_id,
        )
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    template: DocumentTemplate | None = None

    template_id = payload.get("template_id")
    code = payload.get("code")
    fmt = payload.get("format") or "txt"

    if template_id:
        template = (
            db.query(DocumentTemplate)
            .filter(
                DocumentTemplate.id == template_id,
                DocumentTemplate.tenant_id == tenant_id,
                DocumentTemplate.is_active.is_(True),
            )
            .first()
        )
    else:
        case_contract_type = getattr(case.contract_type, "value", case.contract_type)
        template = (
            db.query(DocumentTemplate)
            .filter(
                DocumentTemplate.tenant_id == tenant_id,
                DocumentTemplate.code == code,
                DocumentTemplate.is_active.is_(True),
            )
            .order_by(DocumentTemplate.contract_type.desc())
            .first()
        )

        if template and template.contract_type not in (None, case_contract_type):
            template = None

    if not template:
        raise HTTPException(status_code=404, detail="Document template not found")

    context = _build_case_context(case)
    rendered = _render_template(template.template_body, context)

    storage = LocalStorageService()
    filename = f"{template.code}_case_{case.id}.{fmt}"
    path = storage.save_text(
        tenant_id=tenant_id,
        case_id=case.id,
        filename=filename,
        content=rendered,
    )

    item = GeneratedDocument(
        tenant_id=tenant_id,
        case_id=case.id,
        template_id=template.id,
        code=template.code,
        title=template.title,
        status="generated",
        format=fmt,
        file_path=path,
        storage_provider="local",
        rendered_content=rendered,
        context_snapshot=context,
        meta=payload.get("meta") or {},
    )

    db.add(item)
    db.flush()
    db.refresh(item)

    return {"ok": True, "document": _serialize_generated(item)}


def list_generated_documents(
    db: Session,
    *,
    tenant_id: int,
    case_id: int,
) -> dict[str, Any]:
    items = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.tenant_id == tenant_id,
            GeneratedDocument.case_id == case_id,
        )
        .order_by(GeneratedDocument.id.desc())
        .all()
    )

    return {"case_id": case_id, "items": [_serialize_generated(item) for item in items]}