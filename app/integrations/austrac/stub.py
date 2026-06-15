"""
Stub AUSTRAC provider — logs submissions locally, returns a fake reference.
Used in development and until AUSTRAC Online API credentials are configured.
Replace with a real implementation when AUSTRAC provides API access.
"""
from __future__ import annotations

import logging
import uuid

from .base import AUSTRACProvider, SubmissionResult, SubmissionStatus

log = logging.getLogger("verigo.integrations.austrac")


class StubAUSTRACProvider(AUSTRACProvider):
    async def submit_ifti(self, payload: dict) -> SubmissionResult:
        ref = f"STUB-IFTI-{uuid.uuid4().hex[:8].upper()}"
        log.info("AUSTRAC stub: IFTI submission recorded ref=%s", ref)
        return SubmissionResult(success=True, reference=ref, status=SubmissionStatus.accepted,
                                message="Stub: not submitted to real AUSTRAC")

    async def submit_ttr(self, payload: dict) -> SubmissionResult:
        ref = f"STUB-TTR-{uuid.uuid4().hex[:8].upper()}"
        log.info("AUSTRAC stub: TTR submission recorded ref=%s", ref)
        return SubmissionResult(success=True, reference=ref, status=SubmissionStatus.accepted,
                                message="Stub: not submitted to real AUSTRAC")

    async def submit_smr(self, payload: dict) -> SubmissionResult:
        ref = f"STUB-SMR-{uuid.uuid4().hex[:8].upper()}"
        log.info("AUSTRAC stub: SMR submission recorded ref=%s", ref)
        return SubmissionResult(success=True, reference=ref, status=SubmissionStatus.accepted,
                                message="Stub: not submitted to real AUSTRAC")

    async def get_status(self, reference: str) -> SubmissionResult:
        return SubmissionResult(success=True, reference=reference,
                                status=SubmissionStatus.accepted,
                                message="Stub: status polling not implemented")
