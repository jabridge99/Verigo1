"""
White-label branding service.

Branding config is stored as JSON in IndustryTenant.branding.
The /api/v1/branding public endpoint is intentionally unauthenticated so
the frontend can fetch it before the user logs in.
"""

from typing import Optional

from sqlalchemy.orm import Session

from app.models.tenant import IndustryTenant
from app.schemas.branding import BrandingConfig

# Default branding — returned when no tenant overrides are set
DEFAULT_BRANDING: dict = {
    "company_name": "Verigo",
    "logo_url": None,
    "favicon_url": None,
    "primary_color": "#2563eb",
    "accent_color": "#f59e0b",
    "bg_color": "#060d1a",
    "custom_domain": None,
    "support_email": "support@verigo.com.au",
    "footer_text": "Australian Compliance Operating System",
    "hide_verigo_badge": False,
}


def _tenant(db: Session, industry_id: str) -> Optional[IndustryTenant]:
    return (
        db.query(IndustryTenant)
        .filter(
            IndustryTenant.industry_id == industry_id,
            IndustryTenant.status == "active",
        )
        .first()
    )


def get_branding(db: Session, industry_id: Optional[str]) -> dict:
    base = dict(DEFAULT_BRANDING)
    if not industry_id:
        return base
    tenant = _tenant(db, industry_id)
    if not tenant or not tenant.branding:
        return base
    # Merge: tenant values override defaults (None values keep default)
    for k, v in tenant.branding.items():
        if v is not None:
            base[k] = v
    base["tenant_id"] = tenant.tenant_id
    base["industry_id"] = tenant.industry_id
    return base


def update_branding(db: Session, industry_id: str, data: BrandingConfig) -> dict:
    tenant = _tenant(db, industry_id)
    if not tenant:
        raise ValueError(f"No active tenant found for industry_id={industry_id}")
    current = dict(tenant.branding or {})
    updates = data.model_dump(exclude_unset=True)
    current.update(updates)
    tenant.branding = current
    db.commit()
    db.refresh(tenant)
    return get_branding(db, industry_id)


def reset_branding(db: Session, industry_id: str) -> dict:
    tenant = _tenant(db, industry_id)
    if not tenant:
        raise ValueError(f"No active tenant found for industry_id={industry_id}")
    tenant.branding = {}
    db.commit()
    return dict(DEFAULT_BRANDING)


def preview_css_vars(branding: dict) -> str:
    """Generate CSS custom property block from a branding config."""
    lines = [":root {"]
    if branding.get("primary_color"):
        lines.append(f"  --color-primary: {branding['primary_color']};")
    if branding.get("accent_color"):
        lines.append(f"  --color-accent: {branding['accent_color']};")
    if branding.get("bg_color"):
        lines.append(f"  --color-bg: {branding['bg_color']};")
    lines.append("}")
    return "\n".join(lines)
