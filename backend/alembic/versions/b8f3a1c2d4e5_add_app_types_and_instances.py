"""add_app_types_and_instances

Revision ID: b8f3a1c2d4e5
Revises: 47a2b360bd07
Create Date: 2026-02-14 12:00:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b8f3a1c2d4e5"
down_revision: Union[str, None] = "47a2b360bd07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Pre-generated UUIDs for built-in app types so we can reference them in data migration
BUILTIN_APP_TYPES = [
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
        "slug": "table",
        "label": "Table",
        "icon": "table",
        "renderer": "builtin-table",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "slug": "board",
        "label": "Board",
        "icon": "columns-3",
        "renderer": "builtin-board",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000003"),
        "slug": "calendar",
        "label": "Calendar",
        "icon": "calendar",
        "renderer": "builtin-calendar",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000004"),
        "slug": "document",
        "label": "Document",
        "icon": "file-text",
        "renderer": "builtin-document",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000005"),
        "slug": "text-editor",
        "label": "Text Editor",
        "icon": "pencil",
        "renderer": "builtin-editor",
    },
]

# Map FileView labels to app type UUIDs
LABEL_TO_APP_TYPE = {
    "Table": uuid.UUID("00000000-0000-0000-0000-000000000001"),
    "Board": uuid.UUID("00000000-0000-0000-0000-000000000002"),
    "Calendar": uuid.UUID("00000000-0000-0000-0000-000000000003"),
    "Document": uuid.UUID("00000000-0000-0000-0000-000000000004"),
}


def upgrade() -> None:
    # 1. Create app_types table
    op.create_table(
        "app_types",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("workspace_id", sa.UUID(), nullable=True),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("icon", sa.String(length=50), nullable=False, server_default="eye"),
        sa.Column("renderer", sa.String(length=50), nullable=False),
        sa.Column("template_content", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by_agent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2. Seed built-in app types
    app_types_table = sa.table(
        "app_types",
        sa.column("id", sa.UUID()),
        sa.column("workspace_id", sa.UUID()),
        sa.column("slug", sa.String()),
        sa.column("label", sa.String()),
        sa.column("icon", sa.String()),
        sa.column("renderer", sa.String()),
        sa.column("template_content", sa.Text()),
        sa.column("description", sa.Text()),
        sa.column("created_by_agent", sa.Boolean()),
    )
    op.bulk_insert(
        app_types_table,
        [
            {
                "id": at["id"],
                "workspace_id": None,
                "slug": at["slug"],
                "label": at["label"],
                "icon": at["icon"],
                "renderer": at["renderer"],
                "template_content": None,
                "description": None,
                "created_by_agent": False,
            }
            for at in BUILTIN_APP_TYPES
        ],
    )

    # 3. Add instance columns to files table
    op.add_column("files", sa.Column("is_instance", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("files", sa.Column("app_type_id", sa.UUID(), nullable=True))
    op.add_column("files", sa.Column("source_file_id", sa.UUID(), nullable=True))
    op.add_column("files", sa.Column("instance_config", sa.Text(), nullable=True))
    op.create_foreign_key("fk_files_app_type_id", "files", "app_types", ["app_type_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_files_source_file_id", "files", "files", ["source_file_id"], ["id"], ondelete="SET NULL")

    # 4. Migrate existing FileView records: convert linked view files into instances
    # For each file_views row, update the corresponding view_file in files table
    conn = op.get_bind()

    file_views = conn.execute(
        sa.text("""
            SELECT fv.view_file_id, fv.file_id, fv.label,
                   src.folder_id AS source_folder_id
            FROM file_views fv
            JOIN files src ON src.id = fv.file_id
        """)
    ).fetchall()

    for row in file_views:
        view_file_id = row[0]
        source_file_id = row[1]
        label = row[2]
        source_folder_id = row[3]

        app_type_id = LABEL_TO_APP_TYPE.get(label)
        if app_type_id is None:
            # Custom view — treat as document type
            app_type_id = LABEL_TO_APP_TYPE["Document"]

        conn.execute(
            sa.text("""
                UPDATE files
                SET is_instance = true,
                    app_type_id = :app_type_id,
                    source_file_id = :source_file_id,
                    file_type = 'instance',
                    folder_id = :folder_id
                WHERE id = :view_file_id
            """),
            {
                "app_type_id": str(app_type_id),
                "source_file_id": str(source_file_id),
                "view_file_id": str(view_file_id),
                "folder_id": str(source_folder_id) if source_folder_id else None,
            },
        )

    # 5. Create index for efficient instance lookups
    op.create_index(
        "ix_files_source_file_instances",
        "files",
        ["source_file_id"],
        postgresql_where=sa.text("is_instance = true AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_files_source_file_instances", table_name="files")
    op.drop_constraint("fk_files_source_file_id", "files", type_="foreignkey")
    op.drop_constraint("fk_files_app_type_id", "files", type_="foreignkey")
    op.drop_column("files", "instance_config")
    op.drop_column("files", "source_file_id")
    op.drop_column("files", "app_type_id")
    op.drop_column("files", "is_instance")
    op.drop_table("app_types")
