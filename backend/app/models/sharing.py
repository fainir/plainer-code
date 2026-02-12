import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class FileShare(UUIDMixin, Base):
    __tablename__ = "file_shares"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )
    shared_with_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    shared_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    permission: Mapped[str] = mapped_column(String(20), default="view")  # view, edit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    file: Mapped["File"] = relationship("File")
    shared_with: Mapped["User"] = relationship("User", foreign_keys=[shared_with_id])
    shared_by: Mapped["User"] = relationship("User", foreign_keys=[shared_by_id])

    __table_args__ = (
        UniqueConstraint("file_id", "shared_with_id", name="uq_file_share"),
    )


class FolderShare(UUIDMixin, Base):
    __tablename__ = "folder_shares"

    folder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folders.id", ondelete="CASCADE"), nullable=False
    )
    shared_with_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    shared_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    permission: Mapped[str] = mapped_column(String(20), default="view")  # view, edit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    folder: Mapped["Folder"] = relationship("Folder")
    shared_with: Mapped["User"] = relationship("User", foreign_keys=[shared_with_id])
    shared_by: Mapped["User"] = relationship("User", foreign_keys=[shared_by_id])

    __table_args__ = (
        UniqueConstraint("folder_id", "shared_with_id", name="uq_folder_share"),
    )
