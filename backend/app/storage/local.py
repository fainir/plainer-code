import os
from pathlib import Path

import aiofiles

from app.storage.base import StorageBackend


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        return self.base_path / key

    async def put(self, key: str, data: bytes) -> None:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(path, "wb") as f:
            await f.write(data)

    async def get(self, key: str) -> bytes | None:
        path = self._resolve(key)
        if not path.exists():
            return None
        async with aiofiles.open(path, "rb") as f:
            return await f.read()

    async def delete(self, key: str) -> None:
        path = self._resolve(key)
        if path.exists():
            os.remove(path)

    async def exists(self, key: str) -> bool:
        return self._resolve(key).exists()
