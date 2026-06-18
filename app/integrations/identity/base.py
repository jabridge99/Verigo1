"""Abstract interface for identity verification (KYC/KYB) providers."""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ApplicantToken:
    """Short-lived credential the frontend uses to launch the provider's
    hosted verification flow (SDK or WebSDK link) for a given customer."""
    token: str
    applicant_id: str
    provider: str
    expires_in_seconds: int | None = None
    raw: Any = None


@dataclass
class VerificationStatus:
    applicant_id: str
    review_status: str           # provider-native status string (init/pending/completed/...)
    review_result: str | None    # normalised to "pass" / "fail" / None (still pending)
    external_user_id: str | None = None   # our own correlation id (Customer.id), if present
    rejection_labels: list[str] = field(default_factory=list)
    raw: Any = None


class IdentityProvider(abc.ABC):
    """A provider performs hosted KYC/KYB verification for a single applicant
    (one applicant per customer, or per business for KYB) and reports results
    back via webhook."""

    name: str = "internal"

    @abc.abstractmethod
    async def create_applicant(
        self,
        external_user_id: str,
        level_name: str,
        fixed_info: dict | None = None,
    ) -> str:
        """Create (or fetch existing) applicant. Returns the provider applicant_id."""

    @abc.abstractmethod
    async def generate_access_token(
        self,
        applicant_external_user_id: str,
        level_name: str,
    ) -> ApplicantToken:
        """Generate a one-time token for the customer-facing verification widget."""

    @abc.abstractmethod
    async def get_applicant_status(self, applicant_id: str) -> VerificationStatus:
        """Poll the provider for the current review status of an applicant."""

    @abc.abstractmethod
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Validate the HMAC signature on an inbound webhook payload."""

    @abc.abstractmethod
    def parse_webhook_event(self, payload: dict) -> VerificationStatus:
        """Normalise a provider webhook body into a VerificationStatus."""
