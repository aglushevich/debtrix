from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class CasePlaybook(Base):
    __tablename__ = "case_playbooks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    case_id: Mapped[int] = mapped_column(Integer, index=True)

    playbook_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("playbooks.id"),
    )

    current_step_code: Mapped[str | None] = mapped_column(String(100))

    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )