from pydantic import BaseModel


class DocumentTemplateCreate(BaseModel):
    code: str
    title: str
    document_kind: str
    contract_type: str | None = None
    template_body: str
    template_format: str = "txt"


class DocumentGenerateRequest(BaseModel):
    code: str
    template_id: int | None = None
    format: str = "txt"
    meta: dict = {}