"""Add company branches with Peru map coordinates.

Revision ID: 20261013_0011
Revises: 20261012_0010
"""

from alembic import context, op
import sqlalchemy as sa

revision = "20261013_0011"
down_revision = "20261012_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if context.is_offline_mode():
        return

    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "branches" not in tables:
        op.create_table(
            "branches",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("address", sa.String(length=255), nullable=True),
            sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
            sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("company_id", "name", name="uq_branches_company_name"),
            sa.CheckConstraint("latitude >= -18.5 AND latitude <= 0.2", name="ck_branches_peru_latitude"),
            sa.CheckConstraint("longitude >= -81.5 AND longitude <= -68.5", name="ck_branches_peru_longitude"),
        )
        op.create_index("ix_branches_company_id", "branches", ["company_id"])


def downgrade() -> None:
    if context.is_offline_mode():
        return

    if "branches" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_index("ix_branches_company_id", table_name="branches")
        op.drop_table("branches")
