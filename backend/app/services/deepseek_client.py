import json
import logging
import re
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class DeepSeekError(Exception):
    pass


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise DeepSeekError("DeepSeek не вернул JSON") from None
        return json.loads(match.group(0))


def chat_completion_json(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.deepseek_api_key:
        raise DeepSeekError("DEEPSEEK_API_KEY не задан")

    url = f"{settings.deepseek_base_url.rstrip('/')}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.deepseek_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.deepseek_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }

    try:
        with httpx.Client(timeout=settings.deepseek_timeout_sec) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise DeepSeekError(f"Ошибка запроса к DeepSeek: {exc}") from exc

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise DeepSeekError("Неверный формат ответа DeepSeek") from exc

    return _extract_json(content)
