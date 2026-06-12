"""Local filesystem storage adapter — default for dev/self-hosted deployments."""

from __future__ import annotations

import asyncio
import mimetypes
from pathlib import Path
from typing import AsyncIterator, Optional

from .base import StorageProvider, StoredObject


class LocalStorageProvider(StorageProvider):
    def __init__(self, root: str):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # Prevent path traversal
        resolved = (self.root / key).resolve()
        if not str(resolved).startswith(str(self.root.resolve())):
            raise ValueError(f"Path traversal attempt: {key}")
        return resolved

    async def upload(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> StoredObject:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, data)
        return StoredObject(key=key, size=len(data), content_type=content_type)

    async def download(self, key: str) -> bytes:
        return await asyncio.to_thread(self._path(key).read_bytes)

    async def stream(self, key: str, chunk_size: int = 65_536) -> AsyncIterator[bytes]:
        path = self._path(key)

        def _iter():
            with open(path, "rb") as f:
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    yield chunk

        for chunk in await asyncio.to_thread(list, _iter()):
            yield chunk

    async def delete(self, key: str) -> None:
        path = self._path(key)
        await asyncio.to_thread(path.unlink, True)

    async def exists(self, key: str) -> bool:
        return await asyncio.to_thread(self._path(key).exists)

    async def get_url(self, key: str, expires_in: int = 3600) -> str:
        # Local adapter returns a relative API path — front-end routes through /documents API
        return f"/api/v1/documents/download/{key}"

    async def list_objects(self, prefix: str = "") -> list[StoredObject]:
        base = self._path(prefix) if prefix else self.root
        results = []
        if base.is_dir():
            for p in base.rglob("*"):
                if p.is_file():
                    rel = str(p.relative_to(self.root))
                    ct, _ = mimetypes.guess_type(str(p))
                    results.append(
                        StoredObject(
                            key=rel,
                            size=p.stat().st_size,
                            content_type=ct or "application/octet-stream",
                        )
                    )
        return results
