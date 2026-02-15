from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.debt_case import DebtCase
from backend.app.i18n.translator import t
from backend.app.models import Case
from backend.app.stage_engine import compute_stage

router = APIRouter(prefix="/debts", tags=["Debts"])


@router.get("")
def get_debts(db: Session = Depends(get_db)):
    cases = db.query(Case).order_by(Case.id.desc()).all()
    items = []

    for case in cases:
        debt = DebtCase(
            debtor=case.debtor_name,
            amount=float(case.principal_amount),
            due_date=case.due_date,
        )

        cd = case.contract_data or {}
        stage_flags = (cd.get("stage") or {})
        debt.notified = bool(stage_flags.get("notified", False))
        debt.documents_prepared = bool(stage_flags.get("documents_prepared", False))
        debt.closed = bool(stage_flags.get("closed", False))

        stage = compute_stage(debt, case.contract_type, cd)

        items.append(
            {
                "debtor": debt.debtor,
                "amount": debt.amount,
                "days_overdue": debt.days_overdue(),
                "status": {
                    "code": stage.status.value,
                    "title": t(f"status.{stage.status.value}"),
                },
                "actions": [
                    {"code": a.value, "title": t(f"action.{a.value}")} for a in stage.actions
                ],
                "logs": [
                    {
                        "type": log.event_type,
                        "message": log.message,
                        "created_at": log.created_at.isoformat(),
                    }
                    for log in debt.logs
                ],
            }
        )

    return JSONResponse(
        content={"title": t("debts.title"), "items": items},
        media_type="application/json; charset=utf-8",
    )