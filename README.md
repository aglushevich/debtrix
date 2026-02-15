# Debtrix

LegalTech-платформа для автоматизации взыскания задолженности.

---

## 🚀 Архитектура

Проект состоит из:

- `backend/` — FastAPI + PostgreSQL
- `frontend/` — (будет подключён отдельно)
- `reset_db.sql` — безопасное пересоздание схемы БД

---

## ⚙️ Стек технологий

- Python 3.12
- FastAPI
- SQLAlchemy 2.x
- PostgreSQL 15
- Docker

---

## 🗄 База данных

PostgreSQL запускается в Docker:

```bash
docker run -d \
  --name debtrix-postgres \
  -e POSTGRES_USER=debtrix \
  -e POSTGRES_PASSWORD=debtrixpass \
  -e POSTGRES_DB=debtrix_db \
  -p 5432:5432 \
  postgres:15