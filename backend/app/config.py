import json
from typing import Any, List, Union
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

    # CORS - Use Union[str, List[str]] to allow string input from env without JSON parsing
    cors_origins: Union[str, List[str]] = "http://localhost:5173"

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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            v_trimmed = v.strip()
            if v_trimmed.startswith("["):
                try:
                    return json.loads(v_trimmed)
                except:
                    pass
            return [i.strip() for i in v_trimmed.split(",") if i.strip()]
        if isinstance(v, list):
            return v
        return ["http://localhost:5173"]


settings = Settings()
