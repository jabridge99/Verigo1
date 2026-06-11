"""
Abstract StorageProvider interface.
All storage adapters implement this contract — callers never reference a
concrete adapter directly, so the backend can be swapped per-tenant.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import AsyncIterator, Optional


@dataclass
class StoredObject:
    key: str           # logical path / blob name
    size: int          # bytes
    content_type: str
    url: Optional[str] = None   # pre-signed or public URL, if applicable
    etag: Optional[str] = None


class StorageProvider(abc.ABC):
    """Abstract base for all storage backends."""

    @abc.abstractmethod
    async def upload(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> StoredObject:
        """Upload bytes and return StoredObject descriptor."""

    @abc.abstractmethod
    async def download(self, key: str) -> bytes:
        """Download and return the full content of an object."""

    @abc.abstractmethod
    async def stream(self, key: str, chunk_size: int = 65_536) -> AsyncIterator[bytes]:
        """Stream object content in chunks."""

    @abc.abstractmethod
    async def delete(self, key: str) -> None:
        """Permanently delete an object."""

    @abc.abstractmethod
    async def exists(self, key: str) -> bool:
        """Return True if the object exists."""

    @abc.abstractmethod
    async def get_url(self, key: str, expires_in: int = 3600) -> str:
        """Return a pre-signed / temporary access URL (TTL in seconds)."""

    @abc.abstractmethod
    async def list_objects(self, prefix: str = "") -> list[StoredObject]:
        """List objects under a prefix."""
