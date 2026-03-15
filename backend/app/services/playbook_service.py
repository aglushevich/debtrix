from sqlalchemy.orm import Session

from backend.app.models.playbook import Playbook
from backend.app.models.playbook_step import PlaybookStep
from backend.app.models.playbook_step_action import PlaybookStepAction


def create_playbook(db: Session, tenant_id: int, payload: dict):

    pb = Playbook(
        tenant_id=tenant_id,
        name=payload["name"],
        contract_type=payload["contract_type"],
        description=payload.get("description"),
    )

    db.add(pb)
    db.flush()

    return pb


def add_playbook_step(db: Session, playbook_id: int, payload: dict):

    step = PlaybookStep(
        playbook_id=playbook_id,
        step_code=payload["step_code"],
        title=payload["title"],
        order_index=payload["order_index"],
    )

    db.add(step)
    db.flush()

    return step


def add_step_action(db: Session, step_id: int, payload: dict):

    action = PlaybookStepAction(
        step_id=step_id,
        action_code=payload["action_code"],
        action_type=payload["action_type"],
        params=payload.get("params", {}),
    )

    db.add(action)
    db.flush()

    return action