"""
Supabase Storage backend.
Uses the Supabase Python client which wraps the Storage REST API.
Bucket must be created in the Supabase dashboard (private, RLS enabled).
"""

from __future__ import annotations

import mimetypes
from typing import AsyncIterator, Optional

import httpx

from app.config import settings
from app.services.storage.base import StorageProvider, StoredObject


class SupabaseStorageProvider(StorageProvider):
    def __init__(self, bucket: str | None = None):
        self.bucket = bucket or settings.document_bucket
        self._base = f"{settings.supabase_url}/storage/v1"
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        }

    # ── helpers ──────────────────────────────────────────────────────────────

    def _object_url(self, key: str) -> str:
        return f"{self._base}/object/{self.bucket}/{key}"

    def _signed_url_endpoint(self, key: str) -> str:
        return f"{self._base}/object/sign/{self.bucket}/{key}"

    # ── interface ─────────────────────────────────────────────────────────────

    async def upload(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> StoredObject:
        headers = {**self._headers, "Content-Type": content_type}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                self._object_url(key), content=data, headers=headers
            )
            resp.raise_for_status()
        return StoredObject(key=key, size=len(data), content_type=content_type)

    async def download(self, key: str) -> bytes:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(self._object_url(key), headers=self._headers)
            resp.raise_for_status()
            return resp.content

    async def stream(self, key: str, chunk_size: int = 65_536) -> AsyncIterator[bytes]:
        async with httpx.AsyncClient(timeout=15.0) as client:
            async with client.stream(
                "GET", self._object_url(key), headers=self._headers
            ) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes(chunk_size):
                    yield chunk

    async def delete(self, key: str) -> None:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.delete(self._object_url(key), headers=self._headers)
            resp.raise_for_status()

    async def exists(self, key: str) -> bool:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.head(self._object_url(key), headers=self._headers)
            return resp.status_code == 200

    async def get_url(self, key: str, expires_in: int = 3600) -> str:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                self._signed_url_endpoint(key),
                json={"expiresIn": expires_in},
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()["signedURL"]

    async def list_objects(self, prefix: str = "") -> list[StoredObject]:
        url = f"{self._base}/object/list/{self.bucket}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                json={"prefix": prefix, "limit": 1000, "offset": 0},
                headers=self._headers,
            )
            resp.raise_for_status()
        objects = []
        for item in resp.json():
            ct = (
                mimetypes.guess_type(item.get("name", ""))[0]
                or "application/octet-stream"
            )
            objects.append(
                StoredObject(
                    key=item["name"],
                    size=item.get("metadata", {}).get("size", 0),
                    content_type=ct,
                )
            )
        return objects
