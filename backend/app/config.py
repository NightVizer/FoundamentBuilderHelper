import os
from functools import lru_cache


@lru_cache
def get_settings() -> "Settings":
    return Settings()


class Settings:
    """Переменные окружения для внешних моделей."""

    jev_api_url: str | None
    jev_api_key: str | None
    jev_timeout_sec: float

    deepseek_api_key: str | None
    deepseek_base_url: str
    deepseek_model: str
    deepseek_timeout_sec: float

    def __init__(self) -> None:
        self.jev_api_url = os.getenv("JEV_API_URL") or None
        self.jev_api_key = os.getenv("JEV_API_KEY") or None
        self.jev_timeout_sec = float(os.getenv("JEV_TIMEOUT_SEC", "60"))

        self.deepseek_api_key = os.getenv("DEEPSEEK_API_KEY") or None
        self.deepseek_base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self.deepseek_model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        self.deepseek_timeout_sec = float(os.getenv("DEEPSEEK_TIMEOUT_SEC", "90"))
