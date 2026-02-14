import io
import mimetypes
import uuid
from datetime import datetime, timezone

import mammoth
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.app_type import AppType
from app.models.file import File, FileVersion
from app.models.folder import Folder
from app.models.sharing import FileShare, FolderShare
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.filestore.base import StorageBackend


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


def is_docx_file(filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in ("doc", "docx")


def convert_docx_to_html(docx_bytes: bytes) -> str:
    result = mammoth.convert_to_html(io.BytesIO(docx_bytes))
    return result.value


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


async def create_file_from_binary(
    db: AsyncSession,
    storage: StorageBackend,
    workspace_id: uuid.UUID,
    name: str,
    data: bytes,
    owner_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    created_by_id: uuid.UUID | None = None,
) -> File:
    mime_type = detect_mime_type(name)
    file_type = detect_file_type(mime_type, name)
    size_bytes = len(data)

    storage_key = f"{workspace_id}/{uuid.uuid4()}/{name}"
    await storage.put(storage_key, data)

    # For docx files, convert to HTML and store in content_text
    content_text = None
    if is_docx_file(name):
        try:
            content_text = convert_docx_to_html(data)
        except Exception:
            content_text = None

    file = File(
        owner_id=owner_id,
        workspace_id=workspace_id,
        folder_id=folder_id,
        name=name,
        mime_type=mime_type,
        size_bytes=size_bytes,
        storage_key=storage_key,
        file_type=file_type,
        content_text=content_text,
        created_by_id=created_by_id,
    )
    db.add(file)
    await db.flush()

    version = FileVersion(
        file_id=file.id,
        version_number=1,
        storage_key=storage_key,
        size_bytes=size_bytes,
        content_text=content_text,
        change_summary="Initial version",
        created_by_id=created_by_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(version)
    await db.flush()

    return file


async def get_app_type_by_slug(
    db: AsyncSession, slug: str, workspace_id: uuid.UUID | None = None
) -> AppType | None:
    """Get an app type by slug. Checks global (workspace_id=NULL) first, then workspace-specific."""
    result = await db.execute(
        select(AppType).where(
            AppType.slug == slug,
            or_(AppType.workspace_id.is_(None), AppType.workspace_id == workspace_id),
        ).order_by(AppType.workspace_id.asc())  # NULL (global) first
    )
    return result.scalars().first()


async def list_app_types(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[AppType]:
    """List all app types available to a workspace (global + workspace-specific)."""
    result = await db.execute(
        select(AppType).where(
            or_(AppType.workspace_id.is_(None), AppType.workspace_id == workspace_id)
        ).order_by(AppType.label)
    )
    return list(result.scalars().all())


async def create_app_type(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    slug: str,
    label: str,
    icon: str = "eye",
    renderer: str = "html-template",
    template_content: str | None = None,
    description: str | None = None,
    created_by_agent: bool = False,
) -> AppType:
    """Create a custom app type for a workspace."""
    app = AppType(
        workspace_id=workspace_id,
        slug=slug,
        label=label,
        icon=icon,
        renderer=renderer,
        template_content=template_content,
        description=description,
        created_by_agent=created_by_agent,
    )
    db.add(app)
    await db.flush()
    return app


async def get_instances_for_file(
    db: AsyncSession, file_id: uuid.UUID
) -> list[File]:
    """Get all instances linked to a data file."""
    result = await db.execute(
        select(File)
        .options(selectinload(File.app_type))
        .where(
            File.source_file_id == file_id,
            File.is_instance.is_(True),
            File.deleted_at.is_(None),
        )
        .order_by(File.name)
    )
    return list(result.scalars().all())


async def create_instance(
    db: AsyncSession,
    storage: StorageBackend,
    source_file: File,
    app_type: AppType,
    name: str | None = None,
    config: str | None = None,
    content: str | None = None,
) -> File:
    """Create an instance file for a data file using an app type."""
    base = source_file.name.rsplit(".", 1)[0] if "." in source_file.name else source_file.name
    instance_name = name or f"{base} - {app_type.label}"
    instance_config = config or "{}"

    # For html-template renderers, store HTML content; for built-in, store config
    if app_type.renderer == "html-template" and content:
        content_text = content
        store_bytes = content.encode("utf-8")
        mime = "text/html"
    else:
        content_text = None
        store_bytes = instance_config.encode("utf-8")
        mime = "application/json"

    s_key = f"{source_file.workspace_id}/{uuid.uuid4()}/{instance_name}"
    await storage.put(s_key, store_bytes)

    instance = File(
        owner_id=source_file.owner_id,
        workspace_id=source_file.workspace_id,
        folder_id=source_file.folder_id,
        name=instance_name,
        mime_type=mime,
        size_bytes=len(store_bytes),
        storage_key=s_key,
        file_type="instance",
        content_text=content_text,
        is_instance=True,
        app_type_id=app_type.id,
        source_file_id=source_file.id,
        instance_config=instance_config,
        is_vibe_file=source_file.is_vibe_file,
        created_by_id=source_file.created_by_id,
        created_by_agent=source_file.created_by_agent,
    )
    db.add(instance)
    await db.flush()
    return instance


async def auto_create_instances_for_file(
    db: AsyncSession,
    storage: StorageBackend,
    file: File,
) -> list[File]:
    """Auto-create default instances for a data file (default viewer + text editor)."""
    ext = file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ""
    instances: list[File] = []

    # Determine default viewer app type
    default_slug: str | None = None
    if ext in ("csv", "tsv") or file.file_type == "spreadsheet":
        default_slug = "table"
    elif ext in ("md", "markdown", "doc", "docx") or file.file_type == "document":
        default_slug = "document"

    # Create default viewer instance
    if default_slug:
        app_type = await get_app_type_by_slug(db, default_slug, file.workspace_id)
        if app_type:
            instance = await create_instance(db, storage, file, app_type)
            instances.append(instance)

    # Create text editor instance
    editor_type = await get_app_type_by_slug(db, "text-editor", file.workspace_id)
    if editor_type:
        instance = await create_instance(db, storage, file, editor_type)
        instances.append(instance)

    return instances


async def list_drive_files(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
) -> list[File]:
    query = select(File).options(selectinload(File.app_type)).where(
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
        select(File)
        .options(selectinload(File.app_type))
        .where(
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
    result = await db.execute(
        select(File).options(selectinload(File.app_type))
        .where(File.id == file_id, File.deleted_at.is_(None))
    )
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
    # For docx files, convert binary to HTML and cache
    if is_docx_file(file.name):
        try:
            html = convert_docx_to_html(data)
            file.content_text = html
            await db.flush()
            return html
        except Exception:
            return "<p>Unable to convert this document.</p>"
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
) -> Folder:
    """Ensure the Files root folder exists. Returns files_folder.

    Also migrates any orphaned root-level files into the Files folder.
    """
    files = await get_or_create_system_folder(db, workspace_id, owner_id, "Files")

    # Migrate orphaned root files into the Files folder
    result = await db.execute(
        select(File).where(
            File.workspace_id == workspace_id,
            File.folder_id.is_(None),
            File.deleted_at.is_(None),
        )
    )
    orphans = list(result.scalars().all())
    for f in orphans:
        f.folder_id = files.id
    if orphans:
        await db.flush()

    return files


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


async def update_file_content(
    db: AsyncSession,
    storage: StorageBackend,
    file: File,
    new_content: str,
    updated_by_id: uuid.UUID | None = None,
) -> File:
    """Update a file's text content and create a new version."""
    content_bytes = new_content.encode("utf-8")
    storage_key = f"{file.workspace_id}/{uuid.uuid4()}/{file.name}"
    await storage.put(storage_key, content_bytes)

    # Get next version number
    result = await db.execute(
        select(func.coalesce(func.max(FileVersion.version_number), 0)).where(
            FileVersion.file_id == file.id
        )
    )
    max_version = result.scalar()

    file.content_text = new_content
    file.size_bytes = len(content_bytes)
    file.storage_key = storage_key

    version = FileVersion(
        file_id=file.id,
        version_number=max_version + 1,
        storage_key=storage_key,
        size_bytes=len(content_bytes),
        content_text=new_content,
        change_summary="Content updated",
        created_by_id=updated_by_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(version)
    await db.flush()

    return file


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
