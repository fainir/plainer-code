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
    """Get all instances linked to a data file (primary or related)."""
    result = await db.execute(
        select(File)
        .options(selectinload(File.app_type))
        .where(
            or_(
                File.source_file_id == file_id,
                File.related_source_ids.any(file_id),
            ),
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
    related_source_ids: list[uuid.UUID] | None = None,
) -> File:
    """Create an instance file for a data file using an app type."""
    base = source_file.name.rsplit(".", 1)[0] if "." in source_file.name else source_file.name
    if name:
        instance_name = name
    else:
        instance_name = f"{base} {app_type.label}.html"
    instance_config = config or "{}"

    # For html-template renderers, store HTML content; for built-in, store config
    html = content or (app_type.template_content if app_type.renderer == "html-template" else None)
    if app_type.renderer == "html-template" and html:
        content_text = html
        store_bytes = html.encode("utf-8")
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
        related_source_ids=related_source_ids,
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
        .options(selectinload(File.app_type))
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
        .options(selectinload(File.app_type))
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
        # Fallback for instances: return config if storage file is missing
        if file.is_instance:
            return file.instance_config or "{}"
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


async def list_instances_by_app_type(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    app_type_slug: str | None = None,
) -> list[File]:
    """List all instances in a workspace, optionally filtered by app type slug."""
    query = (
        select(File)
        .options(selectinload(File.app_type))
        .where(
            File.workspace_id == workspace_id,
            File.is_instance.is_(True),
            File.deleted_at.is_(None),
        )
    )
    if app_type_slug:
        query = query.join(AppType, File.app_type_id == AppType.id).where(
            AppType.slug == app_type_slug
        )
    return list((await db.execute(query.order_by(File.name))).scalars().all())


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


# ── Default planner content for new users ────────────────────────────────────

_PERSONAL_PLANNER_FILES = [
    {
        "name": "weekly-plan.csv",
        "content": (
            "Day,Time Block,Task,Category,Priority,Status,Notes\n"
            "Monday,06:00,Morning run + cold shower,Health,High,Done,5K route through park\n"
            "Monday,08:00,Review weekly goals and priorities,Planning,High,Done,Set top 3 MITs\n"
            "Monday,09:00,Deep work - main project,Work,High,Done,2-hour focus block\n"
            "Monday,12:00,Healthy lunch + walk,Health,Medium,Done,Meal prepped Sunday\n"
            "Monday,14:00,Client calls and emails,Work,Medium,Done,3 calls scheduled\n"
            "Monday,17:00,Online course - Module 4,Learning,Medium,Done,React Native\n"
            "Monday,19:00,Cook dinner + meal prep,Health,Medium,Done,Batch cook chicken\n"
            "Tuesday,06:00,Gym - strength training,Health,High,Done,Upper body day\n"
            "Tuesday,08:30,Team standup,Work,High,Done,Sprint sync\n"
            "Tuesday,09:00,Deep work - feature build,Work,High,In Progress,Auth integration\n"
            "Tuesday,12:00,Lunch meeting with mentor,Social,Medium,In Progress,Career advice\n"
            "Tuesday,14:00,Code review + PR feedback,Work,Medium,Todo,Review 3 PRs\n"
            "Tuesday,17:00,Read 30 pages,Learning,Low,Todo,Current: Psychology of Money\n"
            "Tuesday,19:30,Yoga class,Health,Medium,Todo,Studio downtown\n"
            "Wednesday,06:00,Morning run - intervals,Health,High,Todo,HIIT sprints\n"
            "Wednesday,09:00,Deep work - side project,Personal,High,Todo,SaaS MVP\n"
            "Wednesday,12:00,Review finances + budget,Finance,Medium,Todo,Weekly check-in\n"
            "Wednesday,14:00,Creative writing,Personal,Low,Todo,Blog post draft\n"
            "Wednesday,19:00,Dinner with friends,Social,Medium,Todo,New restaurant\n"
            "Thursday,06:00,Gym - leg day,Health,High,Todo,Squats + deadlifts\n"
            "Thursday,09:00,Deep work - main project,Work,High,Todo,Sprint deliverable\n"
            "Thursday,14:00,1:1 with manager,Work,High,Todo,Growth discussion\n"
            "Thursday,17:00,Online course - Module 5,Learning,Medium,Todo,React Native\n"
            "Thursday,19:00,Meditate + journal,Personal,Medium,Todo,30 min session\n"
            "Friday,08:00,Weekly review + retro,Planning,High,Todo,What worked this week\n"
            "Friday,09:00,Wrap up open tasks,Work,High,Todo,Close sprint items\n"
            "Friday,14:00,Side project - marketing,Personal,Medium,Todo,Landing page copy\n"
            "Friday,18:00,Date night,Social,High,Todo,Reservations at 7\n"
            "Saturday,08:00,Farmers market,Health,Low,Todo,Fresh produce\n"
            "Saturday,10:00,Side project - coding,Personal,High,Todo,3-hour block\n"
            "Saturday,14:00,Hobby - photography,Personal,Medium,Todo,Golden hour shoot\n"
            "Saturday,19:00,Game night with friends,Social,Medium,Todo,Board games\n"
            "Sunday,08:00,Long run - 10K,Health,High,Todo,Trail route\n"
            "Sunday,11:00,Meal prep for the week,Health,Medium,Todo,5 lunches + 3 dinners\n"
            "Sunday,14:00,Read + relax,Personal,Low,Todo,Finish current book\n"
            "Sunday,17:00,Plan next week,Planning,High,Todo,Set priorities for Monday\n"
            "Sunday,19:00,Journal + gratitude,Personal,Medium,Todo,Weekly reflection"
        ),
    },
    {
        "name": "habits.csv",
        "content": (
            "Habit,Category,Mon,Tue,Wed,Thu,Fri,Sat,Sun\n"
            "Wake up by 6am,Health,yes,yes,yes,yes,no,yes,yes\n"
            "Exercise 45 min,Health,yes,yes,no,yes,no,yes,yes\n"
            "Meditate 15 min,Mindfulness,yes,yes,yes,yes,yes,no,yes\n"
            "Read 30 pages,Learning,yes,yes,yes,no,yes,no,yes\n"
            "Drink 3L water,Health,yes,yes,yes,yes,no,yes,yes\n"
            "No phone first hour,Mindfulness,no,yes,yes,yes,yes,no,no\n"
            "Journal before bed,Mindfulness,yes,yes,no,yes,yes,no,yes\n"
            "Cook healthy meal,Health,yes,no,yes,no,yes,yes,yes\n"
            "8 hours sleep,Health,yes,yes,no,yes,yes,yes,yes\n"
            "Deep work 2+ hours,Productivity,yes,yes,yes,yes,yes,no,no\n"
            "No social media until noon,Productivity,no,yes,yes,yes,yes,no,no\n"
            "Gratitude practice,Mindfulness,yes,yes,yes,yes,yes,yes,yes\n"
            "Walk 10000 steps,Health,yes,no,yes,yes,no,yes,yes\n"
            "Stretch routine,Health,yes,yes,no,yes,no,yes,no\n"
            "Practice language 15min,Learning,no,yes,no,yes,no,no,yes"
        ),
    },
    {
        "name": "goals.csv",
        "content": (
            "Objective,Key Result,Progress,Owner,Quarter,Status\n"
            "Peak physical fitness,Run a half-marathon under 1:50,35,Me,Q1 2026,On Track\n"
            "Peak physical fitness,Hit 4 gym sessions per week for 12 weeks,65,Me,Q1 2026,On Track\n"
            "Peak physical fitness,Reach 15% body fat,40,Me,Q1 2026,On Track\n"
            "Peak physical fitness,Complete 30-day yoga challenge,20,Me,Q1 2026,Behind\n"
            "Financial independence,Save $10K emergency fund,72,Me,Q1 2026,On Track\n"
            "Financial independence,Max out Roth IRA contribution,50,Me,Q1 2026,On Track\n"
            "Financial independence,Reduce expenses by 15%,38,Me,Q1 2026,At Risk\n"
            "Financial independence,Generate $500/mo side income,25,Me,Q1 2026,Behind\n"
            "Career growth,Get promoted to Senior,60,Me,Q1 2026,On Track\n"
            "Career growth,Ship 3 major features,33,Me,Q1 2026,On Track\n"
            "Career growth,Give 2 tech talks,50,Me,Q1 2026,On Track\n"
            "Career growth,Mentor 1 junior developer,80,Me,Q1 2026,Ahead\n"
            "Personal growth,Read 24 books this year,25,Me,Q1 2026,On Track\n"
            "Personal growth,Launch personal SaaS project,15,Me,Q1 2026,Behind\n"
            "Personal growth,Learn Spanish to B1 level,20,Me,Q1 2026,On Track\n"
            "Personal growth,Build a writing habit - 2 posts/month,42,Me,Q1 2026,On Track"
        ),
    },
    {
        "name": "budget.csv",
        "content": (
            "Category,Item,Budgeted,Actual,Type\n"
            "Income,Salary,7500,7500,income\n"
            "Income,Freelance / Side Projects,1200,950,income\n"
            "Income,Investments / Dividends,200,180,income\n"
            "Housing,Rent / Mortgage,2100,2100,expense\n"
            "Housing,Utilities (Electric + Gas),160,145,expense\n"
            "Housing,Internet + Phone,95,95,expense\n"
            "Housing,Renters Insurance,25,25,expense\n"
            "Food,Groceries,400,430,expense\n"
            "Food,Dining Out,200,275,expense\n"
            "Food,Coffee + Snacks,50,68,expense\n"
            "Transport,Gas / EV Charging,100,85,expense\n"
            "Transport,Car Payment,350,350,expense\n"
            "Transport,Insurance,120,120,expense\n"
            "Health,Gym + Classes,80,80,expense\n"
            "Health,Supplements,40,35,expense\n"
            "Health,Health Insurance,180,180,expense\n"
            "Savings,Emergency Fund,500,500,savings\n"
            "Savings,Roth IRA,500,500,savings\n"
            "Savings,Brokerage Account,300,300,savings\n"
            "Savings,Vacation Fund,200,200,savings\n"
            "Personal,Subscriptions (Spotify + Netflix + etc),55,62,expense\n"
            "Personal,Entertainment,100,85,expense\n"
            "Personal,Clothing,100,45,expense\n"
            "Personal,Education / Courses,75,99,expense\n"
            "Personal,Gifts + Charity,100,60,expense"
        ),
    },
    {
        "name": "fitness.csv",
        "content": (
            "Date,Workout,Duration,Calories,Category,Mood,Notes\n"
            "2026-02-03,Morning Run - 5K,32,380,Cardio,Great,New personal best pace\n"
            "2026-02-04,Upper Body Strength,55,320,Strength,Good,Bench press PR: 185 lbs\n"
            "2026-02-05,Yoga Flow,45,180,Flexibility,Great,Hip opener sequence\n"
            "2026-02-06,Leg Day,50,400,Strength,Tough,Squat 5x5 at 225 lbs\n"
            "2026-02-07,Rest Day,0,0,Rest,Good,Active recovery walk\n"
            "2026-02-08,HIIT Intervals,30,350,Cardio,Great,Tabata sprints\n"
            "2026-02-09,Long Run - 10K,52,620,Cardio,Good,Trail route with hills\n"
            "2026-02-10,Push Day,50,310,Strength,Good,Shoulder press + triceps\n"
            "2026-02-11,Swimming,40,300,Cardio,Great,1500m laps\n"
            "2026-02-12,Pull Day,45,290,Strength,Good,Deadlift 3x5 at 275\n"
            "2026-02-13,Yoga + Stretch,40,150,Flexibility,Great,Recovery focus\n"
            "2026-02-14,Morning Run - 8K,42,520,Cardio,Great,Valentines run\n"
            "2026-02-15,Full Body Circuit,55,450,Strength,Tough,6 station circuit"
        ),
    },
    {
        "name": "reading-list.csv",
        "content": (
            "Title,Author,Genre,Status,Rating,Start Date,End Date,Notes\n"
            "Atomic Habits,James Clear,Self-Help,Read,5,2026-01-02,2026-01-12,Life-changing frameworks for building habits\n"
            "Deep Work,Cal Newport,Productivity,Read,5,2026-01-13,2026-01-22,Transformed my focus routine\n"
            "The Psychology of Money,Morgan Housel,Finance,Read,4,2026-01-23,2026-02-01,20 lessons on wealth and happiness\n"
            "Thinking Fast and Slow,Daniel Kahneman,Psychology,Reading,,2026-02-02,,Dense but mind-blowing\n"
            "Four Thousand Weeks,Oliver Burkeman,Philosophy,Reading,,2026-02-08,,Time management for mortals\n"
            "The Almanack of Naval Ravikant,Eric Jorgenson,Business,To Read,,,,Wealth and happiness principles\n"
            "Project Hail Mary,Andy Weir,Sci-Fi,To Read,,,,Fun read between nonfiction\n"
            "Shoe Dog,Phil Knight,Memoir,To Read,,,,Nike origin story\n"
            "The Lean Startup,Eric Ries,Business,To Read,,,,For my SaaS side project\n"
            "Sapiens,Yuval Noah Harari,History,To Read,,,,Big picture perspective\n"
            "Range,David Epstein,Science,To Read,,,,Why generalists triumph\n"
            "Never Split the Difference,Chris Voss,Business,To Read,,,,Negotiation skills"
        ),
    },
    {
        "name": "projects.csv",
        "content": (
            "Project,Status,Priority,Category,Start Date,Due Date,Progress,Next Step\n"
            "SaaS MVP - TaskFlow,In Progress,High,Software,2026-01-15,2026-04-30,25,Build authentication module\n"
            "Personal Website Redesign,In Progress,Medium,Creative,2026-02-01,2026-03-15,40,Write 3 portfolio case studies\n"
            "YouTube Channel Launch,Planning,Medium,Content,2026-03-01,2026-06-30,10,Script first 5 videos\n"
            "Spanish B1 Certification,In Progress,Medium,Learning,2026-01-01,2026-06-30,20,Complete Duolingo Unit 15\n"
            "Photography Portfolio,Todo,Low,Creative,,2026-05-30,5,Curate best 20 shots\n"
            "Investment Research System,Planning,Medium,Finance,2026-02-15,2026-04-15,15,Define stock screening criteria\n"
            "Half Marathon Training,In Progress,High,Health,2026-01-06,2026-05-18,35,Week 6 of 16-week plan\n"
            "Home Automation Setup,Todo,Low,Tech,,2026-06-30,0,Research smart home platforms\n"
            "Freelance Client Portal,Backlog,Medium,Software,,,,Design wireframes\n"
            "Write Technical Blog Series,In Progress,Medium,Content,2026-01-20,,30,Draft post #3 on system design"
        ),
    },
    {
        "name": "journal.md",
        "content": (
            "# Life Journal\n\n"
            "## February 15, 2026\n\n"
            "Great week overall. Hit a new bench press PR and stayed consistent with morning runs. "
            "The SaaS project is coming along - auth module is almost done. Need to focus more on "
            "the Spanish practice though, fell behind this week.\n\n"
            "**Wins this week:**\n"
            "- Bench press PR: 185 lbs\n"
            "- Shipped 2 PRs at work\n"
            "- Finished The Psychology of Money\n"
            "- Stayed under budget on dining out\n\n"
            "**Areas to improve:**\n"
            "- Missed 2 meditation sessions\n"
            "- Phone screen time still too high\n"
            "- Need to be more consistent with language learning\n\n"
            "---\n\n"
            "## February 8, 2026\n\n"
            "Started the week strong with a 10K trail run on Sunday. The new route through the "
            "nature reserve was amazing. Work is going well - the feature I've been building "
            "got great feedback in code review.\n\n"
            "**Reflection:** I'm happiest when I have a good balance of physical activity, deep work, "
            "and social time. This week had all three. The key is protecting those morning hours "
            "for exercise and deep work before the day gets chaotic.\n\n"
            "**Goals check-in:**\n"
            "- Fitness: On track. Half marathon training going well\n"
            "- Finance: Saved $1,500 this month. Emergency fund growing\n"
            "- Career: Promotion conversation went well. Q1 deliverables on track\n"
            "- Personal: Need to dedicate more time to the SaaS project\n"
        ),
    },
    {
        "name": "notes.md",
        "content": (
            "# Personal Planner\n\n"
            "Your complete life management system. Every file has multiple views — "
            "click the view files to see your data visualized differently.\n\n"
            "## What's Inside\n\n"
            "| File | Best Views | Purpose |\n"
            "|------|-----------|--------|\n"
            "| **weekly-plan.csv** | Board, Calendar | Time-blocked weekly schedule |\n"
            "| **habits.csv** | Habit Tracker, Heatmap | Daily habit tracking with streaks |\n"
            "| **goals.csv** | OKR Tracker, Bar Chart | Quarterly goals with progress |\n"
            "| **budget.csv** | Pie Chart, Line Chart | Income, expenses, and savings |\n"
            "| **fitness.csv** | Bar Chart, Line Chart | Workout log and progress |\n"
            "| **reading-list.csv** | Gallery, Table | Books you're reading and want to read |\n"
            "| **projects.csv** | Board, Gantt, Timeline | Side projects and personal goals |\n"
            "| **journal.md** | Document | Weekly reflections and wins |\n\n"
            "## Weekly Review Checklist\n\n"
            "- [ ] Review and update weekly plan for next week\n"
            "- [ ] Log all habits for the week\n"
            "- [ ] Update goal progress percentages\n"
            "- [ ] Check budget vs. actual spending\n"
            "- [ ] Log workouts and fitness progress\n"
            "- [ ] Write weekly journal entry\n"
            "- [ ] Review project next steps\n\n"
            "## Tips\n\n"
            "- Use the **Board** view on weekly-plan to drag tasks between statuses\n"
            "- Use the **Calendar** view to see your week at a glance\n"
            "- Ask the **AI assistant** to create custom dashboards for any file\n"
            "- Every view is editable — click **Edit HTML** to customize any view\n"
        ),
    },
]

_COMPANY_PLANNER_FILES = [
    {
        "name": "project-board.csv",
        "content": (
            "Task,Status,Priority,Assignee,Points,Sprint,Category,Due Date\n"
            "Define product vision and strategy,Done,High,Sarah Chen,13,Sprint 1,Strategy,2026-01-10\n"
            "Set up monorepo and CI/CD pipeline,Done,High,Marcus Johnson,8,Sprint 1,Engineering,2026-01-12\n"
            "Design system and component library,Done,High,Lisa Park,8,Sprint 1,Design,2026-01-17\n"
            "User authentication + OAuth,Done,High,David Kim,8,Sprint 1,Engineering,2026-01-20\n"
            "Core data models + API scaffolding,Done,High,Marcus Johnson,13,Sprint 1,Engineering,2026-01-22\n"
            "Landing page and marketing site,Done,Medium,Emily Rodriguez,5,Sprint 1,Engineering,2026-01-24\n"
            "Real-time collaboration engine,In Progress,High,Marcus Johnson,13,Sprint 2,Engineering,2026-02-07\n"
            "Dashboard + workspace UI,In Progress,High,Emily Rodriguez,8,Sprint 2,Engineering,2026-02-07\n"
            "File upload + storage system,In Progress,High,David Kim,8,Sprint 2,Engineering,2026-02-05\n"
            "User onboarding flow,In Progress,Medium,Lisa Park,5,Sprint 2,Design,2026-02-07\n"
            "API documentation + SDK,In Progress,Medium,David Kim,5,Sprint 2,Documentation,2026-02-10\n"
            "E2E test suite,In Progress,High,James Wright,8,Sprint 2,Quality,2026-02-10\n"
            "Content marketing strategy,In Progress,Medium,Nina Patel,3,Sprint 2,Marketing,2026-02-07\n"
            "Notification system,Todo,High,David Kim,8,Sprint 3,Engineering,2026-02-21\n"
            "Role-based access control,Todo,High,Marcus Johnson,8,Sprint 3,Engineering,2026-02-21\n"
            "Mobile-responsive redesign,Todo,Medium,Lisa Park,5,Sprint 3,Design,2026-02-18\n"
            "Performance profiling + optimization,Todo,High,Marcus Johnson,5,Sprint 3,Engineering,2026-02-25\n"
            "Beta user interview program,Todo,High,Sarah Chen,5,Sprint 3,Research,2026-02-20\n"
            "SEO + analytics integration,Todo,Medium,Alex Thompson,3,Sprint 3,Marketing,2026-02-25\n"
            "Security audit + pen test,Todo,High,James Wright,8,Sprint 3,Security,2026-02-28\n"
            "Plugin / extension API,Backlog,Medium,Marcus Johnson,13,,Engineering,\n"
            "Advanced analytics dashboard,Backlog,Medium,Emily Rodriguez,8,,Engineering,\n"
            "AI-powered features,Backlog,High,David Kim,13,,Engineering,\n"
            "Customer feedback widget,Backlog,Low,Sarah Chen,3,,Product,\n"
            "White-label enterprise option,Backlog,Low,Marcus Johnson,13,,Engineering,"
        ),
    },
    {
        "name": "team.csv",
        "content": (
            "Name,Role,Department,Email,Status,Start Date,Location,Skills\n"
            "Sarah Chen,CEO / Product Lead,Product,sarah@acme.co,Active,2023-06-01,New York,Strategy / Product / Analytics / Fundraising\n"
            "Marcus Johnson,CTO / Tech Lead,Engineering,marcus@acme.co,Active,2023-06-01,San Francisco,Architecture / Python / React / DevOps\n"
            "Emily Rodriguez,Senior Frontend,Engineering,emily@acme.co,Active,2023-09-10,San Francisco,React / TypeScript / CSS / Animation\n"
            "David Kim,Senior Backend,Engineering,david@acme.co,Active,2024-01-08,Remote,Python / PostgreSQL / Redis / APIs\n"
            "Lisa Park,Head of Design,Design,lisa@acme.co,Active,2023-11-20,New York,Figma / UI/UX / Design Systems / Brand\n"
            "James Wright,QA Lead,Quality,james@acme.co,Active,2024-02-01,Remote,Testing / Automation / CI/CD / Security\n"
            "Nina Patel,Content Lead,Marketing,nina@acme.co,Active,2024-03-15,Remote,Copywriting / SEO / Documentation / Social\n"
            "Alex Thompson,Head of Growth,Marketing,alex@acme.co,Active,2023-08-01,San Francisco,Growth / Paid Ads / Analytics / Partnerships\n"
            "Raj Krishnan,Mobile Engineer,Engineering,raj@acme.co,Active,2024-06-01,Remote,React Native / iOS / Android / Flutter\n"
            "Sophie Laurent,Data Analyst,Product,sophie@acme.co,Active,2024-08-15,New York,SQL / Python / Tableau / Metrics\n"
            "Tom Baker,DevOps Engineer,Engineering,tom@acme.co,Active,2024-09-01,Remote,AWS / Kubernetes / Terraform / Monitoring\n"
            "Maria Gonzalez,Customer Success,Operations,maria@acme.co,Active,2024-10-01,Remote,Support / Onboarding / Retention / CRM"
        ),
    },
    {
        "name": "okrs.csv",
        "content": (
            "Objective,Key Result,Progress,Owner,Quarter,Status\n"
            "Ship production-ready v1.0,All P0 features complete and stable,70,Sarah Chen,Q1 2026,On Track\n"
            "Ship production-ready v1.0,Pass security audit with 0 critical issues,45,James Wright,Q1 2026,On Track\n"
            "Ship production-ready v1.0,Achieve 99.9% uptime SLA,85,Tom Baker,Q1 2026,Ahead\n"
            "Ship production-ready v1.0,Load test: support 10K concurrent users,30,Marcus Johnson,Q1 2026,Behind\n"
            "Acquire 1000 beta users,Launch referral program with 20% conversion,35,Alex Thompson,Q1 2026,On Track\n"
            "Acquire 1000 beta users,Publish 15 high-quality content pieces,55,Nina Patel,Q1 2026,On Track\n"
            "Acquire 1000 beta users,Achieve 40% activation rate (signup → value),28,Sarah Chen,Q1 2026,At Risk\n"
            "Acquire 1000 beta users,Reach 500 waitlist signups from organic,60,Alex Thompson,Q1 2026,On Track\n"
            "Build world-class engineering culture,Ship features within 2-day cycle time,65,Marcus Johnson,Q1 2026,On Track\n"
            "Build world-class engineering culture,95%+ test coverage on core modules,72,James Wright,Q1 2026,On Track\n"
            "Build world-class engineering culture,100% of API endpoints documented,50,David Kim,Q1 2026,Behind\n"
            "Build world-class engineering culture,Zero-downtime deployment pipeline,90,Tom Baker,Q1 2026,Ahead\n"
            "Delight every user,Achieve NPS score of 50+,42,Maria Gonzalez,Q1 2026,On Track\n"
            "Delight every user,Median support response time under 2 hours,75,Maria Gonzalez,Q1 2026,On Track\n"
            "Delight every user,Ship 3 most-requested features from feedback,33,Sarah Chen,Q1 2026,On Track\n"
            "Delight every user,95% customer satisfaction on onboarding,80,Maria Gonzalez,Q1 2026,Ahead"
        ),
    },
    {
        "name": "roadmap.csv",
        "content": (
            "Feature,Quarter,Status,Priority,Team,Start Date,End Date,Description\n"
            "User Authentication + OAuth,Q1 2026,Shipped,P0,Engineering,2026-01-06,2026-01-20,Email/password + Google/GitHub OAuth\n"
            "Core Workspace + Dashboard,Q1 2026,Shipped,P0,Engineering,2026-01-13,2026-01-31,Main app layout with file management\n"
            "Design System v1,Q1 2026,Shipped,P0,Design,2026-01-06,2026-01-24,Component library + brand guidelines\n"
            "Real-time Collaboration,Q1 2026,In Progress,P0,Engineering,2026-01-27,2026-02-14,Live cursors + multiplayer editing\n"
            "File Management + Storage,Q1 2026,In Progress,P0,Engineering,2026-01-27,2026-02-07,Upload / organize / version files\n"
            "API v1 + Documentation,Q1 2026,In Progress,P1,Engineering,2026-02-03,2026-02-21,Public REST API + SDK\n"
            "Onboarding + Activation,Q1 2026,In Progress,P1,Design,2026-02-03,2026-02-14,Interactive tutorial + templates\n"
            "Notification System,Q1 2026,Planned,P1,Engineering,2026-02-17,2026-02-28,Email + in-app + push\n"
            "RBAC + Team Permissions,Q1 2026,Planned,P0,Engineering,2026-02-17,2026-03-07,Role-based access control\n"
            "Mobile App (iOS + Android),Q2 2026,Planned,P1,Engineering,2026-04-01,2026-06-30,React Native cross-platform\n"
            "Advanced Analytics,Q2 2026,Planned,P1,Product,2026-04-01,2026-05-31,Usage metrics + custom reports\n"
            "Plugin Marketplace,Q2 2026,Planned,P2,Engineering,2026-05-01,2026-06-30,Third-party extensions\n"
            "Enterprise SSO (SAML/OIDC),Q3 2026,Planned,P1,Engineering,2026-07-01,2026-08-15,SAML + OIDC federation\n"
            "AI Assistant v2,Q3 2026,Planned,P1,Engineering,2026-07-01,2026-09-30,Smart suggestions + automation\n"
            "White-label + Custom Branding,Q4 2026,Planned,P2,Product,2026-10-01,2026-12-15,Enterprise customization\n"
            "Offline Mode + Sync,Q4 2026,Planned,P2,Engineering,2026-10-01,2026-12-31,Work offline with auto-sync"
        ),
    },
    {
        "name": "kpis.csv",
        "content": (
            "Metric,Current,Target,Previous,Unit,Category,Trend\n"
            "Monthly Active Users,847,1000,620,,Growth,Up\n"
            "Weekly Signups,95,150,72,,Growth,Up\n"
            "Daily Active Users,285,400,210,,Growth,Up\n"
            "Activation Rate (D7),34,45,28,%,Product,Up\n"
            "Session Duration,5.8,7,4.9,min,Product,Up\n"
            "Feature Adoption Rate,42,60,35,%,Product,Up\n"
            "NPS Score,48,55,38,,Satisfaction,Up\n"
            "Customer Satisfaction,92,95,88,%,Satisfaction,Up\n"
            "Support Response Time,1.8,1,2.5,hours,Satisfaction,Down\n"
            "Bug Backlog,18,10,28,,Quality,Down\n"
            "Test Coverage,78,95,68,%,Quality,Up\n"
            "Deploy Frequency,4,7,2,/week,Engineering,Up\n"
            "Cycle Time,3.2,2,4.5,days,Engineering,Down\n"
            "Revenue MRR,4200,10000,2800,$,Revenue,Up\n"
            "Annual Run Rate,50400,120000,33600,$,Revenue,Up\n"
            "Customer Acquisition Cost,28,20,42,$,Revenue,Down\n"
            "Lifetime Value,340,500,280,$,Revenue,Up\n"
            "Burn Rate,85000,75000,92000,$/mo,Finance,Down\n"
            "Runway,14,18,11,months,Finance,Up"
        ),
    },
    {
        "name": "clients.csv",
        "content": (
            "Company,Contact,Email,Status,Deal Size,Stage,Source,Last Contact,Notes\n"
            "TechCorp Inc,John Miller,john@techcorp.com,Active,$2400/yr,Customer,Inbound,2026-02-12,Enterprise plan - 25 seats\n"
            "StartupXYZ,Amy Lee,amy@startupxyz.com,Active,$960/yr,Customer,Referral,2026-02-10,Team plan - growing fast\n"
            "DesignHub,Carlos Ruiz,carlos@designhub.io,Active,$480/yr,Customer,Content,2026-02-08,Pro plan - design agency\n"
            "CloudNine Labs,Priya Sharma,priya@cloudnine.dev,Trial,,$Trial,ProductHunt,2026-02-14,14-day trial started\n"
            "GrowthMetrics,Sam Wilson,sam@growthmetrics.co,Trial,,$Trial,Organic,2026-02-13,Interested in analytics features\n"
            "DataFlow Systems,Rachel Green,rachel@dataflow.io,Prospect,$4800/yr,Negotiation,LinkedIn,2026-02-11,Enterprise - 50 seats - demo scheduled\n"
            "InnovateCo,Mike Chen,mike@innovateco.com,Prospect,$1200/yr,Proposal,Conference,2026-02-09,Sent pricing proposal\n"
            "MediaPulse,Laura Kim,laura@mediapulse.com,Prospect,$960/yr,Qualification,Inbound,2026-02-07,Needs custom integrations\n"
            "QuantumAI,David Park,david@quantumai.co,Lead,,$Discovery,Referral,2026-02-06,AI startup - interested in API\n"
            "RetailPlus,Emma Davis,emma@retailplus.com,Lead,,$Discovery,Webinar,2026-02-05,E-commerce company - 100 employees\n"
            "FinanceFirst,Robert Lee,robert@financefirst.com,Lost,$2400/yr,Closed Lost,Outbound,2026-01-28,Chose competitor - price sensitive\n"
            "AgriTech Global,Nina Patel,nina@agritech.io,Won,$1200/yr,Closed Won,Partner,2026-01-30,Annual plan signed"
        ),
    },
    {
        "name": "budget.csv",
        "content": (
            "Category,Item,Q1 Budget,Q1 Actual,Q2 Budget,Status\n"
            "Revenue,Product Subscriptions,18000,14200,35000,Behind\n"
            "Revenue,Professional Services,8000,9500,12000,Ahead\n"
            "Revenue,Enterprise Deals,5000,2400,15000,Behind\n"
            "People,Engineering Salaries,72000,72000,78000,On Budget\n"
            "People,Design + Product Salaries,36000,36000,36000,On Budget\n"
            "People,Sales + Marketing Salaries,24000,24000,28000,On Budget\n"
            "People,Operations + Support,12000,12000,15000,On Budget\n"
            "People,Benefits + Insurance,14400,14400,15700,On Budget\n"
            "People,Contractors + Freelance,9000,6800,12000,Under\n"
            "Infrastructure,AWS / Cloud Hosting,3600,3200,4500,Under\n"
            "Infrastructure,SaaS Tools,2400,2800,2400,Over\n"
            "Infrastructure,Monitoring + Security,1200,1000,1500,Under\n"
            "Marketing,Paid Acquisition,4500,2800,8000,Under\n"
            "Marketing,Content + SEO,2000,1500,3000,Under\n"
            "Marketing,Events + Conferences,3000,1200,5000,Under\n"
            "Office,Coworking Spaces,2400,2400,2400,On Budget\n"
            "Office,Equipment + Hardware,3000,4200,1500,Over\n"
            "Legal,Legal + Accounting,2500,2500,2500,On Budget\n"
            "Legal,Insurance,1800,1800,1800,On Budget"
        ),
    },
    {
        "name": "retrospective.csv",
        "content": (
            "Item,Type,Sprint,Votes,Owner,Status\n"
            "Shipped auth flow 2 days early,What Went Well,Sprint 1,5,Marcus Johnson,Celebrated\n"
            "Design-engineering collaboration excellent,What Went Well,Sprint 1,4,Lisa Park,Celebrated\n"
            "Zero production incidents,What Went Well,Sprint 1,6,Tom Baker,Celebrated\n"
            "Standups running over 15 minutes,To Improve,Sprint 1,4,Sarah Chen,In Progress\n"
            "Ticket descriptions lack acceptance criteria,To Improve,Sprint 1,5,Sarah Chen,Done\n"
            "Too many meetings breaking focus time,To Improve,Sprint 1,6,Marcus Johnson,In Progress\n"
            "Timebox standups to 10 minutes,Action Item,Sprint 1,0,Sarah Chen,Done\n"
            "Add acceptance criteria template to tickets,Action Item,Sprint 1,0,Sarah Chen,Done\n"
            "Block 2-hour focus time on calendars,Action Item,Sprint 1,0,Marcus Johnson,In Progress\n"
            "CI/CD pipeline saves 3 hours per deploy,What Went Well,Sprint 2,5,Tom Baker,Celebrated\n"
            "Landing page got great user feedback,What Went Well,Sprint 2,4,Emily Rodriguez,Celebrated\n"
            "Great async communication this sprint,What Went Well,Sprint 2,3,Nina Patel,Celebrated\n"
            "Code review turnaround too slow (2+ days),To Improve,Sprint 2,5,Marcus Johnson,Todo\n"
            "Need better monitoring for API errors,To Improve,Sprint 2,4,David Kim,Todo\n"
            "Onboarding docs are outdated,To Improve,Sprint 2,3,Nina Patel,Todo\n"
            "Set 24h SLA for code reviews,Action Item,Sprint 2,0,Marcus Johnson,Todo\n"
            "Set up error alerting in PagerDuty,Action Item,Sprint 2,0,Tom Baker,Todo\n"
            "Schedule docs update sprint,Action Item,Sprint 2,0,Nina Patel,Todo"
        ),
    },
    {
        "name": "meeting-notes.md",
        "content": (
            "# Team Meeting Notes\n\n"
            "## All-Hands - Feb 14, 2026\n\n"
            "**Attendees:** Full team (12 people)\n\n"
            "### Company Update\n"
            "- **MRR:** $4,200 (+50% MoM)\n"
            "- **Users:** 847 MAU, 95 signups this week\n"
            "- **Runway:** 14 months at current burn\n\n"
            "### Sprint 2 Review\n"
            "- Real-time collaboration engine: 80% complete\n"
            "- File management: shipped to staging\n"
            "- E2E test suite: 65% coverage and growing\n"
            "- Content: 8 of 15 pieces published\n\n"
            "### Sprint 3 Planning\n"
            "- Focus: notifications, RBAC, performance\n"
            "- Beta launch target: March 7\n"
            "- Security audit scheduled: Feb 28\n\n"
            "### Decisions\n"
            "- Hire 2 more engineers in Q2\n"
            "- Launch referral program Feb 21\n"
            "- Enterprise pilot with DataFlow Systems\n\n"
            "---\n\n"
            "## Weekly Standup - Feb 10, 2026\n\n"
            "**Attendees:** Sarah, Marcus, Emily, David, Lisa, James, Tom\n\n"
            "### Updates\n"
            "- **Marcus**: Collab engine - CRDT implementation working, testing edge cases\n"
            "- **Emily**: Dashboard UI complete, starting workspace settings\n"
            "- **David**: File storage API done, starting notification service\n"
            "- **Lisa**: Onboarding screens in review, mobile wireframes started\n"
            "- **James**: E2E framework solid, writing auth + file test suites\n"
            "- **Tom**: Deployed staging environment, monitoring dashboards live\n\n"
            "### Blockers\n"
            "- Need design review for notification preferences UI\n"
            "- AWS S3 permissions issue — Tom investigating\n\n"
            "### Action Items\n"
            "- [ ] Lisa: Notification preferences mockup by Wednesday\n"
            "- [ ] Tom: Resolve S3 permissions, document setup\n"
            "- [ ] Sarah: Schedule DataFlow Systems demo for next week\n"
            "- [ ] Marcus: Document collaboration protocol for the team\n"
        ),
    },
    {
        "name": "notes.md",
        "content": (
            "# Company Planner\n\n"
            "Everything your team needs to build, ship, and grow — all in one place.\n\n"
            "## What's Inside\n\n"
            "| File | Best Views | Purpose |\n"
            "|------|-----------|--------|\n"
            "| **project-board.csv** | Sprint Board, Board, Gantt | Sprint tasks and backlog |\n"
            "| **team.csv** | Gallery, Table | Team directory with skills |\n"
            "| **okrs.csv** | OKR Tracker, Bar Chart | Quarterly objectives and key results |\n"
            "| **roadmap.csv** | Roadmap, Timeline, Gantt | Product roadmap by quarter |\n"
            "| **kpis.csv** | KPI Dashboard, Line Chart | Key metrics and trends |\n"
            "| **clients.csv** | CRM Pipeline, Table | Sales pipeline and customer tracking |\n"
            "| **budget.csv** | Pie Chart, Line Chart, Summary | Revenue, costs, and runway |\n"
            "| **retrospective.csv** | Retro Board, Table | Sprint retrospectives |\n"
            "| **meeting-notes.md** | Document | Team meetings and decisions |\n\n"
            "## Weekly Rituals\n\n"
            "- **Monday**: Sprint standup, review sprint board\n"
            "- **Wednesday**: OKR check-in, update progress %\n"
            "- **Friday**: Sprint review, update KPIs\n"
            "- **Bi-weekly**: Sprint retrospective\n"
            "- **Monthly**: All-hands, roadmap review, budget review\n\n"
            "## Tips\n\n"
            "- Use **Sprint Board** view on project-board for daily standups\n"
            "- Use **CRM Pipeline** view on clients to track your sales funnel\n"
            "- Use **KPI Dashboard** to present metrics in meetings\n"
            "- Ask the **AI assistant** to create custom dashboards for any data\n"
            "- Every view is editable — click **Edit HTML** to customize\n"
        ),
    },
]




# Extra views to create beyond the default (Table/Document + Text Editor).
_PERSONAL_EXTRA_VIEWS: dict[str, list[str]] = {
    "weekly-plan.csv": ["board", "calendar"],
    "habits.csv": ["app-habit-tracker"],
    "goals.csv": ["app-okr-tracker"],
    "budget.csv": ["app-comparison"],
    "fitness.csv": ["calendar", "app-line-chart"],
    "reading-list.csv": ["board"],
    "projects.csv": ["board"],
}

_COMPANY_EXTRA_VIEWS: dict[str, list[str]] = {
    "project-board.csv": ["board", "app-sprint-board"],
    "team.csv": ["app-form-view"],
    "okrs.csv": ["app-okr-tracker"],
    "roadmap.csv": ["app-roadmap"],
    "kpis.csv": ["app-kpi-dashboard", "app-line-chart"],
    "clients.csv": ["app-crm"],
    "budget.csv": ["app-line-chart"],
    "retrospective.csv": ["app-retro-board"],
}


# ── Custom HTML dashboards ────────────────────────────────

_PERSONAL_DASHBOARD_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%);padding:24px;color:#1e293b}h1{font-size:22px;font-weight:700;margin-bottom:4px}.subtitle{font-size:13px;color:#64748b;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px}.card{background:white;border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #e2e8f0}.card h3{font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:12px;font-weight:600}.stat{font-size:32px;font-weight:700;line-height:1}.stat-sm{font-size:14px;color:#64748b;margin-top:4px}.bar-wrap{margin-top:12px}.bar-label{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}.bar-label span:last-child{color:#64748b}.bar{height:8px;background:#f1f5f9;border-radius:99px;overflow:hidden}.bar-fill{height:100%;border-radius:99px;transition:width 0.5s}.accent-blue{color:#3b82f6}.accent-green{color:#22c55e}.accent-purple{color:#8b5cf6}.accent-orange{color:#f59e0b}.accent-red{color:#ef4444}.fill-blue{background:linear-gradient(90deg,#3b82f6,#60a5fa)}.fill-green{background:linear-gradient(90deg,#22c55e,#4ade80)}.fill-purple{background:linear-gradient(90deg,#8b5cf6,#a78bfa)}.fill-orange{background:linear-gradient(90deg,#f59e0b,#fbbf24)}.habits-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:12px}.habit-cell{width:100%;aspect-ratio:1;border-radius:4px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:600}.h-done{background:#dcfce7;color:#16a34a}.h-miss{background:#fef2f2;color:#ef4444}.h-head{background:transparent;color:#94a3b8;font-size:10px}.tag{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500;margin:2px}.tag-green{background:#dcfce7;color:#16a34a}.tag-blue{background:#dbeafe;color:#2563eb}.tag-yellow{background:#fef3c7;color:#d97706}.tag-red{background:#fef2f2;color:#ef4444}.wide{grid-column:span 2}@media(max-width:640px){.wide{grid-column:span 1}}</style></head><body><h1>Life Dashboard</h1><p class="subtitle">Personal goals, habits, fitness & finance at a glance</p><div class="grid"><div class="card"><h3>Fitness This Week</h3><div class="stat accent-blue">6 <span style="font-size:16px;font-weight:400">workouts</span></div><div class="stat-sm">32.4 hrs total · 3,390 cal burned</div><div class="bar-wrap"><div class="bar-label"><span>Weekly target</span><span>6/7 days</span></div><div class="bar"><div class="bar-fill fill-blue" style="width:86%"></div></div></div></div><div class="card"><h3>Financial Health</h3><div class="stat accent-green">$1,500</div><div class="stat-sm">Saved this month</div><div class="bar-wrap"><div class="bar-label"><span>Emergency fund</span><span>$7,200 / $10,000</span></div><div class="bar"><div class="bar-fill fill-green" style="width:72%"></div></div></div><div class="bar-wrap"><div class="bar-label"><span>Roth IRA</span><span>$3,000 / $6,000</span></div><div class="bar"><div class="bar-fill fill-green" style="width:50%"></div></div></div></div><div class="card"><h3>Reading Progress</h3><div class="stat accent-purple">5 <span style="font-size:16px;font-weight:400">of 24 books</span></div><div class="stat-sm">Currently reading 2 books</div><div class="bar-wrap"><div class="bar-label"><span>Annual goal</span><span>21%</span></div><div class="bar"><div class="bar-fill fill-purple" style="width:21%"></div></div></div><div style="margin-top:8px;font-size:12px;color:#64748b">📖 Thinking Fast and Slow · Four Thousand Weeks</div></div><div class="card"><h3>Key Goals (Q1 2026)</h3><div class="bar-wrap"><div class="bar-label"><span>🏃 Peak fitness</span><span>40%</span></div><div class="bar"><div class="bar-fill fill-blue" style="width:40%"></div></div></div><div class="bar-wrap"><div class="bar-label"><span>💰 Financial independence</span><span>46%</span></div><div class="bar"><div class="bar-fill fill-green" style="width:46%"></div></div></div><div class="bar-wrap"><div class="bar-label"><span>🚀 Career growth</span><span>56%</span></div><div class="bar"><div class="bar-fill fill-orange" style="width:56%"></div></div></div><div class="bar-wrap"><div class="bar-label"><span>🌱 Personal growth</span><span>26%</span></div><div class="bar"><div class="bar-fill fill-purple" style="width:26%"></div></div></div></div><div class="card wide"><h3>Habit Tracker — This Week</h3><div class="habits-grid"><div class="h-head">Habit</div><div class="h-head">M</div><div class="h-head">T</div><div class="h-head">W</div><div class="h-head">T</div><div class="h-head">F</div><div class="h-head">S/S</div><div style="font-size:11px;color:#334155">Wake 6am</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-miss">✗</div><div class="habit-cell h-done">✓</div><div style="font-size:11px;color:#334155">Exercise</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-miss">✗</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-miss">✗</div><div class="habit-cell h-done">✓</div><div style="font-size:11px;color:#334155">Meditate</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-miss">✗</div><div style="font-size:11px;color:#334155">Read 30p</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-miss">✗</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-miss">✗</div><div style="font-size:11px;color:#334155">Deep work</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-done">✓</div><div class="habit-cell h-miss">✗</div></div></div><div class="card"><h3>Projects</h3><div style="margin-bottom:8px"><div style="font-size:13px;font-weight:600">SaaS MVP - TaskFlow</div><div class="bar" style="margin-top:4px"><div class="bar-fill fill-blue" style="width:25%"></div></div><div style="font-size:11px;color:#64748b;margin-top:2px">25% · Due Apr 30</div></div><div style="margin-bottom:8px"><div style="font-size:13px;font-weight:600">Personal Website</div><div class="bar" style="margin-top:4px"><div class="bar-fill fill-purple" style="width:40%"></div></div><div style="font-size:11px;color:#64748b;margin-top:2px">40% · Due Mar 15</div></div><div><div style="font-size:13px;font-weight:600">Half Marathon</div><div class="bar" style="margin-top:4px"><div class="bar-fill fill-green" style="width:35%"></div></div><div style="font-size:11px;color:#64748b;margin-top:2px">35% · Week 6 of 16</div></div></div><div class="card"><h3>Weekly Schedule</h3><div style="font-size:12px;line-height:2"><span class="tag tag-blue">5 deep work</span> <span class="tag tag-green">6 workouts</span> <span class="tag tag-yellow">2 learning</span> <span class="tag tag-red">3 social</span></div><div style="margin-top:8px;font-size:11px;color:#64748b">Mon–Fri: 6am starts · 2hr focus blocks<br>Sat: Side project + photography<br>Sun: Long run + meal prep + plan week</div></div></div></body></html>'''

