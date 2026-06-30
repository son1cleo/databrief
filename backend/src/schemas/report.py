import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ReportConfigRequest(BaseModel):
    upload_id: uuid.UUID
    formats: list[str] = ["pdf"]  # pdf always implied; can include word, pptx
    pptx_theme: str | None = "boardroom"
    apply_brand_kit: bool = False
    industry: str | None = None
    question: str | None = None


class ReportListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    hook: str | None
    word_count: int | None
    findings_count: int | None
    status: str
    pptx_theme: str | None
    is_branded: bool
    created_at: datetime


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    upload_id: uuid.UUID
    title: str | None
    hook: str | None
    story_json: dict[str, Any] | None
    story_html: str | None
    word_count: int | None
    findings_count: int | None
    status: str
    error_message: str | None
    pptx_theme: str | None
    is_branded: bool
    created_at: datetime
    updated_at: datetime
