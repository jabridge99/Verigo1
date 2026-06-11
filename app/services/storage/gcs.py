"""Google Cloud Storage adapter."""

from __future__ import annotations

from typing import AsyncIterator, Optional

from .base import StorageProvider, StoredObject


class GCSStorageProvider(StorageProvider):
    def __init__(self, bucket: str, credentials_json: Optional[str] = None):
        """
        credentials_json: path to service-account JSON file, or None for ADC.
        """
        try:
            from google.cloud import storage as gcs
        except ImportError:
            raise RuntimeError("google-cloud-storage is required: pip install google-cloud-storage")
        import asyncio
        if credentials_json:
            from google.oauth2 import service_account
            creds = service_account.Credentials.from_service_account_file(credentials_json)
            self._client = gcs.Client(credentials=creds)
        else:
            self._client = gcs.Client()
        self._bucket = self._client.bucket(bucket)
        self._loop = asyncio.get_event_loop

    def _blob(self, key: str):
        return self._bucket.blob(key)

    async def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream",
                     metadata: Optional[dict] = None) -> StoredObject:
        import asyncio
        blob = self._blob(key)
        if metadata:
            blob.metadata = metadata
        await asyncio.to_thread(blob.upload_from_string, data, content_type=content_type)
        return StoredObject(key=key, size=len(data), content_type=content_type)

    async def download(self, key: str) -> bytes:
        import asyncio
        return await asyncio.to_thread(self._blob(key).download_as_bytes)

    async def stream(self, key: str, chunk_size: int = 65_536) -> AsyncIterator[bytes]:
        data = await self.download(key)
        for i in range(0, len(data), chunk_size):
            yield data[i: i + chunk_size]

    async def delete(self, key: str) -> None:
        import asyncio
        await asyncio.to_thread(self._blob(key).delete)

    async def exists(self, key: str) -> bool:
        import asyncio
        return await asyncio.to_thread(self._blob(key).exists)

    async def get_url(self, key: str, expires_in: int = 3600) -> str:
        import asyncio
        from datetime import timedelta
        return await asyncio.to_thread(
            self._blob(key).generate_signed_url,
            expiration=timedelta(seconds=expires_in),
            method="GET",
            version="v4",
        )

    async def list_objects(self, prefix: str = "") -> list[StoredObject]:
        import asyncio
        blobs = await asyncio.to_thread(list, self._client.list_blobs(self._bucket, prefix=prefix))
        return [
            StoredObject(
                key=b.name,
                size=b.size or 0,
                content_type=b.content_type or "application/octet-stream",
                etag=b.etag,
            )
            for b in blobs
        ]
