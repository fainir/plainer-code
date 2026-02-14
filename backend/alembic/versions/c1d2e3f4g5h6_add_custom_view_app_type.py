"""add_custom_view_app_type

Revision ID: c1d2e3f4g5h6
Revises: b8f3a1c2d4e5
Create Date: 2026-02-14 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4g5h6"
down_revision: Union[str, None] = "b8f3a1c2d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO app_types (id, workspace_id, slug, label, icon, renderer, description, created_by_agent, created_at, updated_at)
        VALUES (
            '00000000-0000-0000-0000-000000000006',
            NULL,
            'custom-view',
            'Custom View',
            'eye',
            'html-template',
            'Custom HTML visualization',
            false,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM app_types WHERE id = '00000000-0000-0000-0000-000000000006'")