_COMPANY_DASHBOARD_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%);padding:24px;color:#1e293b}h1{font-size:22px;font-weight:700;margin-bottom:4px}.subtitle{font-size:13px;color:#64748b;margin-bottom:24px}.kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px}.kpi{background:white;border-radius:14px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #e2e8f0;text-align:center}.kpi .label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600}.kpi .value{font-size:28px;font-weight:700;margin:4px 0}.kpi .delta{font-size:12px;font-weight:500}.up{color:#16a34a}.down{color:#ef4444}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:20px}.card{background:white;border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #e2e8f0}.card h3{font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:14px;font-weight:600}.bar-wrap{margin-bottom:10px}.bar-label{display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px}.bar{height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden}.bar-fill{height:100%;border-radius:99px}.fill-blue{background:linear-gradient(90deg,#3b82f6,#60a5fa)}.fill-green{background:linear-gradient(90deg,#22c55e,#4ade80)}.fill-purple{background:linear-gradient(90deg,#8b5cf6,#a78bfa)}.fill-orange{background:linear-gradient(90deg,#f59e0b,#fbbf24)}.fill-red{background:linear-gradient(90deg,#ef4444,#f87171)}.pipeline{display:flex;gap:8px;margin-top:8px}.pipe-stage{flex:1;text-align:center;padding:10px 4px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}.pipe-stage .count{font-size:20px;font-weight:700;color:#1e293b}.pipe-stage .name{font-size:10px;color:#64748b;margin-top:2px}.team-row{display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #f8fafc}.team-row:last-child{border:none}.avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:white;margin-right:10px;flex-shrink:0}.team-name{font-size:13px;font-weight:500;flex:1}.team-role{font-size:11px;color:#94a3b8}.sprint-item{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px}.sprint-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}.dot-done{background:#22c55e}.dot-progress{background:#3b82f6}.dot-todo{background:#94a3b8}.chart-bar{display:flex;align-items:end;gap:6px;height:120px;margin-top:12px;padding-top:8px}.col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}.col-bar{width:100%;border-radius:6px 6px 0 0;min-height:4px}.col-label{font-size:10px;color:#94a3b8}.col-value{font-size:10px;font-weight:600;color:#334155}.wide{grid-column:span 2}@media(max-width:700px){.wide{grid-column:span 1}}</style></head><body><h1>Company Dashboard</h1><p class="subtitle">Acme Inc · Q1 2026 Overview</p><div class="kpi-row"><div class="kpi"><div class="label">MRR</div><div class="value" style="color:#2563eb">$4,200</div><div class="delta up">↑ 50% MoM</div></div><div class="kpi"><div class="label">Active Users</div><div class="value" style="color:#7c3aed">847</div><div class="delta up">↑ 37% MoM</div></div><div class="kpi"><div class="label">NPS Score</div><div class="value" style="color:#16a34a">48</div><div class="delta up">↑ 10 pts</div></div><div class="kpi"><div class="label">Weekly Signups</div><div class="value" style="color:#ea580c">95</div><div class="delta up">↑ 32%</div></div><div class="kpi"><div class="label">Runway</div><div class="value" style="color:#0891b2">14mo</div><div class="delta up">↑ 3mo</div></div></div><div class="grid"><div class="card"><h3>Sprint 2 Progress</h3><div class="sprint-item"><span class="sprint-dot dot-done"></span><span style="flex:1">Real-time collab engine</span><span style="font-size:12px;color:#64748b">80%</span></div><div class="sprint-item"><span class="sprint-dot dot-progress"></span><span style="flex:1">Dashboard + workspace UI</span><span style="font-size:12px;color:#64748b">60%</span></div><div class="sprint-item"><span class="sprint-dot dot-progress"></span><span style="flex:1">File upload + storage</span><span style="font-size:12px;color:#64748b">75%</span></div><div class="sprint-item"><span class="sprint-dot dot-progress"></span><span style="flex:1">E2E test suite</span><span style="font-size:12px;color:#64748b">40%</span></div><div class="sprint-item"><span class="sprint-dot dot-progress"></span><span style="flex:1">User onboarding flow</span><span style="font-size:12px;color:#64748b">55%</span></div><div class="sprint-item"><span class="sprint-dot dot-todo"></span><span style="flex:1">API docs + SDK</span><span style="font-size:12px;color:#64748b">30%</span></div><div style="margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;font-size:12px;color:#64748b"><span>7 tasks in progress</span><span style="font-weight:600;color:#2563eb">Sprint ends Feb 14</span></div></div><div class="card"><h3>Sales Pipeline</h3><div class="pipeline"><div class="pipe-stage"><div class="count" style="color:#94a3b8">2</div><div class="name">Leads</div></div><div class="pipe-stage"><div class="count" style="color:#f59e0b">3</div><div class="name">Prospects</div></div><div class="pipe-stage"><div class="count" style="color:#3b82f6">2</div><div class="name">Trials</div></div><div class="pipe-stage"><div class="count" style="color:#22c55e">4</div><div class="name">Customers</div></div></div><div style="margin-top:14px;font-size:12px"><div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f8fafc"><span style="font-weight:500">DataFlow Systems</span><span style="color:#2563eb;font-weight:600">$4,800/yr</span></div><div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f8fafc"><span style="font-weight:500">TechCorp Inc</span><span style="color:#22c55e;font-weight:600">$2,400/yr</span></div><div style="display:flex;justify-content:space-between;padding:4px 0"><span style="font-weight:500">InnovateCo</span><span style="color:#f59e0b;font-weight:600">$1,200/yr</span></div></div></div><div class="card"><h3>OKR Progress · Q1 2026</h3><div class="bar-wrap"><div class="bar-label"><span>Ship v1.0</span><span>58%</span></div><div class="bar"><div class="bar-fill fill-blue" style="width:58%"></div></div></div><div class="bar-wrap"><div class="bar-label"><span>1000 beta users</span><span>45%</span></div><div class="bar"><div class="bar-fill fill-purple" style="width:45%"></div></div></div><div class="bar-wrap"><div class="bar-label"><span>Engineering culture</span><span>69%</span></div><div class="bar"><div class="bar-fill fill-green" style="width:69%"></div></div></div><div class="bar-wrap"><div class="bar-label"><span>Delight every user</span><span>58%</span></div><div class="bar"><div class="bar-fill fill-orange" style="width:58%"></div></div></div></div><div class="card"><h3>Revenue Growth</h3><div class="chart-bar"><div class="col"><div class="col-bar fill-blue" style="height:15%"></div><div class="col-value">$0.8K</div><div class="col-label">Sep</div></div><div class="col"><div class="col-bar fill-blue" style="height:22%"></div><div class="col-value">$1.2K</div><div class="col-label">Oct</div></div><div class="col"><div class="col-bar fill-blue" style="height:33%"></div><div class="col-value">$1.8K</div><div class="col-label">Nov</div></div><div class="col"><div class="col-bar fill-blue" style="height:50%"></div><div class="col-value">$2.8K</div><div class="col-label">Dec</div></div><div class="col"><div class="col-bar fill-blue" style="height:70%"></div><div class="col-value">$3.5K</div><div class="col-label">Jan</div></div><div class="col"><div class="col-bar" style="height:90%;background:linear-gradient(180deg,#3b82f6,#8b5cf6)"></div><div class="col-value" style="color:#2563eb">$4.2K</div><div class="col-label" style="font-weight:600">Feb</div></div></div></div><div class="card"><h3>Team (12 people)</h3><div class="team-row"><div class="avatar" style="background:#3b82f6">SC</div><div class="team-name">Sarah Chen</div><div class="team-role">CEO / Product Lead</div></div><div class="team-row"><div class="avatar" style="background:#8b5cf6">MJ</div><div class="team-name">Marcus Johnson</div><div class="team-role">CTO / Tech Lead</div></div><div class="team-row"><div class="avatar" style="background:#ec4899">ER</div><div class="team-name">Emily Rodriguez</div><div class="team-role">Senior Frontend</div></div><div class="team-row"><div class="avatar" style="background:#f59e0b">DK</div><div class="team-name">David Kim</div><div class="team-role">Senior Backend</div></div><div class="team-row"><div class="avatar" style="background:#22c55e">LP</div><div class="team-name">Lisa Park</div><div class="team-role">Head of Design</div></div><div style="text-align:center;font-size:12px;color:#94a3b8;padding-top:8px">+7 more team members</div></div><div class="card"><h3>Roadmap · Q1 2026</h3><div style="font-size:12px"><div style="display:flex;gap:8px;align-items:center;padding:5px 0"><span style="background:#dcfce7;color:#16a34a;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600">SHIPPED</span><span>Auth + OAuth</span></div><div style="display:flex;gap:8px;align-items:center;padding:5px 0"><span style="background:#dcfce7;color:#16a34a;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600">SHIPPED</span><span>Core Workspace</span></div><div style="display:flex;gap:8px;align-items:center;padding:5px 0"><span style="background:#dcfce7;color:#16a34a;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600">SHIPPED</span><span>Design System v1</span></div><div style="display:flex;gap:8px;align-items:center;padding:5px 0"><span style="background:#dbeafe;color:#2563eb;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600">IN PROGRESS</span><span>Real-time Collab</span></div><div style="display:flex;gap:8px;align-items:center;padding:5px 0"><span style="background:#dbeafe;color:#2563eb;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600">IN PROGRESS</span><span>File Management</span></div><div style="display:flex;gap:8px;align-items:center;padding:5px 0"><span style="background:#f8fafc;color:#94a3b8;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600">PLANNED</span><span>Notifications</span></div><div style="display:flex;gap:8px;align-items:center;padding:5px 0"><span style="background:#f8fafc;color:#94a3b8;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600">PLANNED</span><span>RBAC + Permissions</span></div></div></div></div></body></html>'''


