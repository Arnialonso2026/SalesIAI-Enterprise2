"""Add contact snapshots to sales documents.

Revision ID: 20261014_0012
Revises: 20261013_0011
"""

from alembic import context, op
import sqlalchemy as sa

revision = "20261014_0012"
down_revision = "20261013_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if context.is_offline_mode():
        return

    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("sales_documents")}
    if "customer_email" not in columns:
        op.add_column("sales_documents", sa.Column("customer_email", sa.String(length=255), nullable=True))
    if "customer_phone" not in columns:
        op.add_column("sales_documents", sa.Column("customer_phone", sa.String(length=40), nullable=True))


def downgrade() -> None:
    if context.is_offline_mode():
        return

    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("sales_documents")}
    if "customer_phone" in columns:
        op.drop_column("sales_documents", "customer_phone")
    if "customer_email" in columns:
        op.drop_column("sales_documents", "customer_email")
