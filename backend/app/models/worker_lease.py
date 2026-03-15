from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class WorkerLease(Base):
    __tablename__ = "worker_leases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    worker_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    lease_until: Mapped[datetime] = mapped_column(DateTime)

    last_heartbeat: Mapped[datetime] = mapped_column(DateTime)