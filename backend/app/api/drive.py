import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.file import (
    AppTypeCreate,
    AppTypeResponse,
    DriveResponse,
    FileContentResponse,
    FileContentUpdate,
    FileCreate,
    FileResponse,
    FolderCreate,
    FolderResponse,
    InstanceConfigUpdate,
    InstanceCreate,
    ReorderRequest,
    ShareRequest,
    ShareResponse,
)
from app.schemas.chat import ConversationCreate, ConversationResponse, MessageResponse
from app.services import file_service, chat_service
from app.filestore.local import LocalStorageBackend
from app.config import settings

router = APIRouter(prefix="/drive", tags=["drive"])


def get_storage() -> LocalStorageBackend:
    return LocalStorageBackend(settings.storage_local_path)


def _file_response(file) -> FileResponse:
    """Build a FileResponse with denormalized app_type_slug."""
    slug = None
    if file.is_instance and file.app_type:
        slug = file.app_type.slug
    return FileResponse(
        id=file.id,
        owner_id=file.owner_id,
        workspace_id=file.workspace_id,
        folder_id=file.folder_id,
        name=file.name,
        mime_type=file.mime_type,
        size_bytes=file.size_bytes,
        file_type=file.file_type,
        is_vibe_file=file.is_vibe_file,
        is_favorite=file.is_favorite,
        created_by_agent=file.created_by_agent,
        is_instance=file.is_instance,
        app_type_id=file.app_type_id,
        app_type_slug=slug,
        source_file_id=file.source_file_id,
        related_source_ids=file.related_source_ids,
        instance_config=file.instance_config,
        sort_order=file.sort_order,
        created_at=file.created_at,
        updated_at=file.updated_at,
    )


@router.get("", response_model=DriveResponse)
async def get_my_drive(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's personal drive."""
    drive = await file_service.get_user_drive(db, user.id)
    files_folder = await file_service.ensure_system_folders(db, drive.id, user.id)
    await db.commit()
    return DriveResponse(
        id=drive.id,
        name=drive.name,
        owner_id=drive.owner_id,
        files_folder_id=files_folder.id,
    )


# ── Files ───────────────────────────────────────────────

@router.get("/files", response_model=list[FileResponse])
async def list_files(
    folder_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    files = await file_service.list_drive_files(db, drive.id, folder_id)
    return [_file_response(f) for f in files]


@router.post("/files", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def create_file(
    data: FileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    storage = get_storage()

    # Default folder: Files root folder
    folder_id = data.folder_id
    if folder_id is None:
        files_folder = await file_service.ensure_system_folders(db, drive.id, user.id)
        folder_id = files_folder.id

    file = await file_service.create_file_from_content(
        db=db,
        storage=storage,
        workspace_id=drive.id,
        name=data.name,
        content=data.content,
        owner_id=user.id,
        folder_id=folder_id,
        created_by_id=user.id,
    )

    # Auto-create instances (default viewer + text editor)
    await file_service.auto_create_instances_for_file(db, storage, file)

    await db.commit()
    return _file_response(file)


@router.get("/files/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file = await file_service.get_file_by_id(db, file_id)
    if file is None or file.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return file


@router.get("/files/{file_id}/content", response_model=FileContentResponse)
async def get_file_content(
    file_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file = await file_service.get_file_by_id(db, file_id)
    if file is None or file.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    storage = get_storage()
    content = await file_service.get_file_content(db, storage, file_id)
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    slug = file.app_type.slug if file.is_instance and file.app_type else None
    template = file.app_type.template_content if file.is_instance and file.app_type else None
    return FileContentResponse(
        id=file.id, name=file.name, content=content, mime_type=file.mime_type,
        is_favorite=file.is_favorite, is_instance=file.is_instance,
        app_type_slug=slug, source_file_id=file.source_file_id,
        instance_config=file.instance_config,
        template_content=template,
    )


@router.put("/files/{file_id}/content", response_model=FileContentResponse)
async def update_file_content(
    file_id: uuid.UUID,
    data: FileContentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save updated content (e.g. from the WYSIWYG editor)."""
    file = await file_service.get_file_by_id(db, file_id)
    if file is None or file.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    storage = get_storage()
    file = await file_service.update_file_content(
        db, storage, file, data.content, updated_by_id=user.id
    )
    await db.commit()
    return FileContentResponse(
        id=file.id, name=file.name, content=file.content_text or "",
        mime_type=file.mime_type, is_favorite=file.is_favorite,
    )


@router.post("/files/upload", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile,
    folder_id: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a binary file (e.g. .docx)."""
    drive = await file_service.get_user_drive(db, user.id)
    storage = get_storage()

    data = await file.read()
    name = file.filename or "untitled"

    fid = None
    if folder_id:
        fid = uuid.UUID(folder_id)
    else:
        files_folder = await file_service.ensure_system_folders(db, drive.id, user.id)
        fid = files_folder.id

    new_file = await file_service.create_file_from_binary(
        db=db,
        storage=storage,
        workspace_id=drive.id,
        name=name,
        data=data,
        owner_id=user.id,
        folder_id=fid,
        created_by_id=user.id,
    )

    # Auto-create instances (default viewer + text editor)
    await file_service.auto_create_instances_for_file(db, storage, new_file)

    await db.commit()
    return _file_response(new_file)


# ── Folders ─────────────────────────────────────────────

@router.get("/folders", response_model=list[FolderResponse])
async def list_folders(
    parent_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    return await file_service.list_drive_folders(db, drive.id, parent_id)


@router.post("/folders", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    data: FolderCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    folder = await file_service.create_folder(
        db=db,
        workspace_id=drive.id,
        owner_id=user.id,
        name=data.name,
        parent_id=data.parent_id,
    )
    await db.commit()
    return folder


# ── Favorites ──────────────────────────────────────────

@router.put("/files/{file_id}/favorite", response_model=FileResponse)
async def toggle_file_favorite(
    file_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        file = await file_service.toggle_file_favorite(db, file_id, user.id)
        await db.commit()
        return file
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/folders/{folder_id}/favorite", response_model=FolderResponse)
async def toggle_folder_favorite(
    folder_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        folder = await file_service.toggle_folder_favorite(db, folder_id, user.id)
        await db.commit()
        return folder
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/favorites/files", response_model=list[FileResponse])
async def list_favorite_files(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    return await file_service.list_favorite_files(db, drive.id)


@router.get("/favorites/folders", response_model=list[FolderResponse])
async def list_favorite_folders(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    return await file_service.list_favorite_folders(db, drive.id)


# ── App Types ──────────────────────────────────────────

@router.get("/app-types", response_model=list[AppTypeResponse])
async def list_app_types(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all available app types (global + workspace-specific)."""
    drive = await file_service.get_user_drive(db, user.id)
    return await file_service.list_app_types(db, drive.id)


@router.post("/app-types", response_model=AppTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_app_type(
    data: AppTypeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a custom app type."""
    drive = await file_service.get_user_drive(db, user.id)
    app_type = await file_service.create_app_type(
        db=db,
        workspace_id=drive.id,
        slug=data.slug,
        label=data.label,
        icon=data.icon,
        renderer=data.renderer,
        template_content=data.template_content,
        description=data.description,
        created_by_agent=False,
    )
    await db.commit()
    return app_type


# ── Instances ──────────────────────────────────────────

@router.get("/instances", response_model=list[FileResponse])
async def list_instances(
    app_type_slug: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all instances, optionally filtered by app type slug."""
    drive = await file_service.get_user_drive(db, user.id)
    instances = await file_service.list_instances_by_app_type(db, drive.id, app_type_slug)
    return [_file_response(i) for i in instances]


@router.get("/files/{file_id}/instances", response_model=list[FileResponse])
async def get_file_instances(
    file_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all instances linked to a data file."""
    file = await file_service.get_file_by_id(db, file_id)
    if file is None or file.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    instances = await file_service.get_instances_for_file(db, file_id)
    return [_file_response(i) for i in instances]


@router.post("/instances", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def create_instance(
    data: InstanceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an instance for a data file."""
    drive = await file_service.get_user_drive(db, user.id)
    storage = get_storage()

    # Resolve app type
    app_type = None
    if data.app_type_id:
        from app.models.app_type import AppType
        result = await db.execute(select(AppType).where(AppType.id == data.app_type_id))
        app_type = result.scalar_one_or_none()
    elif data.app_type_slug:
        app_type = await file_service.get_app_type_by_slug(db, data.app_type_slug, drive.id)

    if app_type is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="App type not found")

    source_file = None
    if data.source_file_id:
        source_file = await file_service.get_file_by_id(db, data.source_file_id)
        if source_file is None or source_file.owner_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found")

    if source_file is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="source_file_id is required")

    instance = await file_service.create_instance(
        db=db, storage=storage, source_file=source_file, app_type=app_type,
        name=data.name, config=data.config, content=data.content,
        related_source_ids=data.related_source_ids,
    )
    await db.commit()
    return _file_response(instance)


@router.put("/instances/{instance_id}/config", response_model=FileResponse)
async def update_instance_config(
    instance_id: uuid.UUID,
    data: InstanceConfigUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an instance's config JSON."""
    file = await file_service.get_file_by_id(db, instance_id)
    if file is None or file.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    if not file.is_instance:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is not an instance")

    file.instance_config = data.config
    await db.flush()
    await db.commit()
    return _file_response(file)


# ── Sharing ─────────────────────────────────────────────

@router.get("/shared", response_model=list[FileResponse])
async def list_shared_with_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    files = await file_service.list_shared_with_me(db, user.id)
    return [_file_response(f) for f in files]


@router.get("/recent", response_model=list[FileResponse])
async def list_recent(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    files = await file_service.list_recent_files(db, user.id)
    return [_file_response(f) for f in files]


@router.post("/files/{file_id}/share", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
async def share_file(
    file_id: uuid.UUID,
    data: ShareRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file = await file_service.get_file_by_id(db, file_id)
    if file is None or file.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # Find target user by email
    target = await db.execute(select(User).where(User.email == data.email))
    target_user = target.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    share = await file_service.share_file(
        db, file_id, shared_by_id=user.id, shared_with_id=target_user.id, permission=data.permission
    )
    await db.commit()
    return share


# ── Conversations (drive-scoped) ────────────────────────

@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    return await chat_service.get_workspace_conversations(db, drive.id)


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    data: ConversationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    conversation = await chat_service.create_conversation(db, drive.id, user.id, data.title)
    await db.commit()
    return conversation


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    conversation = await chat_service.get_conversation_by_id(db, conversation_id)
    if conversation is None or conversation.workspace_id != drive.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return await chat_service.get_conversation_messages(db, conversation_id)


# ── Reorder ──────────────────────────────────────────────

@router.put("/files/reorder")
async def reorder_files(
    data: ReorderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    await file_service.reorder_files(db, drive.id, data.items)
    await db.commit()
    return {"ok": True}


@router.put("/folders/reorder")
async def reorder_folders(
    data: ReorderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    await file_service.reorder_folders(db, drive.id, data.items)
    await db.commit()
    return {"ok": True}
