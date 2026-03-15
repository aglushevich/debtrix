from pydantic import BaseModel


class EnqueueJobRequest(BaseModel):
    job_type: str
    payload: dict