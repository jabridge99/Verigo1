from datetime import datetime

from pydantic import BaseModel

from app.models.connector import ConnectorProvider, ConnectorStatus


class ConnectorCreate(BaseModel):
    provider: ConnectorProvider
    credentials: dict  # plaintext — accepted once, immediately encrypted
    label: str | None = None
    is_default: bool = False


class ConnectorUpdate(BaseModel):
    credentials: dict | None = None
    label: str | None = None
    is_default: bool | None = None


class ConnectorResponse(BaseModel):
    credential_id: str
    industry_id: str
    provider: ConnectorProvider
    label: str | None
    key_hint: str | None
    status: ConnectorStatus
    is_default: bool
    last_tested_at: datetime | None
    last_error: str | None
    created_at: datetime | None

    class Config:
        from_attributes = True
