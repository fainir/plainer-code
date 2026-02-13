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

    # CORS
    cors_origins: list[str] = ["http://localhost:5173"]

    # OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

        return v

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str] | None) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return v or ["http://localhost:5173"]


settings = Settings()
