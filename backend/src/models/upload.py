import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from src.core.database import Base


class Upload(Base):
    __tablename__ = "uploads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    filename = Column(String, nullable=False)
    file_type = Column(String)  # csv|excel|xml|pdf|docx|image|json
    data_type = Column(String)  # structured|semi_structured|unstructured
    file_size_bytes = Column(Integer)
    row_count = Column(Integer)
    column_count = Column(Integer)
    storage_path = Column(String, nullable=False)

    status = Column(String, default="pending", nullable=False)  # pending|processing|done|failed
    error_message = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
