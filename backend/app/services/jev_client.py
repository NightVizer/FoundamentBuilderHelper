import logging
from typing import Any

import httpx

from app.config import get_settings
from app.schemas.foundation import FoundationInput, FoundationType
from app.services.scoring import score_all_types

logger = logging.getLogger(__name__)

FOUNDATION_TYPES: tuple[FoundationType, ...] = ("strip", "slab", "pile", "column")


class JevAnalysisError(Exception):
    pass


def _normalize_scores(raw: dict[str, Any]) -> dict[FoundationType, int]:
    scores: dict[FoundationType, int] = {}
    for ftype in FOUNDATION_TYPES:
        value = raw.get(ftype)
        if value is None:
            raise JevAnalysisError(f"JEV не вернул оценку для типа {ftype}")
        scores[ftype] = max(0, min(100, int(round(float(value)))))
    return scores


def _parse_jev_response(payload: dict[str, Any]) -> tuple[dict[FoundationType, int], dict[FoundationType, list[str]]]:
    if "suitability" in payload and isinstance(payload["suitability"], dict):
        scores = _normalize_scores(payload["suitability"])
    elif "scores" in payload and isinstance(payload["scores"], dict):
        scores = _normalize_scores(payload["scores"])
    else:
        raise JevAnalysisError("Неверный формат ответа JEV: ожидается suitability или scores")

    notes_raw = payload.get("notes") or payload.get("reasons") or {}
    notes: dict[FoundationType, list[str]] = {t: [] for t in FOUNDATION_TYPES}
    if isinstance(notes_raw, dict):
        for ftype in FOUNDATION_TYPES:
            item = notes_raw.get(ftype)
            if isinstance(item, list):
                notes[ftype] = [str(x) for x in item]
            elif isinstance(item, str) and item.strip():
                notes[ftype] = [item.strip()]
    return scores, notes


def analyze_with_jev(data: FoundationInput) -> tuple[dict[FoundationType, int], dict[FoundationType, list[str]], str]:
    """
    Шаг 1: процент пригодности каждого типа фундамента.
    Если JEV_API_URL не задан — локальный rule-engine (для разработки без сервиса).
    """
    settings = get_settings()
    if not settings.jev_api_url:
        logger.info("JEV_API_URL не задан, используется локальный scoring (fallback)")
        scored = score_all_types(data)
        scores = {ftype: s for ftype, (s, _) in scored.items()}
        notes = {ftype: list(reasons) for ftype, (_, reasons) in scored.items()}
        return scores, notes, "rules_fallback"

    headers = {"Content-Type": "application/json"}
    if settings.jev_api_key:
        headers["Authorization"] = f"Bearer {settings.jev_api_key}"

    body = data.model_dump(mode="json")

    try:
        with httpx.Client(timeout=settings.jev_timeout_sec) as client:
            response = client.post(settings.jev_api_url, json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        raise JevAnalysisError(f"Ошибка запроса к JEV: {exc}") from exc

    scores, notes = _parse_jev_response(payload)
    return scores, notes, "jev"
