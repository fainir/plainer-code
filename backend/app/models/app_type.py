import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class AppType(UUIDMixin, TimestampMixin, Base):
    """Reusable app type (e.g. Table, Board, Calendar, Document, Text Editor).

    Built-in types have workspace_id=NULL.  Custom types created by the AI
    are scoped to a workspace.
    """

    __tablename__ = "app_types"

    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True
    )
    slug: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False, default="eye")
    renderer: Mapped[str] = mapped_column(String(50), nullable=False)
    template_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_agent: Mapped[bool] = mapped_column(Boolean, default=False)
