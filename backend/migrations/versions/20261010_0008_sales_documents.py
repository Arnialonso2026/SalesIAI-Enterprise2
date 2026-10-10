"""Add internal sales documents with immutable item snapshots.

Revision ID: 20261010_0008
Revises: 20261009_0007
"""

from alembic import op
from alembic import context
import sqlalchemy as sa

revision = "20261010_0008"
down_revision = "20261009_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if context.is_offline_mode():
        return

    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "sales_documents" not in tables:
        op.create_table(
            "sales_documents",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("sale_id", sa.Integer(), sa.ForeignKey("sales.id", ondelete="CASCADE"), nullable=False),
            sa.Column("document_type", sa.String(length=20), nullable=False),
            sa.Column("document_number", sa.String(length=30), nullable=False),
            sa.Column("customer_name", sa.String(length=160), nullable=False),
            sa.Column("customer_document", sa.String(length=30), nullable=True),
            sa.Column("customer_address", sa.String(length=255), nullable=True),
            sa.Column("currency", sa.String(length=3), nullable=False, server_default="PEN"),
            sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
            sa.Column("discount", sa.Numeric(12, 2), nullable=False),
            sa.Column("tax", sa.Numeric(12, 2), nullable=False),
            sa.Column("total", sa.Numeric(12, 2), nullable=False),
            sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("sale_id"),
            sa.UniqueConstraint("document_number"),
        )
        tables.add("sales_documents")

    if "sales_document_items" not in tables:
        op.create_table(
            "sales_document_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "document_id",
                sa.Integer(),
                sa.ForeignKey("sales_documents.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("product_name", sa.String(length=160), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
            sa.Column("line_total", sa.Numeric(12, 2), nullable=False),
        )

    indexes = {
        table: {index["name"] for index in inspector.get_indexes(table)}
        for table in ("sales_documents", "sales_document_items")
    }
    for index_name, table, columns in (
        ("ix_sales_documents_company_id", "sales_documents", ["company_id"]),
        ("ix_sales_documents_sale_id", "sales_documents", ["sale_id"]),
        ("ix_sales_documents_document_number", "sales_documents", ["document_number"]),
        ("ix_sales_document_items_document_id", "sales_document_items", ["document_id"]),
    ):
        if index_name not in indexes[table]:
            op.create_index(index_name, table, columns)

    if "customers" in tables:
        op.execute(sa.text(
            "UPDATE customers "
            "SET customer_type = 'business', "
            "document_number = replace(replace(upper(document_number), 'RUC-', ''), 'RUC ', '') "
            "WHERE upper(document_number) LIKE 'RUC-%' OR upper(document_number) LIKE 'RUC %'"
        ))


def downgrade() -> None:
    if context.is_offline_mode():
        return

    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "sales_document_items" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("sales_document_items")}
        if "ix_sales_document_items_document_id" in indexes:
            op.drop_index("ix_sales_document_items_document_id", table_name="sales_document_items")
        op.drop_table("sales_document_items")
    if "sales_documents" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("sales_documents")}
        for index_name in (
            "ix_sales_documents_document_number",
            "ix_sales_documents_sale_id",
            "ix_sales_documents_company_id",
        ):
            if index_name in indexes:
                op.drop_index(index_name, table_name="sales_documents")
        op.drop_table("sales_documents")
