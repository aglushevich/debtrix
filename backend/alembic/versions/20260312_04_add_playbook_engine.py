from alembic import op
import sqlalchemy as sa


revision = "20260312_04_add_playbook_engine"
down_revision = "20260312_03_add_portfolio_registry_and_views"


def upgrade():

    op.create_table(
        "playbooks",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("tenant_id", sa.Integer),
        sa.Column("name", sa.String(255)),
        sa.Column("contract_type", sa.String(100)),
        sa.Column("description", sa.Text),
        sa.Column("is_active", sa.Boolean),
        sa.Column("meta", sa.JSON),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )

    op.create_table(
        "playbook_steps",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("playbook_id", sa.Integer),
        sa.Column("step_code", sa.String(100)),
        sa.Column("title", sa.String(255)),
        sa.Column("description", sa.Text),
        sa.Column("order_index", sa.Integer),
        sa.Column("eligibility_rules", sa.JSON),
        sa.Column("meta", sa.JSON),
        sa.Column("created_at", sa.DateTime),
    )

    op.create_table(
        "playbook_step_actions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("step_id", sa.Integer),
        sa.Column("action_code", sa.String(100)),
        sa.Column("action_type", sa.String(50)),
        sa.Column("params", sa.JSON),
        sa.Column("created_at", sa.DateTime),
    )

    op.create_table(
        "case_playbooks",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("case_id", sa.Integer),
        sa.Column("playbook_id", sa.Integer),
        sa.Column("current_step_code", sa.String(100)),
        sa.Column("started_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )