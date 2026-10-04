"""Create analytics tables used by phases 9-12.

Revision ID: 20261004_0004
Revises: 20261003_0003
"""
from alembic import op

from app.database import Base
from app import models  # noqa: F401

revision = "20261004_0004"
down_revision = "20261003_0003"
branch_labels = None
depends_on = None

ANALYTICS_TABLES = (
    "analytics_datasets",
    "dataset_variables",
    "dataset_observations",
    "statistical_analyses",
    "analysis_variables",
    "statistical_results",
    "bayesian_analyses",
    "bayesian_evidence",
    "bayesian_results",
    "insights",
    "insight_evidence",
    "reports",
)


def upgrade() -> None:
    tables = [Base.metadata.tables[name] for name in ANALYTICS_TABLES]
    Base.metadata.create_all(bind=op.get_bind(), tables=tables, checkfirst=True)


def downgrade() -> None:
    tables = [Base.metadata.tables[name] for name in reversed(ANALYTICS_TABLES)]
    Base.metadata.drop_all(bind=op.get_bind(), tables=tables, checkfirst=True)