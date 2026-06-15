"""
Shared base types for all integrations.
Each integration module defines its own abstract provider; this module
provides the common result envelope and error hierarchy.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class IntegrationError(Exception):
    """Base error for all integration failures."""
    def __init__(self, provider: str, message: str, raw: Any = None):
        self.provider = provider
        self.raw = raw
        super().__init__(f"[{provider}] {message}")


class ProviderUnavailableError(IntegrationError):
    """Provider is unreachable or not configured."""


class ProviderRejectedError(IntegrationError):
    """Provider returned an error response (e.g. 4xx)."""


class IntegrationStatus(str, Enum):
    success = "success"
    no_match = "no_match"
    potential_match = "potential_match"
    error = "error"
    not_configured = "not_configured"


@dataclass
class IntegrationResult:
    status: IntegrationStatus
    provider: str
    raw: Any = None                  # full provider response for audit trail
    error: str | None = None
    metadata: dict = field(default_factory=dict)
