from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from backend.app.models import JobQueueJob


def claim_next_job(db: Session):

    job = (
        db.query(JobQueueJob)
        .filter(JobQueueJob.status == "pending")
        .order_by(JobQueueJob.priority.asc(), JobQueueJob.id.asc())
        .first()
    )

    if not job:
        return None

    job.status = "running"
    job.started_at = datetime.utcnow()

    db.add(job)
    db.flush()

    return job


def finish_job(db: Session, job: JobQueueJob):

    job.status = "finished"
    job.finished_at = datetime.utcnow()

    db.add(job)