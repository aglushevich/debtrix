from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON

from backend.app.database import Base


class ExecutionEvent(Base):
    __tablename__ = "execution_events"

    id = Column(Integer, primary_key=True)

    case_id = Column(Integer, index=True)
    tenant_id = Column(Integer, index=True)

    action_code = Column(String, index=True)
    status = Column(String)

    reason = Column(String, nullable=True)

    payload = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)