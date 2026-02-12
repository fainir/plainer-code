import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import Conversation, Message


async def create_conversation(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    created_by_id: uuid.UUID,
    title: str | None = None,
) -> Conversation:
    conversation = Conversation(
        workspace_id=workspace_id,
        title=title or "New conversation",
        created_by_id=created_by_id,
    )
    db.add(conversation)
    await db.flush()
    return conversation


async def get_workspace_conversations(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[Conversation]:
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.workspace_id == workspace_id,
            Conversation.is_active.is_(True),
        )
        .order_by(Conversation.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_conversation_by_id(
    db: AsyncSession, conversation_id: uuid.UUID
) -> Conversation | None:
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    return result.scalar_one_or_none()


async def add_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    sender_type: str,
    content: str,
    sender_id: uuid.UUID | None = None,
    metadata_json: dict | None = None,
) -> Message:
    message = Message(
        conversation_id=conversation_id,
        sender_type=sender_type,
        sender_id=sender_id,
        content=content,
        metadata_json=metadata_json,
    )
    db.add(message)
    await db.flush()
    return message


async def get_conversation_messages(
    db: AsyncSession, conversation_id: uuid.UUID, limit: int = 100
) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    return list(result.scalars().all())
