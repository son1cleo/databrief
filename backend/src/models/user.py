import uuid

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from src.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String)
    avatar_url = Column(String)
    provider = Column(String)  # 'google' | 'github'

    plan = Column(String, default="free", nullable=False)  # free|starter|growth|business
    reports_used = Column(Integer, default=0, nullable=False)
    reports_limit = Column(Integer, default=3, nullable=False)

    stripe_customer_id = Column(String)
    stripe_sub_id = Column(String)

    industry = Column(String)
    onboarded = Column(Integer, default=0, nullable=False)  # 0/1 boolean flag

    brand_logo_url = Column(String)
    brand_primary = Column(String)
    brand_secondary = Column(String)
    brand_font = Column(String)
    default_pptx_theme = Column(String, default="boardroom")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
