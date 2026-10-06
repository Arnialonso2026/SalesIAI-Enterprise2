"""Add document storage metadata.

Revision ID: 20261006_0006
Revises: 20261004_0005
"""

from alembic import op
import sqlalchemy as sa

revision = "20261006_0006"
down_revision = "20261004_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "documents" not in inspector.get_table_names():
        op.create_table(
            "documents",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("company_id", sa.Integer(), nullable=False),
            sa.Column("uploaded_by_id", sa.Integer(), nullable=True),
            sa.Column("title", sa.String(length=160), nullable=False),
            sa.Column("filename", sa.String(length=255), nullable=False, unique=True),
            sa.Column("original_filename", sa.String(length=255), nullable=False),
            sa.Column("mime_type", sa.String(length=120), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
            sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    existing_indexes = {index["name"] for index in inspector.get_indexes("documents")}
    for index_name, columns in (
        ("ix_documents_company_id", ["company_id"]),
        ("ix_documents_created_at", ["created_at"]),
        ("ix_documents_uploaded_by_id", ["uploaded_by_id"]),
    ):
        if index_name not in existing_indexes:
            op.create_index(index_name, "documents", columns, unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_documents_uploaded_by_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_created_at"), table_name="documents")
    op.drop_index(op.f("ix_documents_company_id"), table_name="documents")
    op.drop_table("documents")
