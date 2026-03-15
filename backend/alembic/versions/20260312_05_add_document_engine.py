from alembic import op
import sqlalchemy as sa


revision = "20260312_05_add_document_engine"
down_revision = "20260312_04_add_playbook_engine"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "document_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("contract_type", sa.String(length=100), nullable=True),
        sa.Column("document_kind", sa.String(length=100), nullable=False),
        sa.Column("template_body", sa.Text(), nullable=False),
        sa.Column("template_format", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_document_templates_id", "document_templates", ["id"])
    op.create_index("ix_document_templates_code", "document_templates", ["code"])
    op.create_index(
        "ix_document_templates_document_kind",
        "document_templates",
        ["document_kind"],
    )
    op.create_index(
        "ix_document_templates_tenant_id",
        "document_templates",
        ["tenant_id"],
    )

    op.create_table(
        "generated_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("format", sa.String(length=20), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=True),
        sa.Column("storage_provider", sa.String(length=50), nullable=True),
        sa.Column("rendered_content", sa.Text(), nullable=True),
        sa.Column("context_snapshot", sa.JSON(), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_generated_documents_id", "generated_documents", ["id"])
    op.create_index("ix_generated_documents_tenant_id", "generated_documents", ["tenant_id"])
    op.create_index("ix_generated_documents_case_id", "generated_documents", ["case_id"])
    op.create_index("ix_generated_documents_template_id", "generated_documents", ["template_id"])
    op.create_index("ix_generated_documents_code", "generated_documents", ["code"])


def downgrade():
    op.drop_index("ix_generated_documents_code", table_name="generated_documents")
    op.drop_index("ix_generated_documents_template_id", table_name="generated_documents")
    op.drop_index("ix_generated_documents_case_id", table_name="generated_documents")
    op.drop_index("ix_generated_documents_tenant_id", table_name="generated_documents")
    op.drop_index("ix_generated_documents_id", table_name="generated_documents")
    op.drop_table("generated_documents")

    op.drop_index("ix_document_templates_tenant_id", table_name="document_templates")
    op.drop_index("ix_document_templates_document_kind", table_name="document_templates")
    op.drop_index("ix_document_templates_code", table_name="document_templates")
    op.drop_index("ix_document_templates_id", table_name="document_templates")
    op.drop_table("document_templates")