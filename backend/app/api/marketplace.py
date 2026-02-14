import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_storage
from app.filestore.base import StorageBackend
from app.models.user import User
from app.schemas.marketplace import (
    MarketplaceItemCreate,
    MarketplaceItemDetail,
    MarketplaceItemResponse,
    MarketplaceUseRequest,
    MarketplaceUseResponse,
)
from app.services import file_service, marketplace_service

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


@router.get("", response_model=list[MarketplaceItemResponse])
async def list_items(
    item_type: str | None = None,
    category: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List community marketplace items. No auth required."""
    return await marketplace_service.list_marketplace_items(
        db, item_type=item_type, category=category, search=search,
        scope="community",
    )


@router.get("/mine", response_model=list[MarketplaceItemResponse])
async def list_my_items(
    item_type: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List current user's custom items."""
    return await marketplace_service.list_marketplace_items(
        db, item_type=item_type, created_by_id=user.id, scope="mine",
    )


@router.get("/{item_id}", response_model=MarketplaceItemDetail)
async def get_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get full detail for a marketplace item."""
    item = await marketplace_service.get_marketplace_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.post("/{item_id}/use", response_model=MarketplaceUseResponse)
async def use_item(
    item_id: uuid.UUID,
    data: MarketplaceUseRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
):
    """Use/install a marketplace item."""
    item = await marketplace_service.get_marketplace_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    drive = await file_service.get_user_drive(db, user.id)

    # Determine target folder
    folder_id = data.folder_id
    if folder_id is None and item.item_type in ("file_template",):
        files_folder = await file_service.ensure_system_folders(db, drive.id, user.id)
        folder_id = files_folder.id

    if item.item_type == "file_template":
        result = await marketplace_service.use_file_template(
            db, storage, item, drive.id, user.id, folder_id
        )
        await db.commit()
        return MarketplaceUseResponse(**result)

    elif item.item_type == "folder_template":
        parent_id = folder_id
        if parent_id is None:
            files_folder = await file_service.ensure_system_folders(db, drive.id, user.id)
            parent_id = files_folder.id
        result = await marketplace_service.use_folder_template(
            db, storage, item, drive.id, user.id, parent_id
        )
        await db.commit()
        return MarketplaceUseResponse(**result)

    elif item.item_type == "app":
        result = await marketplace_service.install_app(db, item, drive.id)
        await db.commit()
        return MarketplaceUseResponse(**result)

    elif item.item_type == "command":
        # Resolve the command prompt
        file_name = None
        if data.file_id:
            file = await file_service.get_file_by_id(db, data.file_id)
            if file:
                file_name = file.name
        prompt = marketplace_service.resolve_command_prompt(item, file_name)
        return MarketplaceUseResponse(action="command_resolved", prompt=prompt)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unknown item type: {item.item_type}",
    )


@router.post("/{item_id}/submit", response_model=MarketplaceItemDetail)
async def submit_item(
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a user-created item for marketplace review."""
    item = await marketplace_service.submit_to_marketplace(db, item_id, user.id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or you cannot submit it",
        )
    await db.commit()
    return item


@router.post("", response_model=MarketplaceItemDetail, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: MarketplaceItemCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a user-submitted marketplace item."""
    item = await marketplace_service.create_marketplace_item(
        db=db,
        item_type=data.item_type,
        slug=data.slug,
        name=data.name,
        description=data.description,
        icon=data.icon,
        category=data.category,
        content=data.content,
        created_by_id=user.id,
    )
    await db.commit()
    return item
