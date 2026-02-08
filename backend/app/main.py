from fastapi import FastAPI
from fastapi.responses import JSONResponse
from datetime import date, timedelta

from debt_case import DebtCase
from translator import t
from dacf import detect_actions

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
    # ТЕСТОВЫЙ ДОЛГ (для демо)
    debt = DebtCase(
        debtor="ООО Ромашка",
        amount=120000.0,
        due_date=date.today() - timedelta(days=36)
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
                    },

                    "actions": [
                        {
                            "code": action.value,
                            "title": t(f"action.{action.value}")
                        }
                        for action in detect_actions(debt)
                    ],

                    "logs": [
                        {
                            "type": log.event_type,
                            "message": log.message,
                            "created_at": log.created_at.isoformat()
                        }
                        for log in debt.logs
                    ]
                }
            ]
        },
        media_type="application/json; charset=utf-8"
    )