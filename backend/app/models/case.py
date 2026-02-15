from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON
from sqlalchemy.dialects.postgresql import JSONB

from backend.app.database import Base
from backend.app.enums import CaseStatus, ContractType, DebtorType


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user = relationship("User", back_populates="cases")

    debtor_type = Column(Enum(DebtorType, name="debtor_type_enum"), nullable=False)
    debtor_name = Column(String, nullable=False)

    contract_type = Column(Enum(ContractType, name="contract_type_enum"), nullable=False, index=True)

    principal_amount = Column(Numeric(15, 2), nullable=False)
    due_date = Column(Date, nullable=False)

    status = Column(
        Enum(CaseStatus, name="case_status_enum"),
        default=CaseStatus.draft,
        nullable=False,
        index=True,
    )

    # ВАЖНО:
    # - На Postgres будет JSONB
    # - На SQLite будет JSON
    contract_data = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)