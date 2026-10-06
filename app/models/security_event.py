from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped
from sqlalchemy.sql import func

from app.db.database import Base


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    event_id: Mapped[str] = Column(String(60), unique=True, index=True, nullable=False)
    event_type: Mapped[str] = Column(String(100), nullable=False, index=True)
    user_id: Mapped[Optional[str]] = Column(String(60), index=True)
    ip_address: Mapped[Optional[str]] = Column(String(60))
    extra_metadata: Mapped[Optional[str]] = Column(Text)  # JSON string
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
