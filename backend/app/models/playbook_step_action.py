from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class PlaybookStepAction(Base):
    __tablename__ = "playbook_step_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    step_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("playbook_steps.id"),
        index=True,
    )

    action_code: Mapped[str] = mapped_column(String(100))

    action_type: Mapped[str] = mapped_column(String(50))

    params: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)