"""add case engine core

Revision ID: 20260314_06_add_case_engine_core
Revises: 20260312_05_add_document_engine
Create Date: 2026-03-14 21:30:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260314_06_add_case_engine_core"
down_revision = "20260312_05_add_document_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_tenant_id"), "users", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=500), nullable=True),
        sa.Column("name_full", sa.Text(), nullable=True),
        sa.Column("name_short", sa.String(length=500), nullable=True),
        sa.Column("inn", sa.String(length=12), nullable=True),
        sa.Column("ogrn", sa.String(length=15), nullable=True),
        sa.Column("kpp", sa.String(length=9), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("director_name", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("registration_date", sa.Date(), nullable=True),
        sa.Column("okved_main", sa.String(length=32), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("raw", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_organizations_id"), "organizations", ["id"], unique=False)
    op.create_index(
        op.f("ix_organizations_tenant_id"),
        "organizations",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(op.f("ix_organizations_inn"), "organizations", ["inn"], unique=False)
    op.create_index(op.f("ix_organizations_ogrn"), "organizations", ["ogrn"], unique=False)

    op.create_table(
        "parties",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=True),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=500), nullable=False),
        sa.Column("debtor_type", sa.String(length=32), nullable=True),
        sa.Column("inn", sa.String(length=12), nullable=True),
        sa.Column("ogrn", sa.String(length=15), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("director_name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_parties_id"), "parties", ["id"], unique=False)
    op.create_index(op.f("ix_parties_tenant_id"), "parties", ["tenant_id"], unique=False)
    op.create_index(
        op.f("ix_parties_organization_id"),
        "parties",
        ["organization_id"],
        unique=False,
    )
    op.create_index(op.f("ix_parties_inn"), "parties", ["inn"], unique=False)
    op.create_index(op.f("ix_parties_ogrn"), "parties", ["ogrn"], unique=False)

    op.create_table(
        "cases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("debtor_name", sa.String(length=500), nullable=False),
        sa.Column("debtor_type", sa.String(length=32), nullable=False),
        sa.Column("contract_type", sa.String(length=64), nullable=False),
        sa.Column("principal_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("contract_data", sa.JSON(), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("eligible_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cases_id"), "cases", ["id"], unique=False)
    op.create_index(op.f("ix_cases_tenant_id"), "cases", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_cases_user_id"), "cases", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_cases_organization_id"),
        "cases",
        ["organization_id"],
        unique=False,
    )
    op.create_index(op.f("ix_cases_status"), "cases", ["status"], unique=False)
    op.create_index(op.f("ix_cases_is_archived"), "cases", ["is_archived"], unique=False)
    op.create_index(op.f("ix_cases_eligible_at"), "cases", ["eligible_at"], unique=False)
    op.create_index(op.f("ix_cases_created_at"), "cases", ["created_at"], unique=False)
    op.create_index(op.f("ix_cases_updated_at"), "cases", ["updated_at"], unique=False)

    op.create_table(
        "case_participants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=True),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("party_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=64), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.ForeignKeyConstraint(["party_id"], ["parties.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_id", "party_id", "role", name="uq_case_party_role"),
    )
    op.create_index(
        op.f("ix_case_participants_id"),
        "case_participants",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_participants_tenant_id"),
        "case_participants",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_participants_case_id"),
        "case_participants",
        ["case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_participants_party_id"),
        "case_participants",
        ["party_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_participants_role"),
        "case_participants",
        ["role"],
        unique=False,
    )

    op.create_table(
        "debtor_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=True),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("inn", sa.String(length=12), nullable=True),
        sa.Column("ogrn", sa.String(length=15), nullable=True),
        sa.Column("name", sa.String(length=500), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("director_name", sa.String(length=255), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("raw", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_debtor_profiles_id"), "debtor_profiles", ["id"], unique=False)
    op.create_index(
        op.f("ix_debtor_profiles_tenant_id"),
        "debtor_profiles",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_debtor_profiles_case_id"),
        "debtor_profiles",
        ["case_id"],
        unique=True,
    )
    op.create_index(op.f("ix_debtor_profiles_inn"), "debtor_profiles", ["inn"], unique=False)
    op.create_index(
        op.f("ix_debtor_profiles_ogrn"),
        "debtor_profiles",
        ["ogrn"],
        unique=False,
    )

    op.create_table(
        "timeline_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=True),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("dedup_key", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_timeline_events_id"), "timeline_events", ["id"], unique=False)
    op.create_index(
        op.f("ix_timeline_events_tenant_id"),
        "timeline_events",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_timeline_events_case_id"),
        "timeline_events",
        ["case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_timeline_events_event_type"),
        "timeline_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_timeline_events_created_at"),
        "timeline_events",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "uq_timeline_event_case_dedup_key_not_null",
        "timeline_events",
        ["case_id", "dedup_key"],
        unique=True,
        sqlite_where=sa.text("dedup_key IS NOT NULL"),
    )

    op.create_table(
        "case_projections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=True),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_case_projections_id"),
        "case_projections",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_projections_tenant_id"),
        "case_projections",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_projections_case_id"),
        "case_projections",
        ["case_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_case_projections_updated_at"),
        "case_projections",
        ["updated_at"],
        unique=False,
    )

    op.create_table(
        "case_integrations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("mode", sa.String(length=64), nullable=True),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_payload_hash", sa.String(length=128), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "case_id",
            "provider",
            name="uq_case_integration_tenant_case_provider",
        ),
    )
    op.create_index(
        op.f("ix_case_integrations_id"),
        "case_integrations",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_integrations_tenant_id"),
        "case_integrations",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_integrations_case_id"),
        "case_integrations",
        ["case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_integrations_provider"),
        "case_integrations",
        ["provider"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_integrations_status"),
        "case_integrations",
        ["status"],
        unique=False,
    )

    op.create_table(
        "case_waiting_buckets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("playbook_code", sa.String(length=100), nullable=True),
        sa.Column("step_code", sa.String(length=100), nullable=False),
        sa.Column("bucket_code", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="waiting"),
        sa.Column("reason_code", sa.String(length=100), nullable=True),
        sa.Column("reason_text", sa.Text(), nullable=True),
        sa.Column("eligible_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_case_waiting_buckets_tenant_id"),
        "case_waiting_buckets",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_waiting_buckets_case_id"),
        "case_waiting_buckets",
        ["case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_waiting_buckets_playbook_code"),
        "case_waiting_buckets",
        ["playbook_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_waiting_buckets_step_code"),
        "case_waiting_buckets",
        ["step_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_waiting_buckets_bucket_code"),
        "case_waiting_buckets",
        ["bucket_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_waiting_buckets_status"),
        "case_waiting_buckets",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_waiting_buckets_reason_code"),
        "case_waiting_buckets",
        ["reason_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_case_waiting_buckets_eligible_at"),
        "case_waiting_buckets",
        ["eligible_at"],
        unique=False,
    )

    op.create_table(
        "external_actions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("action_code", sa.String(length=100), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("auth_type", sa.String(length=64), nullable=True),
        sa.Column("requires_user_auth", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("external_reference", sa.String(length=255), nullable=True),
        sa.Column("redirect_url", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_external_actions_id"),
        "external_actions",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_external_actions_tenant_id"),
        "external_actions",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_external_actions_case_id"),
        "external_actions",
        ["case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_external_actions_action_code"),
        "external_actions",
        ["action_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_external_actions_provider"),
        "external_actions",
        ["provider"],
        unique=False,
    )
    op.create_index(
        op.f("ix_external_actions_status"),
        "external_actions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_external_actions_created_at"),
        "external_actions",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_external_actions_updated_at"),
        "external_actions",
        ["updated_at"],
        unique=False,
    )

    op.create_table(
        "esia_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=True),
        sa.Column("external_action_id", sa.Integer(), nullable=True),
        sa.Column("provider", sa.String(length=64), nullable=False, server_default="esia"),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("state_token", sa.String(length=255), nullable=True),
        sa.Column("redirect_url", sa.Text(), nullable=True),
        sa.Column("access_scope", sa.String(length=255), nullable=True),
        sa.Column("user_identifier", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.ForeignKeyConstraint(["external_action_id"], ["external_actions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_esia_sessions_id"), "esia_sessions", ["id"], unique=False)
    op.create_index(
        op.f("ix_esia_sessions_tenant_id"),
        "esia_sessions",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_esia_sessions_case_id"),
        "esia_sessions",
        ["case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_esia_sessions_external_action_id"),
        "esia_sessions",
        ["external_action_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_esia_sessions_status"),
        "esia_sessions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_esia_sessions_state_token"),
        "esia_sessions",
        ["state_token"],
        unique=False,
    )
    op.create_index(
        op.f("ix_esia_sessions_created_at"),
        "esia_sessions",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_esia_sessions_updated_at"),
        "esia_sessions",
        ["updated_at"],
        unique=False,
    )

    op.create_table(
        "outbound_dispatches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("external_action_id", sa.Integer(), nullable=True),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("channel", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=True),
        sa.Column("response_payload", sa.JSON(), nullable=True),
        sa.Column("external_reference", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.ForeignKeyConstraint(["external_action_id"], ["external_actions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_outbound_dispatches_id"),
        "outbound_dispatches",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_outbound_dispatches_tenant_id"),
        "outbound_dispatches",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_outbound_dispatches_case_id"),
        "outbound_dispatches",
        ["case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_outbound_dispatches_external_action_id"),
        "outbound_dispatches",
        ["external_action_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_outbound_dispatches_provider"),
        "outbound_dispatches",
        ["provider"],
        unique=False,
    )
    op.create_index(
        op.f("ix_outbound_dispatches_status"),
        "outbound_dispatches",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_outbound_dispatches_created_at"),
        "outbound_dispatches",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_outbound_dispatches_updated_at"),
        "outbound_dispatches",
        ["updated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_outbound_dispatches_updated_at"), table_name="outbound_dispatches")
    op.drop_index(op.f("ix_outbound_dispatches_created_at"), table_name="outbound_dispatches")
    op.drop_index(op.f("ix_outbound_dispatches_status"), table_name="outbound_dispatches")
    op.drop_index(op.f("ix_outbound_dispatches_provider"), table_name="outbound_dispatches")
    op.drop_index(op.f("ix_outbound_dispatches_external_action_id"), table_name="outbound_dispatches")
    op.drop_index(op.f("ix_outbound_dispatches_case_id"), table_name="outbound_dispatches")
    op.drop_index(op.f("ix_outbound_dispatches_tenant_id"), table_name="outbound_dispatches")
    op.drop_index(op.f("ix_outbound_dispatches_id"), table_name="outbound_dispatches")
    op.drop_table("outbound_dispatches")

    op.drop_index(op.f("ix_esia_sessions_updated_at"), table_name="esia_sessions")
    op.drop_index(op.f("ix_esia_sessions_created_at"), table_name="esia_sessions")
    op.drop_index(op.f("ix_esia_sessions_state_token"), table_name="esia_sessions")
    op.drop_index(op.f("ix_esia_sessions_status"), table_name="esia_sessions")
    op.drop_index(op.f("ix_esia_sessions_external_action_id"), table_name="esia_sessions")
    op.drop_index(op.f("ix_esia_sessions_case_id"), table_name="esia_sessions")
    op.drop_index(op.f("ix_esia_sessions_tenant_id"), table_name="esia_sessions")
    op.drop_index(op.f("ix_esia_sessions_id"), table_name="esia_sessions")
    op.drop_table("esia_sessions")

    op.drop_index(op.f("ix_external_actions_updated_at"), table_name="external_actions")
    op.drop_index(op.f("ix_external_actions_created_at"), table_name="external_actions")
    op.drop_index(op.f("ix_external_actions_status"), table_name="external_actions")
    op.drop_index(op.f("ix_external_actions_provider"), table_name="external_actions")
    op.drop_index(op.f("ix_external_actions_action_code"), table_name="external_actions")
    op.drop_index(op.f("ix_external_actions_case_id"), table_name="external_actions")
    op.drop_index(op.f("ix_external_actions_tenant_id"), table_name="external_actions")
    op.drop_index(op.f("ix_external_actions_id"), table_name="external_actions")
    op.drop_table("external_actions")

    op.drop_index(op.f("ix_case_waiting_buckets_eligible_at"), table_name="case_waiting_buckets")
    op.drop_index(op.f("ix_case_waiting_buckets_reason_code"), table_name="case_waiting_buckets")
    op.drop_index(op.f("ix_case_waiting_buckets_status"), table_name="case_waiting_buckets")
    op.drop_index(op.f("ix_case_waiting_buckets_bucket_code"), table_name="case_waiting_buckets")
    op.drop_index(op.f("ix_case_waiting_buckets_step_code"), table_name="case_waiting_buckets")
    op.drop_index(op.f("ix_case_waiting_buckets_playbook_code"), table_name="case_waiting_buckets")
    op.drop_index(op.f("ix_case_waiting_buckets_case_id"), table_name="case_waiting_buckets")
    op.drop_index(op.f("ix_case_waiting_buckets_tenant_id"), table_name="case_waiting_buckets")
    op.drop_table("case_waiting_buckets")

    op.drop_index(op.f("ix_case_integrations_status"), table_name="case_integrations")
    op.drop_index(op.f("ix_case_integrations_provider"), table_name="case_integrations")
    op.drop_index(op.f("ix_case_integrations_case_id"), table_name="case_integrations")
    op.drop_index(op.f("ix_case_integrations_tenant_id"), table_name="case_integrations")
    op.drop_index(op.f("ix_case_integrations_id"), table_name="case_integrations")
    op.drop_table("case_integrations")

    op.drop_index(op.f("ix_case_projections_updated_at"), table_name="case_projections")
    op.drop_index(op.f("ix_case_projections_case_id"), table_name="case_projections")
    op.drop_index(op.f("ix_case_projections_tenant_id"), table_name="case_projections")
    op.drop_index(op.f("ix_case_projections_id"), table_name="case_projections")
    op.drop_table("case_projections")

    op.drop_index("uq_timeline_event_case_dedup_key_not_null", table_name="timeline_events")
    op.drop_index(op.f("ix_timeline_events_created_at"), table_name="timeline_events")
    op.drop_index(op.f("ix_timeline_events_event_type"), table_name="timeline_events")
    op.drop_index(op.f("ix_timeline_events_case_id"), table_name="timeline_events")
    op.drop_index(op.f("ix_timeline_events_tenant_id"), table_name="timeline_events")
    op.drop_index(op.f("ix_timeline_events_id"), table_name="timeline_events")
    op.drop_table("timeline_events")

    op.drop_index(op.f("ix_debtor_profiles_ogrn"), table_name="debtor_profiles")
    op.drop_index(op.f("ix_debtor_profiles_inn"), table_name="debtor_profiles")
    op.drop_index(op.f("ix_debtor_profiles_case_id"), table_name="debtor_profiles")
    op.drop_index(op.f("ix_debtor_profiles_tenant_id"), table_name="debtor_profiles")
    op.drop_index(op.f("ix_debtor_profiles_id"), table_name="debtor_profiles")
    op.drop_table("debtor_profiles")

    op.drop_index(op.f("ix_case_participants_role"), table_name="case_participants")
    op.drop_index(op.f("ix_case_participants_party_id"), table_name="case_participants")
    op.drop_index(op.f("ix_case_participants_case_id"), table_name="case_participants")
    op.drop_index(op.f("ix_case_participants_tenant_id"), table_name="case_participants")
    op.drop_index(op.f("ix_case_participants_id"), table_name="case_participants")
    op.drop_table("case_participants")

    op.drop_index(op.f("ix_cases_updated_at"), table_name="cases")
    op.drop_index(op.f("ix_cases_created_at"), table_name="cases")
    op.drop_index(op.f("ix_cases_eligible_at"), table_name="cases")
    op.drop_index(op.f("ix_cases_is_archived"), table_name="cases")
    op.drop_index(op.f("ix_cases_status"), table_name="cases")
    op.drop_index(op.f("ix_cases_organization_id"), table_name="cases")
    op.drop_index(op.f("ix_cases_user_id"), table_name="cases")
    op.drop_index(op.f("ix_cases_tenant_id"), table_name="cases")
    op.drop_index(op.f("ix_cases_id"), table_name="cases")
    op.drop_table("cases")

    op.drop_index(op.f("ix_parties_ogrn"), table_name="parties")
    op.drop_index(op.f("ix_parties_inn"), table_name="parties")
    op.drop_index(op.f("ix_parties_organization_id"), table_name="parties")
    op.drop_index(op.f("ix_parties_tenant_id"), table_name="parties")
    op.drop_index(op.f("ix_parties_id"), table_name="parties")
    op.drop_table("parties")

    op.drop_index(op.f("ix_organizations_ogrn"), table_name="organizations")
    op.drop_index(op.f("ix_organizations_inn"), table_name="organizations")
    op.drop_index(op.f("ix_organizations_tenant_id"), table_name="organizations")
    op.drop_index(op.f("ix_organizations_id"), table_name="organizations")
    op.drop_table("organizations")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_tenant_id"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")