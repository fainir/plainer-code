import uuid
from datetime import datetime

from pydantic import BaseModel


class MarketplaceItemResponse(BaseModel):
    id: uuid.UUID
    item_type: str
    slug: str
    name: str
    description: str
    icon: str
    category: str
    is_builtin: bool
    is_featured: bool
    install_count: int
    sort_order: int
    status: str
    created_by_id: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MarketplaceItemDetail(MarketplaceItemResponse):
    content: str | None = None


class MarketplaceItemCreate(BaseModel):
    item_type: str
    slug: str
    name: str
    description: str
    icon: str = "package"
    category: str = "general"
    content: str | None = None


class MarketplaceUseRequest(BaseModel):
    folder_id: uuid.UUID | None = None
    file_id: uuid.UUID | None = None


class MarketplaceUseResponse(BaseModel):
    action: str
    file_id: uuid.UUID | None = None
    folder_id: uuid.UUID | None = None
    app_type_id: uuid.UUID | None = None
    prompt: str | None = None
