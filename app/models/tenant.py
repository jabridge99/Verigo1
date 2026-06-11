from sqlalchemy import Column, String, Boolean, Integer, JSON, DateTime, Text
from sqlalchemy.sql import func
from app.db.database import Base


class IndustryTenant(Base):
    __tablename__ = "industry_tenants"

    id            = Column(Integer, primary_key=True, index=True)
    tenant_id     = Column(String(60), unique=True, index=True, nullable=False)
    industry_id   = Column(String(100), unique=True, index=True, nullable=False)
    name          = Column(String(200), nullable=False)
    display_name  = Column(String(200))
    contact_email = Column(String(200))
    contact_name  = Column(String(200))
    phone         = Column(String(50))
    abn           = Column(String(20))
    austrac_id    = Column(String(100))
    pack_id       = Column(String(100))
    status        = Column(String(30), default="active")
    settings      = Column(JSON, default=dict)
    branding      = Column(JSON, default=dict)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())
