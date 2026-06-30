import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserSyncRequest(BaseModel):
    email: str
    name: str | None = None
    avatar_url: str | None = None
    provider: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    avatar_url: str | None
    provider: str | None
    plan: str
    reports_used: int
    reports_limit: int
    industry: str | None
    onboarded: int
    brand_logo_url: str | None
    brand_primary: str | None
    brand_secondary: str | None
    brand_font: str | None
    default_pptx_theme: str | None
    created_at: datetime


class UserUpdate(BaseModel):
    industry: str | None = None
    onboarded: int | None = None
    brand_logo_url: str | None = None
    brand_primary: str | None = None
    brand_secondary: str | None = None
    brand_font: str | None = None
    default_pptx_theme: str | None = None
