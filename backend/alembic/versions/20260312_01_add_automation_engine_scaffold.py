"""add automation engine scaffold

Revision ID: 20260312_01_add_automation_engine_scaffold
Revises: <PUT_YOUR_CURRENT_HEAD_HERE>
Create Date: 2026-03-12 12:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260312_01_add_automation_engine_scaffold"
down_revision = "20260314_01_create_tenants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "automation_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("scope_type", sa.String(length=50), nullable=False, server_default="case"),
        sa.Column("trigger_code", sa.String(length=100), nullable=False, server_default="manual"),
        sa.Column("action_code", sa.String(length=100), nullable=False),
        sa.Column(
            "execution_mode",
            sa.String(length=50),
            nullable=False,
            server_default="manual_review",
        ),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("cooldown_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("filters", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("action_params", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("eligible_from", sa.DateTime(), nullable=True),
        sa.Column("eligible_until", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_automation_rules_id"), "automation_rules", ["id"], unique=False)
    op.create_index(
        op.f("ix_automation_rules_tenant_id"),
        "automation_rules",
        ["tenant_id"],
        unique=False,
    )

    op.create_table(
        "automation_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("rule_id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=True),
        sa.Column("external_action_id", sa.Integer(), nullable=True),
        sa.Column("batch_key", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("trigger_code", sa.String(length=100), nullable=False),
        sa.Column("action_code", sa.String(length=100), nullable=False),
        sa.Column("eligibility_code", sa.String(length=100), nullable=True),
        sa.Column("eligibility_reason", sa.Text(), nullable=True),
        sa.Column("eligible_at", sa.DateTime(), nullable=True),
        sa.Column("evaluation_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("execution_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("result", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["rule_id"], ["automation_rules.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_automation_runs_id"), "automation_runs", ["id"], unique=False)
    op.create_index(
        op.f("ix_automation_runs_tenant_id"),
        "automation_runs",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_automation_runs_rule_id"),
        "automation_runs",
        ["rule_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_automation_runs_case_id"),
        "automation_runs",
        ["case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_automation_runs_external_action_id"),
        "automation_runs",
        ["external_action_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_automation_runs_batch_key"),
        "automation_runs",
        ["batch_key"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_automation_runs_batch_key"), table_name="automation_runs")
    op.drop_index(op.f("ix_automation_runs_external_action_id"), table_name="automation_runs")
    op.drop_index(op.f("ix_automation_runs_case_id"), table_name="automation_runs")
    op.drop_index(op.f("ix_automation_runs_rule_id"), table_name="automation_runs")
    op.drop_index(op.f("ix_automation_runs_tenant_id"), table_name="automation_runs")
    op.drop_index(op.f("ix_automation_runs_id"), table_name="automation_runs")
    op.drop_table("automation_runs")

    op.drop_index(op.f("ix_automation_rules_tenant_id"), table_name="automation_rules")
    op.drop_index(op.f("ix_automation_rules_id"), table_name="automation_rules")
    op.drop_table("automation_rules")