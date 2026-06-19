"""
Sumsub KYC/KYB provider.
Docs: https://docs.sumsub.com/reference/about-sumsub-api
Set IDENTITY_PROVIDER=sumsub, SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY in env.

Sumsub signs every request with HMAC-SHA256 over
    ts + METHOD + path(+query) + body
and signs every webhook with HMAC-SHA256 over the raw request body, sent in
the `x-payload-digest` header. Both use the same SUMSUB_SECRET_KEY.
"""

from __future__ import annotations

import hashlib
import hmac
import json as json_lib
import logging
import time

import httpx

from app.integrations.base import ProviderRejectedError, ProviderUnavailableError

from .base import ApplicantToken, IdentityProvider, VerificationStatus

log = logging.getLogger("verigo.integrations.identity.sumsub")

# Sumsub reviewResult.reviewAnswer values
_PASS = {"GREEN"}
_FAIL = {"RED"}


class SumsubProvider(IdentityProvider):
    name = "sumsub"

    def __init__(self, app_token: str, secret_key: str, base_url: str):
        if not app_token or not secret_key:
            raise ProviderUnavailableError(
                "sumsub", "SUMSUB_APP_TOKEN / SUMSUB_SECRET_KEY not configured"
            )
        self.app_token = app_token
        self.secret_key = secret_key
        self.base_url = base_url.rstrip("/")

    def _sign(self, method: str, path: str, body: bytes) -> dict:
        ts = str(int(time.time()))
        to_sign = ts.encode() + method.upper().encode() + path.encode() + body
        sig = hmac.new(self.secret_key.encode(), to_sign, hashlib.sha256).hexdigest()
        return {
            "X-App-Token": self.app_token,
            "X-App-Access-Sig": sig,
            "X-App-Access-Ts": ts,
        }

    async def _request(self, method: str, path: str, json: dict | None = None) -> dict:
        body = json_lib.dumps(json).encode() if json is not None else b""
        headers = self._sign(method, path, body)
        headers["Content-Type"] = "application/json"
        async with httpx.AsyncClient(timeout=15, base_url=self.base_url) as client:
            resp = await client.request(
                method, path, content=body or None, headers=headers
            )
        if resp.status_code >= 400:
            raise ProviderRejectedError(
                "sumsub", f"{resp.status_code}: {resp.text}", raw=resp.text
            )
        return resp.json() if resp.content else {}

    async def create_applicant(
        self,
        external_user_id: str,
        level_name: str,
        fixed_info: dict | None = None,
    ) -> str:
        path = f"/resources/applicants?levelName={level_name}"
        body = {"externalUserId": external_user_id}
        if fixed_info:
            body["fixedInfo"] = fixed_info
        data = await self._request("POST", path, json=body)
        return data["id"]

    async def generate_access_token(
        self,
        applicant_external_user_id: str,
        level_name: str,
        ttl_seconds: int = 600,
    ) -> ApplicantToken:
        path = (
            f"/resources/accessTokens?userId={applicant_external_user_id}"
            f"&levelName={level_name}&ttlInSecs={ttl_seconds}"
        )
        data = await self._request("POST", path)
        return ApplicantToken(
            token=data["token"],
            applicant_id=applicant_external_user_id,
            provider=self.name,
            expires_in_seconds=ttl_seconds,
            raw=data,
        )

    async def get_applicant_status(self, applicant_id: str) -> VerificationStatus:
        path = f"/resources/applicants/{applicant_id}/status"
        data = await self._request("GET", path)
        return self._status_from_review(applicant_id, None, data.get("review", data))

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        expected = hmac.new(
            self.secret_key.encode(), payload, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature or "")

    def parse_webhook_event(self, payload: dict) -> VerificationStatus:
        applicant_id = payload.get("applicantId", "")
        external_user_id = payload.get("externalUserId")
        return self._status_from_review(
            applicant_id, external_user_id, payload.get("reviewResult", payload)
        )

    def _status_from_review(
        self, applicant_id: str, external_user_id: str | None, review: dict
    ) -> VerificationStatus:
        review_result = (
            review.get("reviewResult", {}) if "reviewResult" in review else review
        )
        answer = (
            review_result.get("reviewAnswer")
            if isinstance(review_result, dict)
            else None
        )
        if answer in _PASS:
            normalised = "pass"
        elif answer in _FAIL:
            normalised = "fail"
        else:
            normalised = None
        return VerificationStatus(
            applicant_id=applicant_id,
            external_user_id=external_user_id,
            review_status=review.get("reviewStatus", "unknown"),
            review_result=normalised,
            rejection_labels=(
                review_result.get("rejectLabels", [])
                if isinstance(review_result, dict)
                else []
            ),
            raw=review,
        )
