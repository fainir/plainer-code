from abc import ABC, abstractmethod


class StorageBackend(ABC):
    @abstractmethod
    async def put(self, key: str, data: bytes) -> None:
        ...

    @abstractmethod
    async def get(self, key: str) -> bytes | None:
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        ...

    @abstractmethod
    async def exists(self, key: str) -> bool:
        ...
