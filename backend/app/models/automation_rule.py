from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class AutomationRule(Base):
    __tablename__ = "automation_rules"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_automation_rules_tenant_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    tenant_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    trigger_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="manual",
    )
    scope_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="case",
    )

    action_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    playbook_code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    contract_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    stage_code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100)

    config_json: Mapped[str | None] = mapped_column(String, nullable=True)
    eligibility_json: Mapped[str | None] = mapped_column(String, nullable=True)

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