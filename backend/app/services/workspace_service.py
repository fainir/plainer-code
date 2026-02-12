import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workspace import Workspace, WorkspaceMember


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug


async def create_workspace(
    db: AsyncSession, name: str, owner_id: uuid.UUID, description: str | None = None
) -> Workspace:
    base_slug = slugify(name)
    slug = base_slug

    # Ensure unique slug
    counter = 1
    while True:
        existing = await db.execute(select(Workspace).where(Workspace.slug == slug))
        if existing.scalar_one_or_none() is None:
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    workspace = Workspace(
        name=name,
        slug=slug,
        description=description,
        owner_id=owner_id,
    )
    db.add(workspace)
    await db.flush()

    # Add owner as a member
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=owner_id,
        role="owner",
    )
    db.add(member)
    await db.flush()

    return workspace


async def get_user_workspaces(
    db: AsyncSession, user_id: uuid.UUID
) -> list[Workspace]:
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember)
        .where(WorkspaceMember.user_id == user_id)
        .order_by(Workspace.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_workspace_by_id(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> Workspace | None:
    # Verify membership
    member = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if member.scalar_one_or_none() is None:
        return None

    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    return result.scalar_one_or_none()


async def get_workspace_members(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[WorkspaceMember]:
    result = await db.execute(
        select(WorkspaceMember)
        .options(selectinload(WorkspaceMember.user))
        .where(WorkspaceMember.workspace_id == workspace_id)
    )
    return list(result.scalars().all())
