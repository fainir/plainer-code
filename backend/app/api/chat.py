import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.chat import ConversationCreate, ConversationResponse, MessageCreate, MessageResponse
from app.services import chat_service, workspace_service

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["chat"])


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    workspace_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    return await chat_service.get_workspace_conversations(db, workspace_id)


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    workspace_id: uuid.UUID,
    data: ConversationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    conversation = await chat_service.create_conversation(
        db, workspace_id, user.id, data.title
    )
    await db.commit()
    return conversation


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
async def list_messages(
    workspace_id: uuid.UUID,
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    conversation = await chat_service.get_conversation_by_id(db, conversation_id)
    if conversation is None or conversation.workspace_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )

    return await chat_service.get_conversation_messages(db, conversation_id)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    workspace_id: uuid.UUID,
    conversation_id: uuid.UUID,
    data: MessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace_by_id(db, workspace_id, user.id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    conversation = await chat_service.get_conversation_by_id(db, conversation_id)
    if conversation is None or conversation.workspace_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )

    message = await chat_service.add_message(
        db, conversation_id, "user", data.content, sender_id=user.id
    )
    await db.commit()
    return message
