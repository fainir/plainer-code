import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import file_service, workspace_service
from app.dependencies import get_current_user, get_storage
from app.models.user import User
from app.schemas.file import FileCreate, FileContentResponse, FileResponse, FolderCreate, FolderResponse
from app.config import settings

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["files"])





@router.get("/files", response_model=list[FileResponse])
async def list_files(
    workspace_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    return await file_service.list_workspace_files(db, workspace_id, folder_id)


@router.post("/files", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def create_file(
    workspace_id: uuid.UUID,
    data: FileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    storage = get_storage()
    file = await file_service.create_file_from_content(
        db=db,
        storage=storage,
        workspace_id=workspace_id,
        name=data.name,
        content=data.content,
        folder_id=data.folder_id,
        created_by_id=user.id,
    )
    await db.commit()
    return file


@router.get("/files/{file_id}", response_model=FileResponse)
async def get_file(
    workspace_id: uuid.UUID,
    file_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    file = await file_service.get_file_by_id(db, file_id)
    if file is None or file.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return file


@router.get("/files/{file_id}/content", response_model=FileContentResponse)
async def get_file_content(
    workspace_id: uuid.UUID,
    file_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    file = await file_service.get_file_by_id(db, file_id)
    if file is None or file.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    storage = get_storage()
    content = await file_service.get_file_content(db, storage, file_id)
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    return FileContentResponse(id=file.id, name=file.name, content=content, mime_type=file.mime_type)


@router.get("/folders", response_model=list[FolderResponse])
async def list_folders(
    workspace_id: uuid.UUID,
    parent_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    return await file_service.list_workspace_folders(db, workspace_id, parent_id)
