"""
Social login via OAuth2 authorization-code flow (Google, Microsoft).

Requires GOOGLE_CLIENT_ID/SECRET and MICROSOFT_CLIENT_ID/SECRET to be set —
until then the corresponding /auth/oauth/{provider}/login route returns 503.
"""

import secrets
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.config import settings


@dataclass
class OAuthProfile:
    provider: str
    provider_user_id: str
    email: str
    full_name: str


@dataclass
class OAuthProviderConfig:
    name: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    scope: str
    client_id: str
    client_secret: str


def _redirect_uri(provider: str) -> str:
    return f"{settings.api_url}/api/v1/auth/oauth/{provider}/callback"


def get_provider(provider: str) -> Optional[OAuthProviderConfig]:
    if provider == "google":
        if not settings.google_client_id or not settings.google_client_secret:
            return None
        return OAuthProviderConfig(
            name="google",
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            userinfo_url="https://openidconnect.googleapis.com/v1/userinfo",
            scope="openid email profile",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
        )
    if provider == "microsoft":
        if not settings.microsoft_client_id or not settings.microsoft_client_secret:
            return None
        tenant = settings.microsoft_tenant
        return OAuthProviderConfig(
            name="microsoft",
            authorize_url=f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
            token_url=f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            userinfo_url="https://graph.microsoft.com/oidc/userinfo",
            scope="openid email profile",
            client_id=settings.microsoft_client_id,
            client_secret=settings.microsoft_client_secret,
        )
    return None


def build_authorize_url(provider: str, state: str) -> str:
    cfg = get_provider(provider)
    if not cfg:
        raise ValueError(f"OAuth provider not configured: {provider}")
    params = {
        "client_id": cfg.client_id,
        "redirect_uri": _redirect_uri(provider),
        "response_type": "code",
        "scope": cfg.scope,
        "state": state,
    }
    return f"{cfg.authorize_url}?{urlencode(params)}"


def new_state() -> str:
    return secrets.token_urlsafe(24)


def exchange_code_for_profile(provider: str, code: str) -> OAuthProfile:
    cfg = get_provider(provider)
    if not cfg:
        raise ValueError(f"OAuth provider not configured: {provider}")

    token_resp = httpx.post(
        cfg.token_url,
        data={
            "client_id": cfg.client_id,
            "client_secret": cfg.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": _redirect_uri(provider),
        },
        headers={"Accept": "application/json"},
        timeout=10,
    )
    token_resp.raise_for_status()
    access_token = token_resp.json().get("access_token")
    if not access_token:
        raise ValueError("OAuth token exchange did not return an access_token")

    userinfo_resp = httpx.get(
        cfg.userinfo_url,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    userinfo_resp.raise_for_status()
    info = userinfo_resp.json()

    return OAuthProfile(
        provider=provider,
        provider_user_id=str(info.get("sub") or info.get("id") or info.get("oid")),
        email=(info.get("email") or "").lower().strip(),
        full_name=info.get("name") or info.get("email") or "Unknown",
    )
