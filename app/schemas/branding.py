import re
from typing import Optional

from pydantic import BaseModel, field_validator


class BrandingConfig(BaseModel):
    """All fields are optional — only provided fields are applied."""
    company_name:   Optional[str] = None    # Replaces "Verigo" in UI
    logo_url:       Optional[str] = None    # Absolute URL or data URI
    favicon_url:    Optional[str] = None
    primary_color:  Optional[str] = None    # Hex colour e.g. #2563eb
    accent_color:   Optional[str] = None    # Secondary accent
    bg_color:       Optional[str] = None    # App background override
    custom_domain:  Optional[str] = None    # e.g. compliance.acmecorp.com
    support_email:  Optional[str] = None
    footer_text:    Optional[str] = None    # Replaces default footer tagline
    hide_verigo_badge: bool = False            # Remove "Powered by Verigo"

    @field_validator("primary_color", "accent_color", "bg_color", mode="before")
    @classmethod
    def must_be_hex(cls, v):
        if v and not re.match(r"^#[0-9a-fA-F]{3,8}$", v):
            raise ValueError("Color must be a valid hex value e.g. #2563eb")
        return v


class BrandingResponse(BrandingConfig):
    tenant_id: Optional[str] = None
    industry_id: Optional[str] = None

    model_config = {"from_attributes": True}
