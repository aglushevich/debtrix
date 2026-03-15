from __future__ import annotations

from backend.app.bootstrap import bootstrap_demo_data
from backend.app.database import SessionLocal


def main() -> None:
    db = SessionLocal()
    try:
        result = bootstrap_demo_data(db)
        db.commit()
        print("Seed complete:")
        print(result)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()