import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# backend/.env (переменные окружения процесса имеют приоритет)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@lru_cache
def get_settings() -> "Settings":
    return Settings()


def _flag(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "on", "yes")


class Settings:
    """Переменные окружения для внешних моделей (обе ходят через OpenRouter)."""

    score_source: str
    jev_api_url: str
    jev_api_key: str | None
    jev_model: str
    jev_timeout_sec: float

    deepseek_api_key: str | None
    deepseek_base_url: str
    deepseek_model: str
    deepseek_reasoning: bool
    deepseek_timeout_sec: float

    def __init__(self) -> None:
        openrouter_key = os.getenv("OPENROUTER_API_KEY") or None

        # "jev" — проценты только от Jev (ТЗ §2); "rules" — локальный rule engine (тесты, офлайн-разработка)
        self.score_source = os.getenv("SCORE_SOURCE", "jev").strip().lower()
        self.jev_api_url = os.getenv("JEV_API_URL") or "https://openrouter.ai/api/alpha/decisions"
        self.jev_api_key = os.getenv("JEV_API_KEY") or openrouter_key
        self.jev_model = os.getenv("JEV_MODEL") or "typesafe/jev-1.13"
        self.jev_timeout_sec = float(os.getenv("JEV_TIMEOUT_SEC", "20"))

        self.deepseek_api_key = os.getenv("DEEPSEEK_API_KEY") or openrouter_key
        self.deepseek_base_url = os.getenv("DEEPSEEK_BASE_URL") or "https://openrouter.ai/api"
        self.deepseek_model = os.getenv("DEEPSEEK_MODEL") or "deepseek/deepseek-v4-flash"
        self.deepseek_reasoning = _flag("DEEPSEEK_REASONING", "off")
        self.deepseek_timeout_sec = float(os.getenv("DEEPSEEK_TIMEOUT_SEC", "90"))
