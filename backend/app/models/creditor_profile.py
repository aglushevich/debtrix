from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean

from backend.app.database import Base


class CreditorProfile(Base):
    __tablename__ = "creditor_profiles"

    id = Column(Integer, primary_key=True)

    tenant_id = Column(Integer, index=True, nullable=False)

    name = Column(String, nullable=False)
    name_full = Column(String)
    name_short = Column(String)

    inn = Column(String)
    ogrn = Column(String)
    kpp = Column(String)

    address = Column(String)

    signer_name = Column(String)
    signer_position = Column(String)
    signer_basis = Column(String)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)