"""Необязательная внешняя модель JEV: если JEV_API_URL задан, её оценки заменяют score rule engine."""

import logging
from typing import Any

import httpx

from app.config import get_settings
from app.schemas.foundation import FoundationInput, FoundationType
from app.services.reference import FOUNDATION_TYPES

logger = logging.getLogger(__name__)


class JevAnalysisError(Exception):
    pass


def _parse_scores(payload: dict[str, Any]) -> dict[FoundationType, int]:
    raw = payload.get("suitability") or payload.get("scores")
    if not isinstance(raw, dict):
        raise JevAnalysisError("Неверный формат ответа JEV: ожидается suitability или scores")

    scores: dict[FoundationType, int] = {}
    for ftype in FOUNDATION_TYPES:
        value = raw.get(ftype)
        if value is None:
            raise JevAnalysisError(f"JEV не вернул оценку для типа {ftype}")
        scores[ftype] = max(0, min(100, round(float(value))))
    return scores


def fetch_jev_scores(data: FoundationInput) -> dict[FoundationType, int] | None:
    """Оценки JEV или None, если сервис не настроен."""
    settings = get_settings()
    if not settings.jev_api_url:
        return None

    headers = {"Content-Type": "application/json"}
    if settings.jev_api_key:
        headers["Authorization"] = f"Bearer {settings.jev_api_key}"

    try:
        with httpx.Client(timeout=settings.jev_timeout_sec) as client:
            response = client.post(settings.jev_api_url, json=data.model_dump(mode="json"), headers=headers)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise JevAnalysisError(f"Ошибка запроса к JEV: {exc}") from exc

    return _parse_scores(payload)
