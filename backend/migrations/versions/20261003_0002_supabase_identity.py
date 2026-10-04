"""Link local users to Supabase Auth identities.

Revision ID: 20261003_0002
Revises: 20261003_0001
"""
from alembic import op
import sqlalchemy as sa

revision = "20261003_0002"
down_revision = "20261003_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "auth_subject" not in columns:
        op.add_column("users", sa.Column("auth_subject", sa.String(length=64), nullable=True))

    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_auth_subject" not in indexes:
        op.create_index("ix_users_auth_subject", "users", ["auth_subject"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_auth_subject" in indexes:
        op.drop_index("ix_users_auth_subject", table_name="users")

    columns = {column["name"] for column in sa.inspect(bind).get_columns("users")}
    if "auth_subject" in columns:
        op.drop_column("users", "auth_subject")
