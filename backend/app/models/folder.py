import uuid

from sqlalchemy import Boolean, ForeignKey, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Folder(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "folders"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")

    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id])
    workspace: Mapped["Workspace"] = relationship("Workspace")
    parent: Mapped["Folder | None"] = relationship("Folder", remote_side="Folder.id")
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        UniqueConstraint("workspace_id", "parent_id", "name", name="uq_folder_name"),
    )
