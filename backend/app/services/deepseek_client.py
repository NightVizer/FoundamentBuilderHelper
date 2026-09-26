"""LLM для текстов (по умолчанию DeepSeek V4 Flash через OpenRouter, OpenAI-совместимый chat/completions)."""

import json
import logging
import re
import time
from typing import Any

import httpx

from app.config import get_settings
from app.services.http import RETRY_STATUSES, error_detail, make_client

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 2


class DeepSeekError(Exception):
    def __init__(self, message: str, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise DeepSeekError("LLM не вернул JSON", retryable=True) from None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise DeepSeekError(f"LLM вернул некорректный JSON: {exc}", retryable=True) from None
    if not isinstance(data, dict):
        raise DeepSeekError("LLM вернул JSON не в виде объекта", retryable=True)
    return data


def _request_once(client: httpx.Client, url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    response = client.post(url, json=payload, headers=headers)
    if response.status_code != 200:
        raise DeepSeekError(
            f"LLM вернул HTTP {response.status_code}: {error_detail(response)}",
            retryable=response.status_code in RETRY_STATUSES,
        )
    try:
        choice = response.json()["choices"][0]
        content = choice["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise DeepSeekError(f"Неверный формат ответа LLM: {response.text[:300]}", retryable=True) from exc
    if not content:
        raise DeepSeekError(f"LLM вернул пустой ответ (finish_reason={choice.get('finish_reason')})", retryable=True)
    return _extract_json(content)


def chat_completion_json(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    """Один JSON-ответ LLM. Сетевые ошибки, 429/5xx и битый JSON повторяются один раз."""
    settings = get_settings()
    if not settings.deepseek_api_key:
        raise DeepSeekError("LLM не настроен: задайте OPENROUTER_API_KEY или DEEPSEEK_API_KEY")

    url = f"{settings.deepseek_base_url.rstrip('/')}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.deepseek_api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": settings.deepseek_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
        # Reasoning у V4 Flash включён по умолчанию и сильно увеличивает задержку
        "reasoning": {"enabled": settings.deepseek_reasoning},
    }

    started = time.perf_counter()
    with make_client(settings.deepseek_timeout_sec) as client:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                result = _request_once(client, url, headers, payload)
            except (httpx.TransportError, DeepSeekError) as exc:
                retryable = isinstance(exc, httpx.TransportError) or exc.retryable
                logger.warning("LLM %s: ошибка (попытка %d): %r", settings.deepseek_model, attempt, exc)
                if attempt == MAX_ATTEMPTS or not retryable:
                    raise DeepSeekError(f"Ошибка LLM: {exc!r}" if isinstance(exc, httpx.TransportError) else str(exc)) from exc
                continue
            logger.info(
                "LLM %s: ответ за %d мс", settings.deepseek_model, round((time.perf_counter() - started) * 1000)
            )
            return result
    raise DeepSeekError("LLM: попытки исчерпаны")  # pragma: no cover
