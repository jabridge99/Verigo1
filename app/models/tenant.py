from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, Column, DateTime, Integer, String
from sqlalchemy.orm import Mapped
from sqlalchemy.sql import func

from app.db.database import Base


class IndustryTenant(Base):
    __tablename__ = "industry_tenants"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[str] = Column(String(60), unique=True, index=True, nullable=False)
    industry_id: Mapped[str] = Column(
        String(100), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = Column(String(200), nullable=False)
    display_name: Mapped[Optional[str]] = Column(String(200))
    contact_email: Mapped[Optional[str]] = Column(String(200))
    contact_name: Mapped[Optional[str]] = Column(String(200))
    phone: Mapped[Optional[str]] = Column(String(50))
    abn: Mapped[Optional[str]] = Column(String(20))
    austrac_id: Mapped[Optional[str]] = Column(String(100))
    pack_id: Mapped[Optional[str]] = Column(String(100))
    status: Mapped[Optional[str]] = Column(String(30), default="active")
    settings: Mapped[Optional[Any]] = Column(JSON, default=dict)
    branding: Mapped[Optional[Any]] = Column(JSON, default=dict)
    # Per-tenant storage override — {"backend": "s3"|"azure"|"gcs"|"local", ...creds}.
    # Empty/None means the tenant uses the platform-wide default backend.
    storage_config: Mapped[Optional[Any]] = Column(JSON, default=dict)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )
