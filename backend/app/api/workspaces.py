import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceMemberResponse,
    WorkspaceResponse,
)
from app.services import workspace_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await workspace_service.get_user_workspaces(db, user.id)


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.create_workspace(
        db, data.name, user.id, data.description
    )
    await db.commit()
    return workspace


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return workspace


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberResponse])
async def list_members(
    workspace_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify access
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    members = await workspace_service.get_workspace_members(db, workspace_id)
    return [
        WorkspaceMemberResponse(
            id=m.id,
            user_id=m.user_id,
            display_name=m.user.display_name,
            email=m.user.email,
            role=m.role,
            joined_at=m.joined_at,
        )
        for m in members
    ]
