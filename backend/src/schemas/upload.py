import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    filename: str
    file_type: str | None
    data_type: str | None
    file_size_bytes: int | None
    row_count: int | None
    column_count: int | None
    status: str
    error_message: str | None
    created_at: datetime


class UploadPreview(BaseModel):
    upload_id: uuid.UUID
    columns: list[str] = []
    rows: list[dict] = []
    text_preview: str | None = None
    file_type: str
    data_type: str
    row_count: int | None = None
    column_count: int | None = None


class UploadStatusOut(BaseModel):
    upload_id: uuid.UUID
    status: str
    report_id: uuid.UUID | None = None
    message: str | None = None
