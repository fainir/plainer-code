import json
from typing import Any, List
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://plainer:plainer_dev@localhost:5433/plainer"

    # Auth
    jwt_secret_key: str = "change-me-to-a-random-secret-key"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # Anthropic
    anthropic_api_key: str = ""

    # Storage
    storage_backend: str = "local"
    storage_local_path: str = "./storage"
    s3_bucket_name: str = ""
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""

    # Redis
    redis_url: str = "redis://localhost:6380"

    # CORS - stored as str to avoid pydantic-settings JSON parsing issues
    cors_origins: str = '["http://localhost:5173"]'

    # OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("database_url", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Any) -> Any:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            if v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from string, supporting JSON array or comma-separated."""
        val = self.cors_origins.strip()
        if not val:
            return ["http://localhost:5173"]
        if val.startswith("["):
            try:
                return json.loads(val)
            except json.JSONDecodeError:
                pass
        return [x.strip() for x in val.split(",") if x.strip()]


settings = Settings()
