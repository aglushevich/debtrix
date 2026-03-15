from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from backend.app.models import JobQueueJob


def enqueue_job(
    db: Session,
    *,
    tenant_id: int,
    job_type: str,
    payload: dict,
    priority: int = 100,
):
    job = JobQueueJob(
        tenant_id=tenant_id,
        job_type=job_type,
        status="pending",
        priority=priority,
        payload_json=json.dumps(payload),
        created_at=datetime.utcnow(),
    )

    db.add(job)
    db.flush()

    return job