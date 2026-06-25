"""AWS S3 / S3-compatible storage adapter (also covers Backblaze B2 S3-compat API)."""

from __future__ import annotations

from typing import AsyncIterator, Optional

from .base import StorageProvider, StoredObject


class S3StorageProvider(StorageProvider):
    def __init__(
        self,
        bucket: str,
        region: str,
        access_key: str,
        secret_key: str,
        endpoint_url: Optional[str] = None,
    ):
        try:
            import aioboto3 as _aioboto3
            from botocore.config import Config as _BotoConfig
        except ImportError:
            raise RuntimeError(
                "aioboto3 is required for S3 storage: pip install aioboto3"
            )
        self.bucket = bucket
        self._session_kwargs = dict(
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )
        self._endpoint_url = endpoint_url
        self._aioboto3 = _aioboto3
        self._boto_config = _BotoConfig(connect_timeout=10, read_timeout=15)

    def _client(self):
        return self._aioboto3.Session().client(
            "s3",
            endpoint_url=self._endpoint_url,
            config=self._boto_config,
            **self._session_kwargs,
        )

    async def upload(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> StoredObject:
        async with self._client() as s3:
            await s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                Metadata={k: str(v) for k, v in (metadata or {}).items()},
            )
        return StoredObject(key=key, size=len(data), content_type=content_type)

    async def download(self, key: str) -> bytes:
        async with self._client() as s3:
            resp = await s3.get_object(Bucket=self.bucket, Key=key)
            return await resp["Body"].read()

    async def stream(self, key: str, chunk_size: int = 65_536) -> AsyncIterator[bytes]:
        async with self._client() as s3:
            resp = await s3.get_object(Bucket=self.bucket, Key=key)
            async for chunk in resp["Body"].iter_chunks(chunk_size):
                yield chunk

    async def delete(self, key: str) -> None:
        async with self._client() as s3:
            await s3.delete_object(Bucket=self.bucket, Key=key)

    async def exists(self, key: str) -> bool:
        try:
            async with self._client() as s3:
                await s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

    async def get_url(self, key: str, expires_in: int = 3600) -> str:
        async with self._client() as s3:
            return await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in,
            )

    async def list_objects(self, prefix: str = "") -> list[StoredObject]:
        results = []
        async with self._client() as s3:
            paginator = s3.get_paginator("list_objects_v2")
            async for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    results.append(
                        StoredObject(
                            key=obj["Key"],
                            size=obj["Size"],
                            content_type="application/octet-stream",
                            etag=obj.get("ETag", "").strip('"'),
                        )
                    )
        return results
