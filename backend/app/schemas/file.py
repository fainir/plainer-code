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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FileContentResponse(BaseModel):
    id: uuid.UUID
    name: str
    content: str
    mime_type: str
    is_favorite: bool = False


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
    views_folder_id: uuid.UUID | None = None
    files_folder_id: uuid.UUID | None = None


class FileViewCreate(BaseModel):
    file_id: uuid.UUID
    view_file_id: uuid.UUID
    label: str
    position: int = 0


class FileViewResponse(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    view_file_id: uuid.UUID
    label: str
    position: int
    view_file_name: str | None = None

    model_config = {"from_attributes": True}


class AllViewsResponse(BaseModel):
    html_views: list[FileResponse]
    builtin_files: list[FileResponse]
