from datetime import datetime

from pydantic import BaseModel, Field


class IntegrationEnable(BaseModel):
    credentials: dict = Field(
        ..., description="Provider credentials (encrypted at rest)"
    )
    config: dict = Field(
        default_factory=dict, description="Non-sensitive configuration"
    )
    credential_expires_at: datetime | None = Field(
        None, description="Vendor-stated API key expiry, if known"
    )


class OAuthCallback(BaseModel):
    code: str
    state: str


class IntegrationUpdate(BaseModel):
    config: dict | None = None


class CredentialRotation(BaseModel):
    new_credentials: dict = Field(
        ..., description="New credentials to replace existing"
    )
    reason: str = Field(..., min_length=5)
    credential_expires_at: datetime | None = None
