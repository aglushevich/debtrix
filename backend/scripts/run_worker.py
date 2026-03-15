import time

from backend.app.database import SessionLocal
from backend.app.services.worker_execution_service import claim_next_job, finish_job


def run_worker():

    print("Worker started")

    while True:

        db = SessionLocal()

        job = claim_next_job(db)

        if job:
            print("Executing job", job.id, job.job_type)

            # execution stub
            time.sleep(1)

            finish_job(db, job)

            db.commit()

        db.close()

        time.sleep(1)


if __name__ == "__main__":
    run_worker()