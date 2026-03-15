from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.execution_log_service import (
    get_case_execution_history,
)

router = APIRouter()


@router.get("/cases/{case_id}/execution-history")
def case_execution_history(case_id: int, db: Session = Depends(get_db)):

    return {
        "case_id": case_id,
        "items": get_case_execution_history(db, case_id),
    }