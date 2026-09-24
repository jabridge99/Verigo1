"""
Real, provider-specific credential verification for the Integration Hub.

P45 found `POST /{slug}/test` faked success for every provider in the
48-provider catalog -- it never called anything, just checked
`bool(credentials_encrypted)`. That was fixed by making it honestly
report `health_status=unknown` for providers with no real check wired up.

This module is the "wired up" half, for the providers where VeriGo
already has a real, working adapter class elsewhere in the codebase
(sanctions/crypto screening, ABR lookup) plus two providers whose
"real check" is a standard, well-documented credential-verification call
(Twilio's account-fetch; an SMTP auth handshake for the two email relays).
Each check makes one genuine, read-only call against the real vendor API
using the org's own stored credentials -- never against VeriGo's own
platform-wide provider configuration (`app.config.settings`), which stays
untouched and keeps governing what the app's actual screening/KYC/email
pipelines use. A passing test here only proves "these credentials work
against this vendor", nothing more.

IMPORTANT: none of these checks have been run against a real vendor
account from this session -- there was neither a real API key for any of
them nor confirmed outbound network access to most of these domains from
this sandbox. Each one is real client code following the vendor's actual
documented auth scheme (the same adapters already used, and verified,
elsewhere in this codebase for Sumsub/ComplyAdvantage/Chainalysis/
Elliptic/ABR), exercised in tests via mocked HTTP/SMTP, not a live vendor
call. Confirm against a real account before relying on it.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib

import httpx

from app.config import settings
from app.integrations.abr.abn_lookup import ABNLookupProvider
from app.integrations.base import ProviderRejectedError, ProviderUnavailableError
from app.integrations.crypto.chainalysis import ChainalysisProvider
from app.integrations.crypto.elliptic import EllipticProvider
from app.integrations.identity.sumsub import SumsubProvider
from app.integrations.sanctions.complyadvantage import ComplyAdvantageProvider

log = logging.getLogger("verigo.services.integration_verify")

# A well-known, safe-to-query, real Bitcoin address (the genesis block
# coinbase address) -- used only as a harmless input to prove the crypto
# screening APIs accept the credentials, never as a real risk check.
_TEST_BTC_ADDRESS = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"


def _missing(credentials: dict, *keys: str) -> str | None:
    missing = [k for k in keys if not credentials.get(k)]
    if missing:
        return f"Missing required field(s): {', '.join(missing)}."
    return None


async def _verify_sumsub(credentials: dict) -> tuple[bool, str]:
    if err := _missing(credentials, "app_token", "secret_key"):
        return False, err
    try:
        provider = SumsubProvider(
            app_token=credentials["app_token"],
            secret_key=credentials["secret_key"],
            base_url=settings.sumsub_base_url,
        )
        await provider.generate_access_token(
            "verigo-connection-test", settings.sumsub_level_name, ttl_seconds=60
        )
        return True, "Sumsub accepted the credentials and issued a test access token."
    except ProviderUnavailableError as exc:
        return False, str(exc)
    except ProviderRejectedError as exc:
        msg = (
            f"Sumsub rejected the request: {exc}. If the credentials are correct, "
            f"confirm your account has a level named "
            f"{settings.sumsub_level_name!r} (VeriGo's default level name) -- "
            "a missing level looks identical to bad credentials here."
        )
        return False, msg
    except Exception as exc:  # noqa: BLE001 -- report, never crash the request
        return False, f"Could not reach Sumsub: {exc}"


async def _verify_complyadvantage(credentials: dict) -> tuple[bool, str]:
    if err := _missing(credentials, "api_key"):
        return False, err
    try:
        provider = ComplyAdvantageProvider(api_key=credentials["api_key"])
        await provider.screen("Verigo Connection Test")
        return (
            True,
            "ComplyAdvantage accepted the credentials and returned a search result.",
        )
    except ProviderRejectedError as exc:
        return False, f"ComplyAdvantage rejected the request: {exc}"
    except Exception as exc:  # noqa: BLE001
        return False, f"Could not reach ComplyAdvantage: {exc}"


async def _verify_chainalysis(credentials: dict) -> tuple[bool, str]:
    if err := _missing(credentials, "api_key"):
        return False, err
    try:
        provider = ChainalysisProvider(api_key=credentials["api_key"])
        await provider.screen_address(_TEST_BTC_ADDRESS, network="bitcoin")
        return (
            True,
            "Chainalysis accepted the credentials and returned a screening result.",
        )
    except ProviderUnavailableError as exc:
        return False, str(exc)
    except ProviderRejectedError as exc:
        return False, f"Chainalysis rejected the request: {exc}"
    except Exception as exc:  # noqa: BLE001
        return False, f"Could not reach Chainalysis: {exc}"


async def _verify_elliptic(credentials: dict) -> tuple[bool, str]:
    if err := _missing(credentials, "api_key", "api_secret"):
        return False, err
    try:
        provider = EllipticProvider(
            api_key=credentials["api_key"], api_secret=credentials["api_secret"]
        )
        await provider.screen_address(_TEST_BTC_ADDRESS, network="bitcoin")
        return (
            True,
            "Elliptic accepted the credentials and returned a screening result.",
        )
    except ProviderUnavailableError as exc:
        return False, str(exc)
    except ProviderRejectedError as exc:
        return False, f"Elliptic rejected the request: {exc}"
    except Exception as exc:  # noqa: BLE001
        return False, f"Could not reach Elliptic: {exc}"


async def _verify_abr(credentials: dict) -> tuple[bool, str]:
    if err := _missing(credentials, "guid"):
        return False, err
    try:
        provider = ABNLookupProvider(guid=credentials["guid"])
        # Single word deliberately: search_by_name() builds its query string
        # by raw f-string interpolation with no URL-encoding, so a
        # multi-word name would break here on a real call -- a separate,
        # pre-existing gap in abn_lookup.py (see PARKING_LOT.md), not
        # something to fix as part of this check.
        #
        # search_by_name() never raises ProviderRejectedError even for an
        # invalid GUID -- ABR's API returns HTTP 200 with an <exception>
        # element embedded in the XML for that case, and this method (unlike
        # lookup_abn/lookup_acn) doesn't parse for it -- another pre-existing
        # gap in abn_lookup.py, not fixed here. So this can only confirm the
        # ABR web service was reachable and returned a well-formed response,
        # not that the GUID itself is genuinely valid.
        await provider.search_by_name("Woolworths")
        return (
            True,
            "ABR web service reachable and responded. Note: ABR's search "
            "API doesn't distinguish an invalid GUID from a valid search "
            "with zero results, so this doesn't fully confirm the GUID is "
            "genuinely valid.",
        )
    except ProviderRejectedError as exc:
        return False, f"ABR rejected the request: {exc}"
    except Exception as exc:  # noqa: BLE001
        return False, f"Could not reach the ABR web service: {exc}"


async def _verify_twilio(credentials: dict) -> tuple[bool, str]:
    if err := _missing(credentials, "account_sid", "auth_token"):
        return False, err
    account_sid = credentials["account_sid"]
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}.json"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, auth=(account_sid, credentials["auth_token"]))
        if resp.status_code == 200:
            return True, "Twilio accepted the credentials for this Account SID."
        if resp.status_code == 401:
            return False, "Twilio rejected the Account SID / Auth Token combination."
        return False, f"Twilio returned an unexpected status: {resp.status_code}."
    except Exception as exc:  # noqa: BLE001
        return False, f"Could not reach Twilio: {exc}"


async def _verify_smtp_relay(credentials: dict) -> tuple[bool, str]:
    """Shared check for SendGrid/SES -- both are used via SMTP relay in this
    app (see app/integrations/email/smtp.py). Performs EHLO+STARTTLS+LOGIN
    only; never sends a message."""
    if err := _missing(credentials, "smtp_host", "smtp_username", "smtp_password"):
        return False, err
    host = credentials["smtp_host"]
    username = credentials["smtp_username"]
    password = credentials["smtp_password"]

    def _connect_and_login() -> None:
        with smtplib.SMTP(host, 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(username, password)

    try:
        await asyncio.to_thread(_connect_and_login)
        return True, f"Authenticated with {host} over SMTP (no message sent)."
    except smtplib.SMTPAuthenticationError as exc:
        return False, f"{host} rejected the SMTP username/password: {exc}"
    except Exception as exc:  # noqa: BLE001
        return False, f"Could not reach {host}: {exc}"


# Slugs with a real check wired up. Every other provider in the catalog
# keeps the honest "not built yet" response from POST /{slug}/test.
VERIFIERS = {
    "sumsub": _verify_sumsub,
    "complyadvantage": _verify_complyadvantage,
    "chainalysis": _verify_chainalysis,
    "elliptic": _verify_elliptic,
    "abr": _verify_abr,
    "twilio_sms": _verify_twilio,
    "sendgrid": _verify_smtp_relay,
    "ses": _verify_smtp_relay,
}


async def verify_credentials(slug: str, credentials: dict) -> tuple[bool, str] | None:
    """Returns (passed, message), or None if no real check exists for this slug."""
    verifier = VERIFIERS.get(slug)
    if verifier is None:
        return None
    return await verifier(credentials)
