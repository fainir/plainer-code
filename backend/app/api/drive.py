import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.file import (
    AllViewsResponse,
    DriveResponse,
    FileContentResponse,
    FileCreate,
    FileResponse,
    FileViewCreate,
    FileViewResponse,
    FolderCreate,
    FolderResponse,
    ShareRequest,
    ShareResponse,
)
from app.schemas.chat import ConversationCreate, ConversationResponse, MessageResponse
from app.services import file_service, chat_service
from app.storage.local import LocalStorageBackend
from app.config import settings

router = APIRouter(prefix="/drive", tags=["drive"])


def get_storage() -> LocalStorageBackend:
    return LocalStorageBackend(settings.storage_local_path)


@router.get("", response_model=DriveResponse)
async def get_my_drive(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's personal drive."""
    drive = await file_service.get_user_drive(db, user.id)
    views_folder, files_folder = await file_service.ensure_system_folders(db, drive.id, user.id)
    await db.commit()
    return DriveResponse(
        id=drive.id,
        name=drive.name,
        owner_id=drive.owner_id,
        views_folder_id=views_folder.id,
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
    return await file_service.list_drive_files(db, drive.id, folder_id)


@router.post("/files", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def create_file(
    data: FileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    storage = get_storage()

    # Default folder: Views folder for .html files, Files folder for data files
    folder_id = data.folder_id
    if folder_id is None:
        views_folder, files_folder = await file_service.ensure_system_folders(
            db, drive.id, user.id
        )
        is_view = data.name.lower().endswith((".html", ".htm"))
        folder_id = views_folder.id if is_view else files_folder.id

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
    await db.commit()
    return file


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

    return FileContentResponse(id=file.id, name=file.name, content=content, mime_type=file.mime_type, is_favorite=file.is_favorite)


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


@router.get("/views", response_model=list[FileResponse])
async def list_view_files(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await file_service.get_user_drive(db, user.id)
    return await file_service.list_view_files(db, drive.id)


@router.get("/all-views", response_model=AllViewsResponse)
async def list_all_views(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all views for the sidebar: HTML views + built-in view candidates."""
    drive = await file_service.get_user_drive(db, user.id)
    return await file_service.list_all_views(db, drive.id)


@router.get("/files/{file_id}/views", response_model=list[FileViewResponse])
async def get_file_views(
    file_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get linked HTML views for a specific data file."""
    file = await file_service.get_file_by_id(db, file_id)
    if file is None or file.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    views = await file_service.get_linked_views_for_file(db, file_id)
    result = []
    for v in views:
        view_file = await file_service.get_file_by_id(db, v.view_file_id)
        result.append(FileViewResponse(
            id=v.id,
            file_id=v.file_id,
            view_file_id=v.view_file_id,
            label=v.label,
            position=v.position,
            view_file_name=view_file.name if view_file else None,
        ))
    return result


@router.post("/file-views", response_model=FileViewResponse, status_code=status.HTTP_201_CREATED)
async def link_view(
    data: FileViewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link an HTML view file to a data file."""
    file = await file_service.get_file_by_id(db, data.file_id)
    view_file = await file_service.get_file_by_id(db, data.view_file_id)
    if not file or file.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data file not found")
    if not view_file or view_file.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View file not found")
    if view_file.file_type != "view":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target must be an HTML view file")

    link = await file_service.link_view_to_file(
        db, data.file_id, data.view_file_id, data.label, data.position
    )
    await db.commit()
    return FileViewResponse(
        id=link.id,
        file_id=link.file_id,
        view_file_id=link.view_file_id,
        label=link.label,
        position=link.position,
        view_file_name=view_file.name,
    )


@router.delete("/file-views/{file_view_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_view(
    file_view_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a view link."""
    await file_service.unlink_view_from_file(db, file_view_id)
    await db.commit()


# ── Sharing ─────────────────────────────────────────────

@router.get("/shared", response_model=list[FileResponse])
async def list_shared_with_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await file_service.list_shared_with_me(db, user.id)


@router.get("/recent", response_model=list[FileResponse])
async def list_recent(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await file_service.list_recent_files(db, user.id)


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
