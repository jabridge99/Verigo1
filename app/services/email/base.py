"""
Abstract EmailProvider interface.
All email adapters implement this contract — callers never reference a
concrete adapter directly, so the backend can be swapped via settings.
"""

from __future__ import annotations

import abc


class EmailProvider(abc.ABC):
    """Abstract base for all transactional email backends."""

    @abc.abstractmethod
    def send(self, to: str, subject: str, html: str) -> bool:
        """Send an HTML email. Returns True on success, False on failure."""