async def seed_default_planner_content(
    db: AsyncSession,
    storage: StorageBackend,
    workspace_id: uuid.UUID,
    owner_id: uuid.UUID,
    files_folder_id: uuid.UUID,
) -> None:
    """Create Personal & Company Planners with rich views — fast bulk insert.

    Skips S3 writes (content_text is read first by get_file_content) and
    FileVersion rows for speed. Single DB flush per planner.
    """
    from app.models.marketplace import MarketplaceItem

    # 1) Pre-fetch built-in app types
    built_in = {"table", "board", "calendar", "document", "text-editor"}
    result = await db.execute(
        select(AppType).where(
            AppType.slug.in_(built_in),
            AppType.workspace_id.is_(None),
        )
    )
    at_map: dict[str, AppType] = {at.slug: at for at in result.scalars().all()}

    # 2) Auto-install marketplace app types needed for rich views
    marketplace_slugs = {
        "app-habit-tracker", "app-okr-tracker", "app-comparison",
        "app-line-chart", "app-sprint-board", "app-form-view",
        "app-roadmap", "app-kpi-dashboard", "app-crm", "app-retro-board",
    }
    mp_result = await db.execute(
        select(MarketplaceItem).where(
            MarketplaceItem.slug.in_(marketplace_slugs),
            MarketplaceItem.item_type == "app",
        )
    )
    for item in mp_result.scalars().all():
        app_type = AppType(
            workspace_id=workspace_id,
            slug=item.slug,
            label=item.name,
            icon=item.icon,
            renderer="html-template",
            template_content=item.content,
            description=item.description,
        )
        db.add(app_type)
        at_map[item.slug] = app_type
    await db.flush()

    # Helper: create an instance File with explicit UUID
    def _make_instance(source_id: uuid.UUID, source: File, app_type: AppType) -> File:
        base = source.name.rsplit(".", 1)[0] if "." in source.name else source.name
        if app_type.renderer == "html-template":
            inst_name = f"{base} {app_type.label}.html"
            html = app_type.template_content or "{}"
            ct, mime, sz = html, "text/html", len(html.encode())
        else:
            inst_name = f"{base} {app_type.label}"
            ct, mime, sz = None, "application/json", 2
        return File(
            id=uuid.uuid4(),
            owner_id=source.owner_id,
            workspace_id=source.workspace_id,
            folder_id=source.folder_id,
            name=inst_name,
            mime_type=mime,
            size_bytes=sz,
            storage_key=f"{workspace_id}/{uuid.uuid4()}/{inst_name}",
            file_type="instance",
            content_text=ct,
            is_instance=True,
            app_type_id=app_type.id,
            source_file_id=source_id,
            instance_config="{}",
            created_by_id=source.created_by_id,
        )

    for planner_name, files_spec, extra_views, dashboard_html in [
        ("Personal Planner", _PERSONAL_PLANNER_FILES, _PERSONAL_EXTRA_VIEWS, _PERSONAL_DASHBOARD_HTML),
        ("Company Planner", _COMPANY_PLANNER_FILES, _COMPANY_EXTRA_VIEWS, _COMPANY_DASHBOARD_HTML),
    ]:
        folder = await create_folder(
            db, workspace_id, owner_id, planner_name, parent_id=files_folder_id,
        )

        all_objects: list[File] = []

        for spec in files_spec:
            name = spec["name"]
            content = spec["content"]
            mime_type = detect_mime_type(name)
            file_type = detect_file_type(mime_type, name)
            content_bytes = content.encode("utf-8")

            # Explicit UUID so instances can reference it before flush
            file_id = uuid.uuid4()
            file = File(
                id=file_id,
                owner_id=owner_id,
                workspace_id=workspace_id,
                folder_id=folder.id,
                name=name,
                mime_type=mime_type,
                size_bytes=len(content_bytes),
                storage_key=f"{workspace_id}/{uuid.uuid4()}/{name}",
                file_type=file_type,
                content_text=content,
                created_by_id=owner_id,
            )
            all_objects.append(file)

            # Default viewer instance (Table for CSV, Document for MD)
            ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            default_slug = (
                "table" if ext in ("csv", "tsv") else
                "document" if ext in ("md", "markdown") else None
            )
            if default_slug and default_slug in at_map:
                all_objects.append(_make_instance(file_id, file, at_map[default_slug]))

            # Text editor instance
            if "text-editor" in at_map:
                all_objects.append(_make_instance(file_id, file, at_map["text-editor"]))

            # Extra rich views (Board, Calendar, Charts, CRM, etc.)
            for slug in extra_views.get(name, []):
                if slug in at_map:
                    all_objects.append(_make_instance(file_id, file, at_map[slug]))

        # Add dashboard HTML file
        dashboard_name = "Dashboard.html"
        dashboard_bytes = dashboard_html.encode("utf-8")
        dashboard = File(
            id=uuid.uuid4(),
            owner_id=owner_id,
            workspace_id=workspace_id,
            folder_id=folder.id,
            name=dashboard_name,
            mime_type="text/html",
            size_bytes=len(dashboard_bytes),
            storage_key=f"{workspace_id}/{uuid.uuid4()}/{dashboard_name}",
            file_type="view",
            content_text=dashboard_html,
            created_by_id=owner_id,
        )
        all_objects.append(dashboard)

        # Bulk insert — single DB flush, no S3 writes
        db.add_all(all_objects)
        await db.flush()
