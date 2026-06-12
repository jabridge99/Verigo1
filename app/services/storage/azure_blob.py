"""Azure Blob Storage adapter."""

from __future__ import annotations

from typing import AsyncIterator, Optional

from .base import StorageProvider, StoredObject


class AzureBlobStorageProvider(StorageProvider):
    def __init__(self, account_name: str, account_key: str, container: str):
        try:
            from azure.storage.blob.aio import BlobServiceClient
        except ImportError:
            raise RuntimeError(
                "azure-storage-blob is required: pip install azure-storage-blob"
            )
        conn_str = (
            f"DefaultEndpointsProtocol=https;AccountName={account_name};"
            f"AccountKey={account_key};EndpointSuffix=core.windows.net"
        )
        self._client = BlobServiceClient.from_connection_string(conn_str)
        self.container = container

    async def upload(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> StoredObject:
        async with self._client:
            blob = self._client.get_blob_client(self.container, key)
            await blob.upload_blob(
                data,
                overwrite=True,
                content_settings={"content_type": content_type},
                metadata=metadata,
            )
        return StoredObject(key=key, size=len(data), content_type=content_type)

    async def download(self, key: str) -> bytes:
        async with self._client:
            blob = self._client.get_blob_client(self.container, key)
            stream = await blob.download_blob()
            return await stream.readall()

    async def stream(self, key: str, chunk_size: int = 65_536) -> AsyncIterator[bytes]:
        async with self._client:
            blob = self._client.get_blob_client(self.container, key)
            stream = await blob.download_blob()
            async for chunk in stream.chunks():
                yield chunk

    async def delete(self, key: str) -> None:
        async with self._client:
            blob = self._client.get_blob_client(self.container, key)
            await blob.delete_blob()

    async def exists(self, key: str) -> bool:
        async with self._client:
            blob = self._client.get_blob_client(self.container, key)
            return await blob.exists()

    async def get_url(self, key: str, expires_in: int = 3600) -> str:
        from datetime import datetime, timedelta, timezone

        from azure.storage.blob import BlobSasPermissions, generate_blob_sas

        # SAS generation is sync; acceptable for URL-only calls
        sas = generate_blob_sas(
            account_name=self._client.account_name,
            container_name=self.container,
            blob_name=key,
            account_key=self._client.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(seconds=expires_in),
        )
        return (
            f"https://{self._client.account_name}.blob.core.windows.net"
            f"/{self.container}/{key}?{sas}"
        )

    async def list_objects(self, prefix: str = "") -> list[StoredObject]:
        results = []
        async with self._client:
            container_client = self._client.get_container_client(self.container)
            async for blob in container_client.list_blobs(name_starts_with=prefix):
                results.append(
                    StoredObject(
                        key=blob.name,
                        size=blob.size or 0,
                        content_type=blob.content_settings.content_type
                        if blob.content_settings
                        else "application/octet-stream",
                        etag=blob.etag,
                    )
                )
        return results
