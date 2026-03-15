PYTHON ?= python3
PIP ?= pip3

BACKEND_APP = backend.app.main:app

.PHONY: install-backend install-frontend migrate seed backend frontend smoke

install-backend:
	$(PIP) install -r backend/requirements.txt

install-frontend:
	cd frontend && npm install

migrate:
	cd backend && alembic upgrade head

seed:
	$(PYTHON) -m backend.app.seed

backend:
	uvicorn $(BACKEND_APP) --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev -- --host 0.0.0.0 --port 5173

smoke:
	$(PYTHON) backend/scripts/smoke_check.py