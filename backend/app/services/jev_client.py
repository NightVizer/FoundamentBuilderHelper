"""Jev (TypeSafe System One) через OpenRouter: процент пригодности каждого типа фундамента.

Один вызов POST {JEV_API_URL} = 4 вопроса Noul (по одному на тип), ТЗ §6:
    {"model": ..., "state": {...}, "questions": {"strip": {"type": "noul", ...}, ...}}
Ответ: {"answers": {"strip": {"type": "noul", "noul": 0.87}, ...}, "usage": {...}}
Noul 0-1 (вероятность «да») × 100 = процент для фронта.

State и вопросы на английском (основной язык Jev). Числа переведены в категории словами:
Jev плохо сравнивает числа (https://docs.typesafe.ai/model-jaggedness/jev-1.13.md).
"""

import logging
import time
from typing import Any

import httpx

from app.config import get_settings
from app.schemas.foundation import FoundationInput, FoundationType
from app.services.http import RETRY_STATUSES, error_detail, make_client
from app.services.reference import FOUNDATION_TYPES, REGION_CLIMATE, region_name

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 2


class JevAnalysisError(Exception):
    pass


_SOIL_EN = {
    "sand": "sand",
    "sandy_loam": "sandy loam",
    "loam": "loam (silty clay loam)",
    "clay": "clay",
    "fill": "uncompacted fill (made ground)",
}

_LEVEL_EN = {"low": "low", "medium": "medium", "high": "high"}

_GROUNDWATER_EN = {
    "low": "low (deep below the surface)",
    "medium": "medium",
    "high": "high (close to the surface)",
}

_WALL_EN = {
    "wood": "timber (light walls)",
    "aerated_concrete": "aerated concrete blocks (light-to-medium walls)",
    "brick": "brick masonry (heavy walls)",
    "reinforced_concrete": "reinforced concrete (heavy walls)",
}

_SEISMICITY_EN = {
    "0-6": "6 points or less on the MSK-64 scale (low earthquake risk)",
    "7": "7 points on the MSK-64 scale (moderate earthquake risk)",
    "8+": "8 points or more on the MSK-64 scale (high earthquake risk)",
}

_FOUNDATION_EN = {
    "strip": "strip foundation: a continuous reinforced concrete strip under all load-bearing walls",
    "slab": "slab foundation: a single monolithic reinforced concrete raft under the whole building",
    "pile": "pile foundation: bored or driven piles that carry loads to deeper soil, tied by a grillage",
    "column": "column foundation: separate concrete pads or posts under corners and wall junctions, tied by a grade beam",
}


def _storeys(floors: int) -> str:
    if floors <= 2:
        kind = "low-rise, light building"
    elif floors <= 4:
        kind = "low-rise building"
    elif floors <= 9:
        kind = "mid-rise building"
    else:
        kind = "high-rise building"
    return f"{floors} {'storey' if floors == 1 else 'storeys'} ({kind})"


def _area(area_m2: float) -> str:
    if area_m2 < 150:
        kind = "small footprint, like a private house"
    elif area_m2 < 1000:
        kind = "medium footprint"
    else:
        kind = "large footprint"
    return f"{area_m2:g} m2 ({kind})"


def build_state(data: FoundationInput) -> dict[str, Any]:
    climate = REGION_CLIMATE.get(data.region, {}).get("en") or region_name(data.region)
    return {
        "site": {
            "soil_type": _SOIL_EN[data.soil_type.value],
            "soil_bearing_capacity": _LEVEL_EN[data.bearing_capacity.value],
            "groundwater_level": _GROUNDWATER_EN[data.groundwater_level.value],
        },
        "building": {
            "height": _storeys(data.floors),
            "footprint_area": _area(data.building_area_m2),
            "wall_material": _WALL_EN[data.wall_material.value],
        },
        "conditions": {
            "region_and_climate": climate,
            "seismicity": _SEISMICITY_EN[data.seismicity],
        },
    }


def build_questions() -> dict[str, Any]:
    return {
        ftype: {
            "type": "noul",
            "instructions": (
                f"Consider a {_FOUNDATION_EN[ftype]}. Is this foundation type a suitable choice for "
                "the building in `building`, given the soil and groundwater in `site` and the climate "
                "and seismicity in `conditions`?"
            ),
            "criteria": {
                "true": (
                    "An experienced foundation engineer would consider this foundation type a safe, "
                    "practical and appropriate option for this building on this site and in this climate."
                ),
                "false": (
                    "An experienced foundation engineer would reject this foundation type here or consider "
                    "it risky or impractical for these soil, groundwater, load, climate or seismic conditions."
                ),
            },
        }
        for ftype in FOUNDATION_TYPES
    }


def _parse_scores(payload: dict[str, Any]) -> dict[FoundationType, int]:
    answers = payload.get("answers")
    if not isinstance(answers, dict):
        raise JevAnalysisError("Неверный формат ответа Jev: нет поля answers")

    scores: dict[FoundationType, int] = {}
    for ftype in FOUNDATION_TYPES:
        answer = answers.get(ftype)
        value = answer.get("noul") if isinstance(answer, dict) else None
        if not isinstance(value, (int, float)):
            raise JevAnalysisError(f"Jev не вернул noul для типа {ftype}")
        scores[ftype] = max(0, min(100, round(float(value) * 100)))
    return scores


def fetch_jev_scores(data: FoundationInput) -> dict[FoundationType, int]:
    """Проценты пригодности 0-100 для всех 4 типов одним вызовом Jev."""
    settings = get_settings()
    if not settings.jev_api_key:
        raise JevAnalysisError("Jev не настроен: задайте OPENROUTER_API_KEY или JEV_API_KEY")

    body = {"model": settings.jev_model, "state": build_state(data), "questions": build_questions()}
    headers = {"Authorization": f"Bearer {settings.jev_api_key}", "Content-Type": "application/json"}

    started = time.perf_counter()
    with make_client(settings.jev_timeout_sec) as client:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                response = client.post(settings.jev_api_url, json=body, headers=headers)
            except httpx.TransportError as exc:
                logger.warning("Jev: сетевая ошибка (попытка %d): %r", attempt, exc)
                if attempt == MAX_ATTEMPTS:
                    raise JevAnalysisError(f"Jev недоступен: {exc!r}") from exc
                continue
            if response.status_code in RETRY_STATUSES and attempt < MAX_ATTEMPTS:
                logger.warning("Jev: HTTP %s, повтор: %s", response.status_code, error_detail(response))
                time.sleep(1)
                continue
            break

    if response.status_code != 200:
        message = f"Jev вернул HTTP {response.status_code}: {error_detail(response)}"
        logger.error(message)
        raise JevAnalysisError(message)

    try:
        payload = response.json()
        scores = _parse_scores(payload)
    except (ValueError, JevAnalysisError) as exc:
        logger.error("Jev: неверный ответ: %s; тело: %s", exc, response.text[:500])
        raise JevAnalysisError(f"Неверный ответ Jev: {exc}") from exc

    usage = payload.get("usage") or {}
    logger.info(
        "Jev: %s за %d мс, стоимость $%s",
        scores,
        round((time.perf_counter() - started) * 1000),
        usage.get("cost"),
    )
    return scores
