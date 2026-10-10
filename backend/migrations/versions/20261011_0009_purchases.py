"""Add purchases and purchase inventory references.

Revision ID: 20261011_0009
Revises: 20261010_0008
"""

from alembic import context, op
import sqlalchemy as sa

revision = "20261011_0009"
down_revision = "20261010_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if context.is_offline_mode():
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "purchases" not in tables:
        op.create_table(
            "purchases",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("purchase_number", sa.String(length=30), nullable=False, unique=True),
            sa.Column("supplier_name", sa.String(length=160), nullable=False),
            sa.Column("supplier_document_number", sa.String(length=30), nullable=True),
            sa.Column("supplier_address", sa.String(length=255), nullable=True),
            sa.Column("created_by_name", sa.String(length=160), nullable=False),
            sa.Column("total", sa.Numeric(12, 2), nullable=False),
            sa.Column("notes", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        tables.add("purchases")

    if "purchase_items" not in tables:
        op.create_table(
            "purchase_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "purchase_id",
                sa.Integer(),
                sa.ForeignKey("purchases.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
            sa.Column("product_name", sa.String(length=160), nullable=False),
            sa.Column("product_sku", sa.String(length=40), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("unit_cost", sa.Numeric(12, 2), nullable=False),
            sa.Column("line_total", sa.Numeric(12, 2), nullable=False),
        )
        tables.add("purchase_items")

    movement_columns = {column["name"] for column in inspector.get_columns("inventory_movements")}
    if "purchase_id" not in movement_columns:
        op.add_column(
            "inventory_movements",
            sa.Column("purchase_id", sa.Integer(), sa.ForeignKey("purchases.id"), nullable=True),
        )

    inspector = sa.inspect(bind)
    indexes = {
        table: {index["name"] for index in inspector.get_indexes(table)}
        for table in ("purchases", "purchase_items", "inventory_movements")
    }
    for index_name, table, columns in (
        ("ix_purchases_company_id", "purchases", ["company_id"]),
        ("ix_purchases_purchase_number", "purchases", ["purchase_number"]),
        ("ix_purchases_created_at", "purchases", ["created_at"]),
        ("ix_purchase_items_purchase_id", "purchase_items", ["purchase_id"]),
        ("ix_purchase_items_product_id", "purchase_items", ["product_id"]),
        ("ix_inventory_movements_purchase_id", "inventory_movements", ["purchase_id"]),
    ):
        if index_name not in indexes[table]:
            op.create_index(index_name, table, columns)


def downgrade() -> None:
    if context.is_offline_mode():
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "inventory_movements" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("inventory_movements")}
        if "ix_inventory_movements_purchase_id" in indexes:
            op.drop_index("ix_inventory_movements_purchase_id", table_name="inventory_movements")
        columns = {column["name"] for column in inspector.get_columns("inventory_movements")}
        if "purchase_id" in columns:
            op.drop_column("inventory_movements", "purchase_id")
    for table in ("purchase_items", "purchases"):
        if table not in tables:
            continue
        indexes = {index["name"] for index in inspector.get_indexes(table)}
        for index_name in indexes:
            op.drop_index(index_name, table_name=table)
        op.drop_table(table)
