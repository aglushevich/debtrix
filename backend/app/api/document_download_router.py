from __future__ import annotations

from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.document_catalog_service import enrich_document_definitions
from backend.app.services.document_export_service import (
    export_document_docx,
    export_document_pdf,
)
from backend.app.services.document_stage_service import get_available_documents
from backend.app.services.tenant_query_service import (
    load_case_for_tenant_or_404,
    resolve_current_tenant_id,
)

router = APIRouter(tags=["document-download"])


def _get_current_tenant_id(
    db: Session = Depends(get_db),
) -> int:
    return resolve_current_tenant_id(db, tenant_id=None)


def _get_document_meta_or_404(db: Session, case_id: int, document_code: str) -> dict:
    documents = enrich_document_definitions(get_available_documents(db, case_id))

    for item in documents:
        if str(item.get("code") or "") == document_code:
            return item

    raise HTTPException(status_code=404, detail="Документ не найден для этого дела")


def _ensure_document_ready(document_meta: dict) -> None:
    if document_meta.get("ready"):
        return

    missing_fields = document_meta.get("missing_fields") or []
    detail = "Документ пока не готов к формированию"
    if missing_fields:
        detail += f". Не хватает полей: {', '.join(missing_fields)}"
    raise HTTPException(status_code=422, detail=detail)


@router.get("/cases/{case_id}/documents/{document_code}.docx")
def download_document_docx(
    case_id: int,
    document_code: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    document_meta = _get_document_meta_or_404(db, case_id, document_code)
    _ensure_document_ready(document_meta)

    try:
        exported = export_document_docx(db, case_id=case_id, document_code=document_code)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return StreamingResponse(
        BytesIO(exported.content),
        media_type=exported.media_type,
        headers={"Content-Disposition": f'attachment; filename="{exported.filename}"'},
    )


@router.get("/cases/{case_id}/documents/{document_code}.pdf")
def download_document_pdf(
    case_id: int,
    document_code: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(_get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    document_meta = _get_document_meta_or_404(db, case_id, document_code)
    _ensure_document_ready(document_meta)

    try:
        exported = export_document_pdf(db, case_id=case_id, document_code=document_code)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return StreamingResponse(
        BytesIO(exported.content),
        media_type=exported.media_type,
        headers={"Content-Disposition": f'attachment; filename="{exported.filename}"'},
    )