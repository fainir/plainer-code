import uuid
from datetime import datetime

from pydantic import BaseModel


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str | None
    is_active: bool
    created_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_type: str
    sender_id: uuid.UUID | None
    content: str
    metadata_json: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}
