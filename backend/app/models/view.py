import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class FileView(UUIDMixin, TimestampMixin, Base):
    """Links an HTML view file to a data file (e.g. dashboard.html → tasks.csv)."""

    __tablename__ = "file_views"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )
    view_file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)

    file: Mapped["File"] = relationship("File", foreign_keys=[file_id], overlaps="linked_views")
    view_file: Mapped["File"] = relationship("File", foreign_keys=[view_file_id], overlaps="linked_to_files")

    __table_args__ = (
        UniqueConstraint("file_id", "view_file_id", name="uq_file_view"),
    )
