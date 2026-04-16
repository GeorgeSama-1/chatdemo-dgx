from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    model_base_url: str = "http://localhost:3001/v1"
    model_api_key: str = ""
    model_name: str = "gpt-oss-chat"
    model_enable_thinking: bool = False
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    request_timeout: float = 60.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
