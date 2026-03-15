from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class PlaybookStep(Base):
    __tablename__ = "playbook_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    playbook_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    step_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    step_type: Mapped[str] = mapped_column(String(100), nullable=False, default="action")
    action_code: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    document_code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    is_manual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_blocking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    eligibility_expr: Mapped[str | None] = mapped_column(Text, nullable=True)
    waiting_rule_code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)