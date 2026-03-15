from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class AutomationRunItem(Base):
    __tablename__ = "automation_run_items"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "case_id",
            name="uq_automation_run_items_run_case",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    tenant_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    run_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    case_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="queued")
    reason_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reason_text: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    action_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    eligible_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    execution_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    execution_finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    payload_json: Mapped[str | None] = mapped_column(String, nullable=True)
    result_json: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )