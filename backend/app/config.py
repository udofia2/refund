from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM Provider
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.0-flash"
    llm_api_key: str | None = None
    llm_temperature: float = 0.1
    llm_max_tokens: int = 1024
    llm_timeout_seconds: int = 20

    # Application
    app_env: str = "development"
    log_level: str = "INFO"
    database_url: str = "sqlite:///./data/refunds.db"

    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 10
    rate_limit_window_seconds: int = 60

    # Policy
    refund_max_days: int = 30
    refund_high_value_threshold: float = 500.00

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
