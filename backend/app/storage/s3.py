import io
from contextlib import asynccontextmanager

import aioboto3
from botocore.exceptions import ClientError

from app.config import settings
from app.storage.base import StorageBackend


class S3StorageBackend(StorageBackend):
    def __init__(self):
        self.session = aioboto3.Session()
        self.bucket = settings.s3_bucket_name
        self.endpoint_url = settings.s3_endpoint_url or None
        self.aws_access_key_id = settings.s3_access_key_id
        self.aws_secret_access_key = settings.s3_secret_access_key

    @asynccontextmanager
    async def _get_client(self):
        async with self.session.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
        ) as client:
            yield client

    async def put(self, key: str, data: bytes) -> None:
        async with self._get_client() as client:
            await client.put_object(Bucket=self.bucket, Key=key, Body=data)

    async def get(self, key: str) -> bytes | None:
        async with self._get_client() as client:
            try:
                response = await client.get_object(Bucket=self.bucket, Key=key)
                async with response["Body"] as stream:
                    return await stream.read()
            except ClientError as e:
                if e.response["Error"]["Code"] == "NoSuchKey":
                    return None
                raise

    async def delete(self, key: str) -> None:
        async with self._get_client() as client:
            await client.delete_object(Bucket=self.bucket, Key=key)

    async def exists(self, key: str) -> bool:
        async with self._get_client() as client:
            try:
                await client.head_object(Bucket=self.bucket, Key=key)
                return True
            except ClientError as e:
                if e.response["Error"]["Code"] == "404":
                    return False
                raise
