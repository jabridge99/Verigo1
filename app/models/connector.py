"""
Connector Credential model.
Stores per-tenant API keys for external identity/AML/business verification providers.
Credentials are stored encrypted; only the last 4 chars of the key are kept in plaintext.
"""

import enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql import func

from app.db.database import Base


class ConnectorProvider(str, enum.Enum):
    # Identity verification
    greenid = "greenid"
    sumsub = "sumsub"
    trulioo = "trulioo"
    jumio = "jumio"
    onfido = "onfido"
    # AML / sanctions
    complyadvantage = "complyadvantage"
    lexisnexis = "lexisnexis"
    dowjones = "dowjones"
    worldcheck = "worldcheck"  # Refinitiv / LSEG
    # Business verification
    creditorwatch = "creditorwatch"
    equifax_au = "equifax_au"
    # Address / geocode
    loqate = "loqate"
    google_maps = "google_maps"
    # Email / SMS
    sendgrid = "sendgrid"
    twilio = "twilio"


class ConnectorStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    error = "error"


class ConnectorCredential(Base):
    __tablename__ = "connector_credentials"

    id = Column(Integer, primary_key=True, index=True)
    credential_id = Column(String(60), unique=True, index=True, nullable=False)
    industry_id = Column(String(60), index=True, nullable=False)  # tenant scope
    organisation_id = Column(String(36), ForeignKey("organisations.id"), index=True)
    provider = Column(SAEnum(ConnectorProvider), nullable=False, index=True)
    label = Column(String(200))  # friendly name
    # Encrypted credential blob (Fernet or AES-GCM in prod)
    encrypted_credentials = Column(Text, nullable=False)
    key_hint = Column(String(10))  # last 4 chars, display only
    status = Column(SAEnum(ConnectorStatus), default=ConnectorStatus.inactive)
    is_default = Column(
        Boolean, default=False
    )  # tenant's default for this provider type
    last_tested_at = Column(DateTime(timezone=True))
    last_error = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(60))
