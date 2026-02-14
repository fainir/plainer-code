import uuid
from datetime import datetime

from pydantic import BaseModel


class FileCreate(BaseModel):
    name: str
    content: str
    folder_id: uuid.UUID | None = None


class FileResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    workspace_id: uuid.UUID
    folder_id: uuid.UUID | None
    name: str
    mime_type: str
    size_bytes: int
    file_type: str
    is_vibe_file: bool
    is_favorite: bool
    created_by_agent: bool
    is_instance: bool = False
    app_type_id: uuid.UUID | None = None
    app_type_slug: str | None = None
    source_file_id: uuid.UUID | None = None
    related_source_ids: list[uuid.UUID] | None = None
    instance_config: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FileContentUpdate(BaseModel):
    content: str


class FileContentResponse(BaseModel):
    id: uuid.UUID
    name: str
    content: str
    mime_type: str
    is_favorite: bool = False
    is_instance: bool = False
    app_type_slug: str | None = None
    source_file_id: uuid.UUID | None = None
    instance_config: str | None = None


class FolderCreate(BaseModel):
    name: str
    parent_id: uuid.UUID | None = None


class FolderResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    workspace_id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    path: str
    is_favorite: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ShareRequest(BaseModel):
    email: str
    permission: str = "view"


class ShareResponse(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID | None = None
    folder_id: uuid.UUID | None = None
    shared_with_id: uuid.UUID
    permission: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DriveResponse(BaseModel):
    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    files_folder_id: uuid.UUID | None = None


# ── App Types & Instances ──────────────────────────────

class AppTypeResponse(BaseModel):
    id: uuid.UUID
    slug: str
    label: str
    icon: str
    renderer: str
    description: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AppTypeCreate(BaseModel):
    slug: str
    label: str
    icon: str = "eye"
    renderer: str = "html-template"
    template_content: str | None = None
    description: str | None = None


class InstanceCreate(BaseModel):
    source_file_id: uuid.UUID | None = None
    related_source_ids: list[uuid.UUID] | None = None
    app_type_id: uuid.UUID | None = None
    app_type_slug: str | None = None
    name: str | None = None
    config: str | None = None
    content: str | None = None


class InstanceConfigUpdate(BaseModel):
    config: str
