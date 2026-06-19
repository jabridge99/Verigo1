"""
Abstract interface for AUSTRAC regulatory reporting.
Covers IFTI, TTR, and SMR lodgement via AUSTRAC Online API.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from enum import Enum
from typing import Any


class SubmissionStatus(str, Enum):
    accepted = "accepted"
    pending = "pending"
    rejected = "rejected"
    unknown = "unknown"


@dataclass
class SubmissionResult:
    success: bool
    reference: str | None  # AUSTRAC lodgement reference number
    status: SubmissionStatus
    message: str | None = None
    raw: Any = None  # full API response for audit trail


class AUSTRACProvider(abc.ABC):
    """Abstract AUSTRAC Online API provider."""

    @abc.abstractmethod
    async def submit_ifti(self, payload: dict) -> SubmissionResult:
        """Lodge an IFTI-DRA IN or OUT report."""

    @abc.abstractmethod
    async def submit_ttr(self, payload: dict) -> SubmissionResult:
        """Lodge a Threshold Transaction Report."""

    @abc.abstractmethod
    async def submit_smr(self, payload: dict) -> SubmissionResult:
        """Lodge a Suspicious Matter Report."""

    @abc.abstractmethod
    async def get_status(self, reference: str) -> SubmissionResult:
        """Poll submission status by AUSTRAC reference number."""
