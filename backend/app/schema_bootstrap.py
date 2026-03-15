from __future__ import annotations

from backend.app.database import Base, engine

# ВАЖНО:
# импорт моделей нужен не для использования напрямую,
# а чтобы SQLAlchemy зарегистрировал все таблицы в metadata.
from backend.app import models  # noqa: F401


def ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)