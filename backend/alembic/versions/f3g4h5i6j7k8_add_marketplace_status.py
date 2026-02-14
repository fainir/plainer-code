"""add marketplace status

Revision ID: f3g4h5i6j7k8
Revises: d2e3f4g5h6i7
Create Date: 2026-02-14 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f3g4h5i6j7k8"
down_revision: Union[str, None] = "d2e3f4g5h6i7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add status column with "approved" default so existing builtin rows get approved
    op.add_column(
        "marketplace_items",
        sa.Column("status", sa.String(20), nullable=False, server_default="approved"),
    )
    # Change default to "draft" for future user-created rows
    op.alter_column(
        "marketplace_items",
        "status",
        server_default="draft",
    )


def downgrade() -> None:
    op.drop_column("marketplace_items", "status")
