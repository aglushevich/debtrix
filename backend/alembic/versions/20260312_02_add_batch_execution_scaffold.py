"""add batch execution scaffold

Revision ID: 20260312_02_add_batch_execution_scaffold
Revises: 20260312_01_add_automation_engine_scaffold
Create Date: 2026-03-12 13:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260312_02_add_batch_execution_scaffold"
down_revision = "20260312_01_add_automation_engine_scaffold"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "batch_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("job_type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("rule_id", sa.Integer(), nullable=True),
        sa.Column("selection_snapshot", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("execution_params", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("summary", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("result", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_batch_jobs_id"), "batch_jobs", ["id"], unique=False)
    op.create_index(op.f("ix_batch_jobs_tenant_id"), "batch_jobs", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_batch_jobs_rule_id"), "batch_jobs", ["rule_id"], unique=False)

    op.create_table(
        "batch_job_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("batch_job_id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("automation_run_id", sa.Integer(), nullable=True),
        sa.Column("external_action_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("bucket_code", sa.String(length=100), nullable=True),
        sa.Column("reason_code", sa.String(length=100), nullable=True),
        sa.Column("reason_text", sa.Text(), nullable=True),
        sa.Column("eligible_at", sa.DateTime(), nullable=True),
        sa.Column("item_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("result", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["batch_job_id"], ["batch_jobs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_batch_job_items_id"), "batch_job_items", ["id"], unique=False)
    op.create_index(
        op.f("ix_batch_job_items_tenant_id"),
        "batch_job_items",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_batch_job_items_batch_job_id"),
        "batch_job_items",
        ["batch_job_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_batch_job_items_case_id"),
        "batch_job_items",
        ["case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_batch_job_items_automation_run_id"),
        "batch_job_items",
        ["automation_run_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_batch_job_items_external_action_id"),
        "batch_job_items",
        ["external_action_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_batch_job_items_bucket_code"),
        "batch_job_items",
        ["bucket_code"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_batch_job_items_bucket_code"), table_name="batch_job_items")
    op.drop_index(op.f("ix_batch_job_items_external_action_id"), table_name="batch_job_items")
    op.drop_index(op.f("ix_batch_job_items_automation_run_id"), table_name="batch_job_items")
    op.drop_index(op.f("ix_batch_job_items_case_id"), table_name="batch_job_items")
    op.drop_index(op.f("ix_batch_job_items_batch_job_id"), table_name="batch_job_items")
    op.drop_index(op.f("ix_batch_job_items_tenant_id"), table_name="batch_job_items")
    op.drop_index(op.f("ix_batch_job_items_id"), table_name="batch_job_items")
    op.drop_table("batch_job_items")

    op.drop_index(op.f("ix_batch_jobs_rule_id"), table_name="batch_jobs")
    op.drop_index(op.f("ix_batch_jobs_tenant_id"), table_name="batch_jobs")
    op.drop_index(op.f("ix_batch_jobs_id"), table_name="batch_jobs")
    op.drop_table("batch_jobs")