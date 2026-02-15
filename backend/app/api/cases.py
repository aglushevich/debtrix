from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.enums import CaseStatus
from backend.app.models import Case, User
from backend.app.schemas import CaseCreate, CaseResponse
from backend.app.stage_engine import StageAction

router = APIRouter(prefix="/cases", tags=["Cases"])


def get_or_create_test_user(db: Session) -> User:
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(email="test@debtrix.ru", hashed_password="fakehashedpassword")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.post("", response_model=CaseResponse)
def create_case(payload: CaseCreate, db: Session = Depends(get_db)):
    user = get_or_create_test_user(db)

    new_case = Case(
        user_id=user.id,
        debtor_type=payload.debtor_type,
        debtor_name=payload.debtor_name,
        contract_type=payload.contract_type,
        principal_amount=payload.principal_amount,
        due_date=payload.due_date,
        status=CaseStatus.draft,
        contract_data=payload.contract_data or {},
    )

    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    return new_case


@router.get("", response_model=list[CaseResponse])
def list_cases(db: Session = Depends(get_db)):
    return db.query(Case).order_by(Case.id.desc()).all()


@router.post("/{case_id}/actions/{action}")
def apply_action(case_id: int, action: StageAction, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    cd = case.contract_data or {}
    stage = cd.get("stage") or {}
    stage.setdefault("notified", False)
    stage.setdefault("documents_prepared", False)
    stage.setdefault("closed", False)

    if action in (StageAction.REMIND, StageAction.PRETENSION):
        stage["notified"] = True
    elif action == StageAction.PREPARE_DOCS:
        stage["documents_prepared"] = True
    elif action == StageAction.CLOSE:
        stage["closed"] = True
        case.status = CaseStatus.closed

    cd["stage"] = stage
    case.contract_data = cd

    db.add(case)
    db.commit()
    db.refresh(case)

    return {"ok": True, "case_id": case.id, "stage": stage}