import mimetypes
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file import File, FileVersion
from app.models.folder import Folder
from app.models.sharing import FileShare, FolderShare
from app.models.user import User
from app.models.view import FileView
from app.models.workspace import Workspace, WorkspaceMember
from app.services.view_templates import (
    generate_table_html,
    generate_board_html,
    generate_calendar_html,
    generate_document_html,
)
from app.storage.base import StorageBackend


def detect_file_type(mime_type: str, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    # HTML files are view files
    if ext in ("html", "htm"):
        return "view"
    code_extensions = {
        "py", "js", "ts", "tsx", "jsx", "java", "go", "rs", "c", "cpp", "h",
        "rb", "php", "swift", "kt", "cs", "scala", "sh", "bash", "zsh",
        "css", "scss", "less", "sql", "yaml", "yml", "toml", "json",
        "xml", "ini", "cfg", "conf", "dockerfile", "makefile",
    }
    if ext in code_extensions or mime_type.startswith("text/x-"):
        return "code"
    if ext in ("md", "markdown", "txt", "rst", "doc", "docx", "rtf"):
        return "document"
    if mime_type.startswith("image/"):
        return "image"
    if ext == "pdf" or mime_type == "application/pdf":
        return "pdf"
    if ext in ("csv", "xls", "xlsx", "tsv"):
        return "spreadsheet"
    return "other"


def detect_mime_type(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or "application/octet-stream"


async def get_user_drive(db: AsyncSession, user_id: uuid.UUID) -> Workspace:
    """Get the user's personal drive (workspace). Auto-creates one if missing."""
    result = await db.execute(
        select(Workspace).where(
            Workspace.owner_id == user_id,
            Workspace.slug.startswith("drive-"),
        )
    )
    drive = result.scalar_one_or_none()
    if drive is not None:
        return drive

    # Auto-create drive for users who predate the feature
    user_result = await db.execute(select(User).where(User.id == user_id))
    user_obj = user_result.scalar_one()

    drive = Workspace(
        name=f"{user_obj.display_name}'s Drive",
        slug=f"drive-{user_id}",
        description="Personal drive",
        owner_id=user_id,
    )
    db.add(drive)
    await db.flush()

    member = WorkspaceMember(
        workspace_id=drive.id,
        user_id=user_id,
        role="owner",
    )
    db.add(member)
    await db.flush()
    await db.commit()

    return drive


async def create_file_from_content(
    db: AsyncSession,
    storage: StorageBackend,
    workspace_id: uuid.UUID,
    name: str,
    content: str,
    owner_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    created_by_id: uuid.UUID | None = None,
    created_by_agent: bool = False,
) -> File:
    mime_type = detect_mime_type(name)
    file_type = detect_file_type(mime_type, name)
    content_bytes = content.encode("utf-8")
    size_bytes = len(content_bytes)

    storage_key = f"{workspace_id}/{uuid.uuid4()}/{name}"
    await storage.put(storage_key, content_bytes)

    file = File(
        owner_id=owner_id,
        workspace_id=workspace_id,
        folder_id=folder_id,
        name=name,
        mime_type=mime_type,
        size_bytes=size_bytes,
        storage_key=storage_key,
        file_type=file_type,
        content_text=content,
        is_vibe_file=created_by_agent,
        created_by_id=created_by_id,
        created_by_agent=created_by_agent,
    )
    db.add(file)
    await db.flush()

    version = FileVersion(
        file_id=file.id,
        version_number=1,
        storage_key=storage_key,
        size_bytes=size_bytes,
        content_text=content,
        change_summary="Initial version",
        created_by_id=created_by_id,
        created_by_agent=created_by_agent,
        created_at=datetime.now(timezone.utc),
    )
    db.add(version)
    await db.flush()

    return file


async def auto_create_views_for_file(
    db: AsyncSession,
    storage: StorageBackend,
    file: File,
    content: str,
) -> list[FileView]:
    """Auto-create HTML view files for a data file and link them."""
    ext = file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ""
    base = file.name.rsplit(".", 1)[0] if "." in file.name else file.name
    views: list[FileView] = []

    if ext in ("csv", "tsv") or file.file_type == "spreadsheet":
        templates = [
            (f"{base} - Table.html", "Table", generate_table_html(content, base)),
            (f"{base} - Board.html", "Board", generate_board_html(content, base)),
            (f"{base} - Calendar.html", "Calendar", generate_calendar_html(content, base)),
        ]
    elif ext in ("md", "markdown") or file.file_type == "document":
        templates = [
            (f"{base} - Document.html", "Document", generate_document_html(content, base)),
        ]
    else:
        return views

    # Always put generated views in the "Views" system folder (child of Files)
    views_folder, _ = await ensure_system_folders(db, file.workspace_id, file.owner_id)

    for position, (name, label, html) in enumerate(templates):
        html_bytes = html.encode("utf-8")
        s_key = f"{file.workspace_id}/{uuid.uuid4()}/{name}"
        await storage.put(s_key, html_bytes)

        view_file = File(
            owner_id=file.owner_id,
            workspace_id=file.workspace_id,
            folder_id=views_folder.id,
            name=name,
            mime_type="text/html",
            size_bytes=len(html_bytes),
            storage_key=s_key,
            file_type="view",
            content_text=html,
            is_vibe_file=file.is_vibe_file,
            created_by_id=file.created_by_id,
            created_by_agent=file.created_by_agent,
        )
        db.add(view_file)
        await db.flush()

        link = FileView(
            file_id=file.id,
            view_file_id=view_file.id,
            label=label,
            position=position,
        )
        db.add(link)
        await db.flush()
        views.append(link)

    return views


async def list_drive_files(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
) -> list[File]:
    query = select(File).where(
        File.workspace_id == workspace_id,
        File.deleted_at.is_(None),
    )
    if folder_id:
        query = query.where(File.folder_id == folder_id)
    else:
        query = query.where(File.folder_id.is_(None))

    query = query.order_by(File.name)
    result = await db.execute(query)
    return list(result.scalars().all())


async def list_all_workspace_files(
    db: AsyncSession,
    workspace_id: uuid.UUID,
) -> list[File]:
    """List all non-deleted files in a workspace, regardless of folder."""
    result = await db.execute(
        select(File).where(
            File.workspace_id == workspace_id,
            File.deleted_at.is_(None),
        ).order_by(File.name)
    )
    return list(result.scalars().all())


async def list_shared_with_me(
    db: AsyncSession, user_id: uuid.UUID
) -> list[File]:
    result = await db.execute(
        select(File)
        .join(FileShare, FileShare.file_id == File.id)
        .where(
            FileShare.shared_with_id == user_id,
            File.deleted_at.is_(None),
        )
        .order_by(File.name)
    )
    return list(result.scalars().all())


async def list_recent_files(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 20
) -> list[File]:
    """Recent files owned by user or shared with them."""
    owned = select(File.id).where(
        File.owner_id == user_id,
        File.deleted_at.is_(None),
    )
    shared = select(FileShare.file_id).where(FileShare.shared_with_id == user_id)

    result = await db.execute(
        select(File)
        .where(
            File.deleted_at.is_(None),
            or_(File.id.in_(owned), File.id.in_(shared)),
        )
        .order_by(File.updated_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_file_by_id(
    db: AsyncSession, file_id: uuid.UUID
) -> File | None:
    result = await db.execute(select(File).where(File.id == file_id, File.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_file_content(
    db: AsyncSession, storage: StorageBackend, file_id: uuid.UUID
) -> str | None:
    file = await get_file_by_id(db, file_id)
    if file is None:
        return None
    if file.content_text is not None:
        return file.content_text
    data = await storage.get(file.storage_key)
    if data is None:
        return None
    return data.decode("utf-8")


async def list_drive_folders(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    parent_id: uuid.UUID | None = None,
) -> list[Folder]:
    query = select(Folder).where(Folder.workspace_id == workspace_id)
    if parent_id:
        query = query.where(Folder.parent_id == parent_id)
    else:
        query = query.where(Folder.parent_id.is_(None))
    query = query.order_by(Folder.name)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_or_create_system_folder(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    owner_id: uuid.UUID,
    name: str,
) -> Folder:
    """Get or create a well-known root-level folder (e.g. 'Views', 'Files')."""
    result = await db.execute(
        select(Folder).where(
            Folder.workspace_id == workspace_id,
            Folder.parent_id.is_(None),
            Folder.name == name,
        )
    )
    folder = result.scalar_one_or_none()
    if folder is not None:
        return folder
    return await create_folder(db, workspace_id, owner_id, name)


async def ensure_system_folders(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> tuple[Folder, Folder]:
    """Ensure Views and Files root folders exist. Returns (views_folder, files_folder).

    Views is a child of Files. Also migrates any orphaned root-level files
    into the correct folder, and re-parents a root-level Views under Files.
    """
    files = await get_or_create_system_folder(db, workspace_id, owner_id, "Files")

    # Views lives inside Files
    result = await db.execute(
        select(Folder).where(
            Folder.workspace_id == workspace_id,
            Folder.name == "Views",
            Folder.parent_id == files.id,
        )
    )
    views = result.scalar_one_or_none()
    if views is None:
        # Check for legacy root-level Views folder and re-parent it
        legacy = await db.execute(
            select(Folder).where(
                Folder.workspace_id == workspace_id,
                Folder.name == "Views",
                Folder.parent_id.is_(None),
            )
        )
        views = legacy.scalar_one_or_none()
        if views is not None:
            views.parent_id = files.id
            views.path = f"{files.path}Views/"
            await db.flush()
        else:
            views = await create_folder(db, workspace_id, owner_id, "Views", parent_id=files.id)

    # Migrate orphaned root files into the correct system folder
    result = await db.execute(
        select(File).where(
            File.workspace_id == workspace_id,
            File.folder_id.is_(None),
            File.deleted_at.is_(None),
        )
    )
    orphans = list(result.scalars().all())
    for f in orphans:
        if f.file_type == "view":
            f.folder_id = views.id
        else:
            f.folder_id = files.id
    if orphans:
        await db.flush()

    return views, files


async def create_folder(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    owner_id: uuid.UUID,
    name: str,
    parent_id: uuid.UUID | None = None,
) -> Folder:
    if parent_id:
        parent = await db.execute(select(Folder).where(Folder.id == parent_id))
        parent_folder = parent.scalar_one_or_none()
        path = f"{parent_folder.path}{name}/" if parent_folder else f"/{name}/"
    else:
        path = f"/{name}/"

    folder = Folder(
        owner_id=owner_id,
        workspace_id=workspace_id,
        parent_id=parent_id,
        name=name,
        path=path,
        created_by_id=owner_id,
    )
    db.add(folder)
    await db.flush()
    return folder


async def toggle_file_favorite(
    db: AsyncSession, file_id: uuid.UUID, user_id: uuid.UUID
) -> File:
    file = await get_file_by_id(db, file_id)
    if file is None or file.owner_id != user_id:
        raise ValueError("File not found")
    file.is_favorite = not file.is_favorite
    await db.flush()
    return file


async def toggle_folder_favorite(
    db: AsyncSession, folder_id: uuid.UUID, user_id: uuid.UUID
) -> Folder:
    result = await db.execute(select(Folder).where(Folder.id == folder_id))
    folder = result.scalar_one_or_none()
    if folder is None or folder.owner_id != user_id:
        raise ValueError("Folder not found")
    folder.is_favorite = not folder.is_favorite
    await db.flush()
    return folder


async def list_favorite_files(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[File]:
    result = await db.execute(
        select(File).where(
            File.workspace_id == workspace_id,
            File.is_favorite.is_(True),
            File.deleted_at.is_(None),
        ).order_by(File.name)
    )
    return list(result.scalars().all())


async def list_favorite_folders(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[Folder]:
    result = await db.execute(
        select(Folder).where(
            Folder.workspace_id == workspace_id,
            Folder.is_favorite.is_(True),
        ).order_by(Folder.name)
    )
    return list(result.scalars().all())


async def list_view_files(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[File]:
    """List files with file_type='view' (HTML view files)."""
    result = await db.execute(
        select(File).where(
            File.workspace_id == workspace_id,
            File.file_type == "view",
            File.deleted_at.is_(None),
        ).order_by(File.name)
    )
    return list(result.scalars().all())


async def link_view_to_file(
    db: AsyncSession,
    file_id: uuid.UUID,
    view_file_id: uuid.UUID,
    label: str,
    position: int = 0,
) -> FileView:
    link = FileView(
        file_id=file_id,
        view_file_id=view_file_id,
        label=label,
        position=position,
    )
    db.add(link)
    await db.flush()
    return link


async def unlink_view_from_file(
    db: AsyncSession,
    file_view_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(FileView).where(FileView.id == file_view_id)
    )
    link = result.scalar_one_or_none()
    if link:
        await db.delete(link)
        await db.flush()


async def get_linked_views_for_file(
    db: AsyncSession, file_id: uuid.UUID
) -> list[FileView]:
    result = await db.execute(
        select(FileView)
        .where(FileView.file_id == file_id)
        .order_by(FileView.position)
    )
    return list(result.scalars().all())


async def list_all_views(
    db: AsyncSession, workspace_id: uuid.UUID
) -> dict:
    """Return HTML view files + data files that qualify for built-in views."""
    html_views = await list_view_files(db, workspace_id)

    builtin_result = await db.execute(
        select(File).where(
            File.workspace_id == workspace_id,
            File.deleted_at.is_(None),
            File.file_type.in_(["spreadsheet", "document"]),
        ).order_by(File.name)
    )
    builtin_files = list(builtin_result.scalars().all())

    return {
        "html_views": html_views,
        "builtin_files": builtin_files,
    }


async def share_file(
    db: AsyncSession,
    file_id: uuid.UUID,
    shared_by_id: uuid.UUID,
    shared_with_id: uuid.UUID,
    permission: str = "view",
) -> FileShare:
    share = FileShare(
        file_id=file_id,
        shared_with_id=shared_with_id,
        shared_by_id=shared_by_id,
        permission=permission,
    )
    db.add(share)
    await db.flush()
    return share


async def share_folder(
    db: AsyncSession,
    folder_id: uuid.UUID,
    shared_by_id: uuid.UUID,
    shared_with_id: uuid.UUID,
    permission: str = "view",
) -> FolderShare:
    share = FolderShare(
        folder_id=folder_id,
        shared_with_id=shared_with_id,
        shared_by_id=shared_by_id,
        permission=permission,
    )
    db.add(share)
    await db.flush()
    return share
