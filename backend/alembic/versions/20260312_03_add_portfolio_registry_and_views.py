"""add portfolio registry and views

Revision ID: 20260312_03_add_portfolio_registry_and_views
Revises: 20260312_02_add_batch_execution_scaffold
Create Date: 2026-03-12 14:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260312_03_add_portfolio_registry_and_views"
down_revision = "20260312_02_add_batch_execution_scaffold"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_views",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("filters", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("sorting", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("columns", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("meta", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_portfolio_views_id"), "portfolio_views", ["id"], unique=False)
    op.create_index(
        op.f("ix_portfolio_views_tenant_id"),
        "portfolio_views",
        ["tenant_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_portfolio_views_tenant_id"), table_name="portfolio_views")
    op.drop_index(op.f("ix_portfolio_views_id"), table_name="portfolio_views")
    op.drop_table("portfolio_views")