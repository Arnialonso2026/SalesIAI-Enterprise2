"""Add commercial profile fields to customers.

Revision ID: 20261009_0007
Revises: 20261006_0006
"""

from alembic import op
import sqlalchemy as sa

revision = "20261009_0007"
down_revision = "20261006_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("customers")}
    columns = (
        sa.Column("customer_type", sa.String(length=20), nullable=False, server_default=sa.text("'individual'")),
        sa.Column("contact_name", sa.String(length=160), nullable=True),
        sa.Column("industry", sa.String(length=120), nullable=True),
        sa.Column("preferred_contact_method", sa.String(length=20), nullable=False, server_default=sa.text("'whatsapp'")),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    for column in columns:
        if column.name not in existing_columns:
            op.add_column("customers", column)


def downgrade() -> None:
    existing_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("customers")}
    for column_name in ("notes", "preferred_contact_method", "industry", "contact_name", "customer_type"):
        if column_name in existing_columns:
            op.drop_column("customers", column_name)
