from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.contract_rules import CONTRACT_REQUIRED_FIELDS
from backend.app.database import Base, engine, get_db
from backend.app.debt_case import DebtCase
from backend.app.enums import CaseStatus, ContractType, DebtorType
from backend.app.i18n.translator import t
from backend.app.models import Case, User
from backend.app.schemas import CaseCreate, CaseResponse
from backend.app.stage_engine import StageAction, compute_stage

app = FastAPI(title="Debtrix")

# временно без миграций
# (если БД не поднята/не доступна — лучше упасть сразу, чем “тихо” не создать таблицы)
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "service": "debtrix"}


def get_or_create_test_user(db: Session) -> User:
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(email="test@debtrix.ru", hashed_password="fakehashedpassword")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


# ============================================================
# CASES
# ============================================================

@app.post("/cases", response_model=CaseResponse)
def create_case(payload: CaseCreate, db: Session = Depends(get_db)):
    user = get_or_create_test_user(db)

    new_case = Case(
        user_id=user.id,
        debtor_type=payload.debtor_type,
        debtor_name=payload.debtor_name,
        contract_type=payload.contract_type,
        principal_amount=payload.principal_amount,
        due_date=payload.due_date,
        status=CaseStatus.draft,  # ВАЖНО: enum, не строка
        contract_data=payload.contract_data or {},
    )

    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    return new_case


@app.get("/cases", response_model=list[CaseResponse])
def list_cases(db: Session = Depends(get_db)):
    return db.query(Case).order_by(Case.id.desc()).all()


# ============================================================
# DEBTS REGISTRY (demo)
# ============================================================

@app.get("/debts")
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

        # подтягиваем сохранённый прогресс из contract_data.stage
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
                    {"code": a.value, "title": t(f"action.{a.value}")}
                    for a in stage.actions
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


# ============================================================
# APPLY ACTION (сохраняем прогресс в contract_data.stage)
# ============================================================

@app.post("/cases/{case_id}/actions/{action}")
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


# ============================================================
# RECOVERY PREVIEW (ПКО-виджет: порядок зачёта поступлений)
# ============================================================

def _d(x: Any) -> Decimal:
    """Безопасно приводим числа/строки к Decimal."""
    if x is None:
        return Decimal("0")
    if isinstance(x, Decimal):
        return x
    try:
        return Decimal(str(x))
    except Exception:
        return Decimal("0")


def _apply(amount: Decimal, payment: Decimal) -> tuple[Decimal, Decimal]:
    """Возвращает (сколько применили, сколько осталось платежа)."""
    if payment <= 0 or amount <= 0:
        return Decimal("0"), payment
    used = payment if payment <= amount else amount
    return used, payment - used


@app.get("/cases/{case_id}/recovery-preview")
def recovery_preview(case_id: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    cd: Dict[str, Any] = case.contract_data or {}
    recovery: Dict[str, Any] = (cd.get("recovery") or {})

    # входные значения (пользователь/оператор могут менять)
    total_received = _d(recovery.get("total_received", 0))

    # эти суммы — “к довзысканию”
    state_duty = _d(recovery.get("state_duty", 0))
    interest_before_principal = _d(recovery.get("interest_before_principal", 0))

    # тело долга берём из case.principal_amount
    principal = _d(case.principal_amount)

    # “проценты после” (395/договорные после погашения тела) — опционально
    extra_interest = _d(recovery.get("extra_interest", 0))
    include_extra_interest = bool(recovery.get("include_extra_interest", True))

    remaining_payment = total_received

    used_state_duty, remaining_payment = _apply(state_duty, remaining_payment)
    used_interest_before, remaining_payment = _apply(interest_before_principal, remaining_payment)
    used_principal, remaining_payment = _apply(principal, remaining_payment)

    used_extra = Decimal("0")
    if include_extra_interest:
        used_extra, remaining_payment = _apply(extra_interest, remaining_payment)

    result = {
        "allocation_order": [
            "state_duty",
            "interest_before_principal",
            "principal",
            "extra_interest" if include_extra_interest else "extra_interest (excluded)",
        ],
        "inputs": {
            "case_id": case.id,
            "contract_type": case.contract_type.value if hasattr(case.contract_type, "value") else str(case.contract_type),
            "total_received": str(total_received),
            "state_duty": str(state_duty),
            "interest_before_principal": str(interest_before_principal),
            "principal": str(principal),
            "extra_interest": str(extra_interest),
            "include_extra_interest": include_extra_interest,
        },
        "applied": {
            "state_duty": str(used_state_duty),
            "interest_before_principal": str(used_interest_before),
            "principal": str(used_principal),
            "extra_interest": str(used_extra),
            "unallocated_payment": str(remaining_payment),
        },
        "remaining": {
            "state_duty": str(state_duty - used_state_duty),
            "interest_before_principal": str(interest_before_principal - used_interest_before),
            "principal": str(principal - used_principal),
            "extra_interest": str(extra_interest - used_extra) if include_extra_interest else str(extra_interest),
        },
        "note": (
            "Логика: поступления гасят госпошлину → проценты (до тела) → тело долга → проценты после тела (если включены). "
            "Пользователь может выключить include_extra_interest, чтобы не считать довзыскание этих процентов."
        ),
    }

    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


# ============================================================
# META
# ============================================================

@app.get("/meta/contract-types")
def contract_types():
    return [{"code": e.value, "title": e.value} for e in ContractType]


@app.get("/meta/debtor-types")
def debtor_types():
    return [{"code": e.value, "title": e.value} for e in DebtorType]


@app.get("/meta/contract-rules")
def contract_rules():
    return {ct.value: CONTRACT_REQUIRED_FIELDS.get(ct, []) for ct in ContractType}