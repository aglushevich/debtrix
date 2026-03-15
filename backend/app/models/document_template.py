from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class DocumentTemplate(Base):
    __tablename__ = "document_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    tenant_id: Mapped[int] = mapped_column(Integer, index=True)

    code: Mapped[str] = mapped_column(String(100), index=True)
    title: Mapped[str] = mapped_column(String(255))

    contract_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    document_kind: Mapped[str] = mapped_column(String(100), index=True)

    template_body: Mapped[str] = mapped_column(Text)
    template_format: Mapped[str] = mapped_column(String(20), default="txt")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    meta: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )