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
            "Monday,Morning,Review weekly goals,Planning,High,Done,Set top 3 priorities\n"
            "Monday,Morning,Exercise routine,Health,Medium,Done,30 min cardio\n"
            "Monday,Afternoon,Deep work session,Work,High,In Progress,Focus on main project\n"
            "Monday,Evening,Meal prep,Health,Medium,Todo,Prep lunches for the week\n"
            "Tuesday,Morning,Team standup,Work,High,Todo,Sync with team\n"
            "Tuesday,Morning,Read for 30 min,Learning,Low,Todo,Current book chapter\n"
            "Tuesday,Afternoon,Project milestone,Work,High,Todo,Complete deliverable\n"
            "Tuesday,Evening,Yoga class,Health,Medium,Todo,6pm session\n"
            "Wednesday,Morning,Review finances,Finance,Medium,Todo,Check budget vs actuals\n"
            "Wednesday,Afternoon,Creative work,Personal,Medium,Todo,Side project time\n"
            "Wednesday,Evening,Dinner with friends,Social,Low,Todo,\n"
            "Thursday,Morning,Exercise routine,Health,Medium,Todo,Strength training\n"
            "Thursday,Afternoon,Deep work session,Work,High,Todo,\n"
            "Thursday,Evening,Online course,Learning,Medium,Todo,Complete module 3\n"
            "Friday,Morning,Weekly review,Planning,High,Todo,Review what worked\n"
            "Friday,Afternoon,Admin tasks,Work,Low,Todo,Emails and scheduling\n"
            "Friday,Evening,Date night,Social,Medium,Todo,\n"
            "Saturday,Morning,Farmers market,Health,Low,Todo,Fresh groceries\n"
            "Saturday,Afternoon,Hobby time,Personal,Medium,Todo,\n"
            "Sunday,Morning,Journaling,Personal,Medium,Todo,Weekly reflection\n"
            "Sunday,Afternoon,Plan next week,Planning,High,Todo,Set goals for Monday"
        ),
    },
    {
        "name": "habits.csv",
        "content": (
            "Habit,Mon,Tue,Wed,Thu,Fri,Sat,Sun\n"
            "Exercise 30 min,yes,yes,no,yes,no,yes,no\n"
            "Read 20 pages,yes,yes,yes,no,yes,no,yes\n"
            "Meditate,yes,no,yes,yes,yes,no,no\n"
            "Drink 8 glasses water,yes,yes,yes,yes,no,yes,yes\n"
            "No social media before noon,no,yes,yes,yes,yes,no,no\n"
            "Journal before bed,yes,yes,no,yes,yes,no,yes\n"
            "Cook healthy meal,yes,no,yes,no,yes,yes,yes\n"
            "8 hours sleep,yes,yes,no,yes,yes,yes,yes"
        ),
    },
    {
        "name": "goals.csv",
        "content": (
            "Objective,Key Result,Progress,Owner,Quarter,Status\n"
            "Improve fitness,Run a 5K under 25 minutes,40,Me,Q1 2025,On Track\n"
            "Improve fitness,Work out 4x per week consistently,60,Me,Q1 2025,On Track\n"
            "Improve fitness,Lose 5 lbs body fat,30,Me,Q1 2025,Behind\n"
            "Build financial health,Save $3000 emergency fund,70,Me,Q1 2025,On Track\n"
            "Build financial health,Reduce dining out to $150/month,45,Me,Q1 2025,At Risk\n"
            "Build financial health,Start investing $200/month,80,Me,Q1 2025,On Track\n"
            "Learn new skills,Complete Python course,55,Me,Q1 2025,On Track\n"
            "Learn new skills,Read 12 books this year,25,Me,Q1 2025,On Track\n"
            "Learn new skills,Launch personal website,10,Me,Q1 2025,Behind"
        ),
    },
    {
        "name": "budget.csv",
        "content": (
            "Category,Item,Budgeted,Actual,Type\n"
            "Income,Salary,5000,5000,income\n"
            "Income,Freelance,800,650,income\n"
            "Housing,Rent,1400,1400,expense\n"
            "Housing,Utilities,180,165,expense\n"
            "Housing,Internet,60,60,expense\n"
            "Food,Groceries,350,380,expense\n"
            "Food,Dining Out,150,210,expense\n"
            "Food,Coffee,40,55,expense\n"
            "Transport,Gas,120,105,expense\n"
            "Transport,Car Insurance,90,90,expense\n"
            "Health,Gym Membership,50,50,expense\n"
            "Health,Supplements,30,25,expense\n"
            "Savings,Emergency Fund,500,500,savings\n"
            "Savings,Investment,300,300,savings\n"
            "Personal,Subscriptions,45,52,expense\n"
            "Personal,Entertainment,100,85,expense\n"
            "Personal,Clothing,75,0,expense"
        ),
    },
    {
        "name": "reading-list.csv",
        "content": (
            "Title,Author,Genre,Status,Rating,Start Date,End Date,Notes\n"
            "Atomic Habits,James Clear,Self-Help,Read,5,2025-01-05,2025-01-18,Life-changing frameworks\n"
            "Deep Work,Cal Newport,Productivity,Read,4,2025-01-20,2025-02-01,Great focus strategies\n"
            "Thinking Fast and Slow,Daniel Kahneman,Psychology,Reading,,2025-02-03,,Dense but fascinating\n"
            "The Psychology of Money,Morgan Housel,Finance,To Read,,,,Recommended by a friend\n"
            "Project Hail Mary,Andy Weir,Sci-Fi,To Read,,,,Fun read after nonfiction\n"
            "The Lean Startup,Eric Ries,Business,To Read,,,,For side project ideas\n"
            "Educated,Tara Westover,Memoir,To Read,,,,Bestseller"
        ),
    },
    {
        "name": "notes.md",
        "content": (
            "# Personal Planner Notes\n\n"
            "## How to Use This Planner\n\n"
            "Welcome to your personal planner! Here's what's inside:\n\n"
            "- **Weekly Plan** - Your week at a glance with time blocks and priorities\n"
            "- **Habits** - Track your daily habits and build streaks\n"
            "- **Goals** - OKR-style goal tracking with progress\n"
            "- **Budget** - Monthly income and expense tracker\n"
            "- **Reading List** - Books you're reading and want to read\n\n"
            "### Tips\n\n"
            "1. Review your weekly plan every Sunday evening\n"
            "2. Update habits daily - consistency matters more than perfection\n"
            "3. Review goals monthly and adjust key results as needed\n"
            "4. Track budget weekly to catch overspending early\n\n"
            "### Quick Links\n\n"
            "Each file has multiple views - click the tabs to switch between Table, Board, "
            "and other views. Try the **Board** view on your weekly plan to see tasks by status!\n"
        ),
    },
]

_COMPANY_PLANNER_FILES = [
    {
        "name": "project-board.csv",
        "content": (
            "Task,Status,Priority,Assignee,Points,Sprint,Category,Due Date\n"
            "Define product roadmap,Done,High,Product Lead,8,Sprint 1,Planning,2025-01-15\n"
            "Set up project repository,Done,High,Tech Lead,3,Sprint 1,Engineering,2025-01-16\n"
            "Design system components,Done,Medium,Designer,5,Sprint 1,Design,2025-01-20\n"
            "User authentication flow,Done,High,Backend Dev,8,Sprint 1,Engineering,2025-01-22\n"
            "Create landing page,In Progress,High,Frontend Dev,5,Sprint 2,Engineering,2025-02-01\n"
            "API integration layer,In Progress,High,Backend Dev,8,Sprint 2,Engineering,2025-02-03\n"
            "Write user documentation,In Progress,Medium,Content,3,Sprint 2,Documentation,2025-02-05\n"
            "Performance testing,Todo,High,QA Lead,5,Sprint 2,Quality,2025-02-07\n"
            "Mobile responsive audit,Todo,Medium,Designer,3,Sprint 3,Design,2025-02-14\n"
            "SEO optimization,Todo,Low,Marketing,3,Sprint 3,Marketing,2025-02-14\n"
            "Beta user interviews,Todo,High,Product Lead,5,Sprint 3,Research,2025-02-20\n"
            "Security audit,Todo,High,Tech Lead,8,Sprint 3,Engineering,2025-02-21\n"
            "Launch checklist,Backlog,Medium,Product Lead,3,,Planning,\n"
            "Analytics dashboard,Backlog,Medium,Frontend Dev,8,,Engineering,\n"
            "Customer feedback system,Backlog,Low,Product Lead,5,,Product,"
        ),
    },
    {
        "name": "team.csv",
        "content": (
            "Name,Role,Department,Email,Status,Start Date,Location,Skills\n"
            "Sarah Chen,Product Lead,Product,sarah@company.com,Active,2023-06-15,New York,Strategy / Roadmap / Analytics\n"
            "Marcus Johnson,Tech Lead,Engineering,marcus@company.com,Active,2023-03-01,Remote,Architecture / Python / React\n"
            "Emily Rodriguez,Frontend Dev,Engineering,emily@company.com,Active,2023-09-10,San Francisco,React / TypeScript / CSS\n"
            "David Kim,Backend Dev,Engineering,david@company.com,Active,2024-01-08,Remote,Python / PostgreSQL / APIs\n"
            "Lisa Park,Designer,Design,lisa@company.com,Active,2023-11-20,New York,Figma / UI/UX / Design Systems\n"
            "James Wright,QA Lead,Quality,james@company.com,Active,2024-02-01,Remote,Testing / Automation / CI/CD\n"
            "Nina Patel,Content Writer,Marketing,nina@company.com,Active,2024-03-15,Remote,Copywriting / SEO / Documentation\n"
            "Alex Thompson,Marketing Lead,Marketing,alex@company.com,Active,2023-08-01,San Francisco,Growth / Campaigns / Analytics"
        ),
    },
    {
        "name": "okrs.csv",
        "content": (
            "Objective,Key Result,Progress,Owner,Quarter,Status\n"
            "Launch MVP by end of Q1,Complete all P0 features,75,Sarah Chen,Q1 2025,On Track\n"
            "Launch MVP by end of Q1,Pass security audit with zero critical issues,30,Marcus Johnson,Q1 2025,On Track\n"
            "Launch MVP by end of Q1,Achieve 95%+ test coverage on core modules,60,James Wright,Q1 2025,On Track\n"
            "Grow to 500 beta users,Set up referral program,40,Alex Thompson,Q1 2025,Behind\n"
            "Grow to 500 beta users,Publish 10 content pieces,50,Nina Patel,Q1 2025,On Track\n"
            "Grow to 500 beta users,Achieve 30% activation rate,20,Sarah Chen,Q1 2025,At Risk\n"
            "Build scalable engineering culture,Implement CI/CD pipeline,90,Marcus Johnson,Q1 2025,On Track\n"
            "Build scalable engineering culture,Document all API endpoints,45,David Kim,Q1 2025,Behind\n"
            "Build scalable engineering culture,Reduce deploy time to under 10 min,70,Marcus Johnson,Q1 2025,On Track"
        ),
    },
    {
        "name": "roadmap.csv",
        "content": (
            "Feature,Quarter,Status,Priority,Team,Description\n"
            "User Authentication,Q1 2025,Shipped,P0,Engineering,Email/password and OAuth login\n"
            "Core Dashboard,Q1 2025,Shipped,P0,Engineering,Main app dashboard with widgets\n"
            "File Management,Q1 2025,In Progress,P0,Engineering,Upload and organize files\n"
            "Team Collaboration,Q1 2025,In Progress,P1,Engineering,Real-time shared editing\n"
            "API v1,Q1 2025,In Progress,P0,Engineering,Public REST API\n"
            "Mobile App,Q2 2025,Planned,P1,Engineering,iOS and Android apps\n"
            "Advanced Analytics,Q2 2025,Planned,P1,Product,Usage analytics and reports\n"
            "Marketplace,Q2 2025,Planned,P2,Product,Third-party integrations\n"
            "Enterprise SSO,Q3 2025,Planned,P1,Engineering,SAML and OIDC support\n"
            "AI Assistant,Q3 2025,Planned,P2,Engineering,AI-powered features\n"
            "White-label Option,Q4 2025,Planned,P2,Product,Custom branding for enterprise"
        ),
    },
    {
        "name": "meeting-notes.md",
        "content": (
            "# Company Meeting Notes\n\n"
            "## Weekly Standup - Feb 10, 2025\n\n"
            "**Attendees:** Sarah, Marcus, Emily, David, Lisa, James\n\n"
            "### Updates\n"
            "- **Sarah**: Finalized Q1 roadmap, starting beta user outreach\n"
            "- **Marcus**: CI/CD pipeline deployed, working on API rate limiting\n"
            "- **Emily**: Landing page 80% complete, needs design review\n"
            "- **David**: Auth flow shipped, starting API integration\n"
            "- **Lisa**: Design system v1 done, starting mobile wireframes\n"
            "- **James**: Test framework set up, writing integration tests\n\n"
            "### Decisions\n"
            "- Sprint 2 ends Feb 7, Sprint 3 starts Feb 10\n"
            "- Beta launch target: March 1\n\n"
            "### Action Items\n"
            "- [ ] Emily: Share landing page for review by Wed\n"
            "- [ ] Marcus: Document deployment process\n"
            "- [ ] Sarah: Send beta invite emails to waitlist\n\n"
            "---\n\n"
            "## Sprint 1 Retrospective - Jan 24, 2025\n\n"
            "### What Went Well\n"
            "- Shipped auth flow ahead of schedule\n"
            "- Great collaboration between design and engineering\n"
            "- Zero production incidents\n\n"
            "### What To Improve\n"
            "- Standups running over 15 minutes\n"
            "- Need better ticket descriptions\n"
            "- More async communication to reduce meetings\n\n"
            "### Action Items\n"
            "- [ ] Timebox standups to 10 minutes\n"
            "- [ ] Add acceptance criteria template to tickets\n"
            "- [ ] Start using async updates in Slack\n"
        ),
    },
    {
        "name": "kpis.csv",
        "content": (
            "Metric,Current,Target,Previous,Unit,Category\n"
            "Monthly Active Users,342,500,280,,Growth\n"
            "Weekly Signups,45,75,38,,Growth\n"
            "Activation Rate,28,40,22,%,Product\n"
            "Session Duration,4.2,5,3.8,min,Product\n"
            "NPS Score,42,50,35,,Satisfaction\n"
            "Bug Backlog,23,15,31,,Quality\n"
            "Test Coverage,72,90,65,%,Quality\n"
            "Deploy Frequency,3,5,2,/week,Engineering\n"
            "Revenue MRR,2800,5000,1900,$,Revenue\n"
            "Customer Acquisition Cost,32,25,45,$,Revenue"
        ),
    },
    {
        "name": "budget.csv",
        "content": (
            "Category,Item,Q1 Budget,Q1 Actual,Q2 Budget,Status\n"
            "Revenue,Product Sales,15000,12500,25000,Behind\n"
            "Revenue,Services,5000,6200,7000,Ahead\n"
            "People,Salaries,48000,48000,52000,On Budget\n"
            "People,Benefits,9600,9600,10400,On Budget\n"
            "People,Contractors,6000,4500,8000,Under\n"
            "Infrastructure,Cloud Hosting,2400,2100,3000,Under\n"
            "Infrastructure,SaaS Tools,1800,2000,1800,Over\n"
            "Marketing,Paid Ads,3000,1800,5000,Under\n"
            "Marketing,Content,1500,1200,2000,Under\n"
            "Marketing,Events,2000,0,3000,Under\n"
            "Office,Coworking,1200,1200,1200,On Budget\n"
            "Legal,Accounting,1500,1500,1500,On Budget"
        ),
    },
    {
        "name": "notes.md",
        "content": (
            "# Company Planner\n\n"
            "## How to Use This Planner\n\n"
            "Your company planner contains everything your team needs to stay aligned:\n\n"
            "- **Project Board** - Kanban-style task tracking by sprint\n"
            "- **Team** - Team directory with roles and contact info\n"
            "- **OKRs** - Quarterly objectives and key results\n"
            "- **Roadmap** - Product roadmap by quarter\n"
            "- **KPIs** - Key performance indicators dashboard\n"
            "- **Budget** - Quarterly budget tracker\n"
            "- **Meeting Notes** - Running log of team meetings\n\n"
            "### Tips\n\n"
            "1. Use the **Board** view on Project Board to see tasks by status (like Jira)\n"
            "2. Use the **OKR Tracker** view on OKRs to see progress visually\n"
            "3. Use the **KPI Dashboard** view on KPIs for at-a-glance metrics\n"
            "4. Use the **Roadmap** view to see features by quarter\n"
            "5. Review OKRs weekly and update progress %\n\n"
            "### Keyboard Shortcuts\n\n"
            "- **Tab** between views on any file\n"
            "- **/** to search across all files\n"
            "- **Cmd+K** to open the command palette\n"
        ),
    },
]

# Map file names to the custom views (instances) that should be created for them.
_PERSONAL_VIEWS: dict[str, list[str]] = {
    "weekly-plan.csv": ["table", "board", "calendar"],
    "habits.csv": ["table"],
    "goals.csv": ["table"],
    "budget.csv": ["table"],
    "reading-list.csv": ["table"],
    "notes.md": ["document"],
}

_COMPANY_VIEWS: dict[str, list[str]] = {
    "project-board.csv": ["table", "board", "calendar"],
    "team.csv": ["table"],
    "okrs.csv": ["table"],
    "roadmap.csv": ["table"],
    "meeting-notes.md": ["document"],
    "kpis.csv": ["table"],
    "budget.csv": ["table"],
    "notes.md": ["document"],
}


async def seed_default_planner_content(
    db: AsyncSession,
    storage: StorageBackend,
    workspace_id: uuid.UUID,
    owner_id: uuid.UUID,
    files_folder_id: uuid.UUID,
) -> None:
    """Create Personal Planner and Company Planner folders with example files and views."""

    async def _create_planner(
        parent_id: uuid.UUID,
        name: str,
        files_spec: list[dict],
        views_spec: dict[str, list[str]],
    ) -> None:
        folder = await create_folder(db, workspace_id, owner_id, name, parent_id=parent_id)
        for spec in files_spec:
            file = await create_file_from_content(
                db, storage, workspace_id, spec["name"], spec["content"],
                owner_id, folder_id=folder.id, created_by_id=owner_id,
            )
            slugs = views_spec.get(spec["name"], [])
            for slug in slugs:
                app_type = await get_app_type_by_slug(db, slug, workspace_id)
                if app_type:
                    await create_instance(db, storage, file, app_type)
            # Always add text-editor
            editor = await get_app_type_by_slug(db, "text-editor", workspace_id)
            if editor:
                await create_instance(db, storage, file, editor)

    await _create_planner(
        files_folder_id, "Personal Planner", _PERSONAL_PLANNER_FILES, _PERSONAL_VIEWS,
    )
    await _create_planner(
        files_folder_id, "Company Planner", _COMPANY_PLANNER_FILES, _COMPANY_VIEWS,
    )
