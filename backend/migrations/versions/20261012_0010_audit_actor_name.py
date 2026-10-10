"""Add historical actor names to audit events.

Revision ID: 20261012_0010
Revises: 20261011_0009
"""

from alembic import context, op
import sqlalchemy as sa

revision = "20261012_0010"
down_revision = "20261011_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if context.is_offline_mode():
        return

    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("audit_logs")}
    if "actor_name" not in columns:
        op.add_column("audit_logs", sa.Column("actor_name", sa.String(length=160), nullable=True))


def downgrade() -> None:
    if context.is_offline_mode():
        return

    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("audit_logs")}
    if "actor_name" in columns:
        op.drop_column("audit_logs", "actor_name")
