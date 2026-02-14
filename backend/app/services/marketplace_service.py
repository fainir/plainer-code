import json
import uuid

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketplace import MarketplaceItem
from app.filestore.base import StorageBackend
from app.services import file_service


async def list_marketplace_items(
    db: AsyncSession,
    item_type: str | None = None,
    category: str | None = None,
    search: str | None = None,
    created_by_id: uuid.UUID | None = None,
    scope: str | None = None,
) -> list[MarketplaceItem]:
    query = select(MarketplaceItem)

    if item_type:
        query = query.where(MarketplaceItem.item_type == item_type)
    if category:
        query = query.where(MarketplaceItem.category == category)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                MarketplaceItem.name.ilike(pattern),
                MarketplaceItem.description.ilike(pattern),
            )
        )

    if scope == "mine" and created_by_id:
        query = query.where(MarketplaceItem.created_by_id == created_by_id)
    elif scope == "community":
        query = query.where(
            or_(
                MarketplaceItem.is_builtin == True,  # noqa: E712
                MarketplaceItem.status == "approved",
            )
        )

    query = query.order_by(MarketplaceItem.sort_order, MarketplaceItem.name)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_marketplace_item(
    db: AsyncSession, item_id: uuid.UUID
) -> MarketplaceItem | None:
    result = await db.execute(
        select(MarketplaceItem).where(MarketplaceItem.id == item_id)
    )
    return result.scalar_one_or_none()


async def get_marketplace_item_by_slug(
    db: AsyncSession, slug: str
) -> MarketplaceItem | None:
    result = await db.execute(
        select(MarketplaceItem).where(MarketplaceItem.slug == slug)
    )
    return result.scalar_one_or_none()


async def use_file_template(
    db: AsyncSession,
    storage: StorageBackend,
    item: MarketplaceItem,
    workspace_id: uuid.UUID,
    owner_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
) -> dict:
    content_data = json.loads(item.content)
    filename = content_data.get("filename", "untitled.txt")
    file_content = content_data.get("content", "")

    file = await file_service.create_file_from_content(
        db=db,
        storage=storage,
        workspace_id=workspace_id,
        name=filename,
        content=file_content,
        owner_id=owner_id,
        folder_id=folder_id,
        created_by_id=owner_id,
    )
    await file_service.auto_create_instances_for_file(db, storage, file)

    item.install_count += 1
    await db.flush()

    return {"action": "file_created", "file_id": file.id}


async def use_folder_template(
    db: AsyncSession,
    storage: StorageBackend,
    item: MarketplaceItem,
    workspace_id: uuid.UUID,
    owner_id: uuid.UUID,
    parent_folder_id: uuid.UUID | None = None,
) -> dict:
    content_data = json.loads(item.content)
    folder_name = content_data.get("folder_name", "New Folder")
    structure = content_data.get("structure", [])

    root_folder = await file_service.create_folder(
        db=db,
        workspace_id=workspace_id,
        owner_id=owner_id,
        name=folder_name,
        parent_id=parent_folder_id,
    )

    await _create_structure_recursive(
        db, storage, workspace_id, owner_id, root_folder.id, structure
    )

    item.install_count += 1
    await db.flush()

    return {"action": "folder_created", "folder_id": root_folder.id}


async def _create_structure_recursive(
    db: AsyncSession,
    storage: StorageBackend,
    workspace_id: uuid.UUID,
    owner_id: uuid.UUID,
    parent_id: uuid.UUID,
    structure: list[dict],
) -> None:
    for entry in structure:
        if entry.get("type") == "folder":
            folder = await file_service.create_folder(
                db=db,
                workspace_id=workspace_id,
                owner_id=owner_id,
                name=entry["name"],
                parent_id=parent_id,
            )
            children = entry.get("children", [])
            if children:
                await _create_structure_recursive(
                    db, storage, workspace_id, owner_id, folder.id, children
                )
        else:
            file = await file_service.create_file_from_content(
                db=db,
                storage=storage,
                workspace_id=workspace_id,
                name=entry["name"],
                content=entry.get("content", ""),
                owner_id=owner_id,
                folder_id=parent_id,
                created_by_id=owner_id,
            )
            await file_service.auto_create_instances_for_file(db, storage, file)


async def install_app(
    db: AsyncSession,
    item: MarketplaceItem,
    workspace_id: uuid.UUID,
) -> dict:
    content_data = json.loads(item.content)
    slug = content_data.get("slug", item.slug)
    label = content_data.get("label", item.name)
    icon = content_data.get("icon", item.icon)
    template_html = content_data.get("template_html", "")
    description = content_data.get("description", item.description)

    # Check if already installed
    existing = await file_service.get_app_type_by_slug(db, slug, workspace_id)
    if existing:
        return {"action": "app_already_installed", "app_type_id": existing.id}

    app_type = await file_service.create_app_type(
        db=db,
        workspace_id=workspace_id,
        slug=slug,
        label=label,
        icon=icon,
        renderer="html-template",
        template_content=template_html,
        description=description,
    )

    item.install_count += 1
    await db.flush()

    return {"action": "app_installed", "app_type_id": app_type.id}


def resolve_command_prompt(item: MarketplaceItem, file_name: str | None = None) -> str:
    content_data = json.loads(item.content)
    prompt = content_data.get("prompt", "")
    if file_name:
        prompt = prompt.replace("{file_name}", file_name)
    return prompt


async def submit_to_marketplace(
    db: AsyncSession,
    item_id: uuid.UUID,
    user_id: uuid.UUID,
) -> MarketplaceItem | None:
    item = await get_marketplace_item(db, item_id)
    if item is None or item.created_by_id != user_id or item.is_builtin:
        return None
    item.status = "submitted"
    await db.flush()
    return item


async def create_marketplace_item(
    db: AsyncSession,
    item_type: str,
    slug: str,
    name: str,
    description: str,
    icon: str = "package",
    category: str = "general",
    content: str | None = None,
    created_by_id: uuid.UUID | None = None,
) -> MarketplaceItem:
    item = MarketplaceItem(
        item_type=item_type,
        slug=slug,
        name=name,
        description=description,
        icon=icon,
        category=category,
        content=content,
        is_builtin=False,
        status="draft",
        created_by_id=created_by_id,
    )
    db.add(item)
    await db.flush()
    return item
