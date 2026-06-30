import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from src.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    upload_id = Column(UUID(as_uuid=True), ForeignKey("uploads.id"), nullable=False)

    title = Column(String)
    hook = Column(String)
    story_json = Column(JSONB)
    story_html = Column(String)
    word_count = Column(Integer)
    findings_count = Column(Integer)

    pdf_path = Column(String)
    word_path = Column(String)
    pptx_path = Column(String)
    pptx_theme = Column(String)  # boardroom|consulting|startup|editorial|academic

    status = Column(String, default="generating", nullable=False)
    error_message = Column(String)
    is_branded = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
