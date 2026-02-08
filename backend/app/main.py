from fastapi import FastAPI
from fastapi.responses import JSONResponse
from datetime import date
from status import DebtStatus
from debt_case import DebtCase
from translator import t

app = FastAPI(title="Debtrix")


@app.get("/health")
def health():
    return JSONResponse(
        content={
            "status": "ok",
            "message": t("health.ok")
        },
        media_type="application/json; charset=utf-8"
    )


@app.get("/debts")
def get_debts():
    debt = DebtCase(
        debtor="ООО Ромашка",
        amount=120000.0,
        due_date=date(2026, 1, 3)
    )

    return JSONResponse(
        content={
            "title": t("debts.title"),
            "items": [
                {
    "debtor": debt.debtor,
    "amount": debt.amount,
    "days_overdue": debt.days_overdue(),
    "status": {
        "code": debt.status().value,
        "title": t(f"status.{debt.status().value}")
    }
}
            ]
        },
        media_type="application/json; charset=utf-8"
    )