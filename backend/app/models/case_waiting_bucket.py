from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class CaseWaitingBucket(Base):
    __tablename__ = "case_waiting_buckets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    tenant_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    case_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    playbook_code: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    step_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    bucket_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="waiting", index=True)

    reason_code: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    reason_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    eligible_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)