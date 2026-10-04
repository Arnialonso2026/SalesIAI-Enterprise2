"""Add DNI-based local credentials to users.

Revision ID: 20261003_0003
Revises: 20261003_0002
"""
from alembic import op
import sqlalchemy as sa

revision = "20261003_0003"
down_revision = "20261003_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"]: column for column in inspector.get_columns("users")}

    with op.batch_alter_table("users") as batch:
        if "dni" not in columns:
            batch.add_column(sa.Column("dni", sa.String(length=8), nullable=True))
        if not columns["email"]["nullable"]:
            batch.alter_column("email", existing_type=sa.String(length=255), nullable=True)
        if not columns["password_hash"]["nullable"]:
            batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=True)

    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_dni" not in indexes:
        op.create_index("ix_users_dni", "users", ["dni"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("users")}
    if "ix_users_dni" in indexes:
        op.drop_index("ix_users_dni", table_name="users")

    with op.batch_alter_table("users") as batch:
        batch.drop_column("dni")
        batch.alter_column("email", existing_type=sa.String(length=255), nullable=False)
        batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=False)
