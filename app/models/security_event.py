from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(60), unique=True, index=True, nullable=False)
    event_type = Column(String(100), nullable=False, index=True)
    user_id = Column(String(60), index=True)
    ip_address = Column(String(60))
    extra_metadata = Column(Text)  # JSON string
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
