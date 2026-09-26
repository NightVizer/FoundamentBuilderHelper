"""Jev (TypeSafe System One) через OpenRouter: процент пригодности каждого типа фундамента.

Один вызов POST {JEV_API_URL} = 4 вопроса Noul (по одному на тип), ТЗ §6:
    {"model": ..., "state": {...}, "questions": {"strip": {"type": "noul", ...}, ...}}
Ответ: {"answers": {"strip": {"type": "noul", "noul": 0.87}, ...}, "usage": {...}}
Noul 0-1 (вероятность «да») × 100 = процент для фронта.

State и вопросы на английском (основной язык Jev). Числа переведены в категории словами:
Jev плохо сравнивает числа (https://docs.typesafe.ai/model-jaggedness/jev-1.13.md).
Каждый вопрос несёт оценки из data/jev_rules.json только для фактических значений входа:
Jev не ищет нужное правило сама (indirection) и не видит правил для чужих значений (irrelevant detail).
"""

import logging
import time
from typing import Any

import httpx

from app.config import get_settings
from app.schemas.foundation import FoundationInput, FoundationType
from app.services.http import RETRY_STATUSES, error_detail, make_client
from app.services.reference import FOUNDATION_TYPES, REGION_CLIMATE, load_jev_rules, region_name

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 2


class JevAnalysisError(Exception):
    pass


_SOIL_EN = {
    "sand": "sand",
    "sandy_loam": "sandy loam",
    "loam": "loam",
    "clay": "clay",
    "fill": "fill soil (uncompacted made ground)",
}

_BEARING_EN = {
    "low": "low (weak soil)",
    "medium": "medium",
    "high": "high (strong soil)",
}

_GROUNDWATER_EN = {
    "low": "low (deep below the surface, dry soil)",
    "medium": "medium",
    "high": "high (close to the surface, saturated soil)",
}

_FROST_EN = {
    "shallow": "shallow (up to 0.8 m)",
    "moderate": "moderate (0.8 to 1.5 m)",
    "deep": "deep (1.5 to 2.0 m)",
    "very_deep": "very deep (more than 2.0 m)",
}

_WALL_EN = {
    "wood": "timber (light walls)",
    "aerated_concrete": "aerated concrete blocks (medium-weight walls, weak in bending)",
    "brick": "brick masonry (heavy walls)",
    "reinforced_concrete": "reinforced concrete (heaviest walls)",
}

_SEISMICITY_EN = {
    "0-6": "6 points or less on the MSK-64 scale (low earthquake risk)",
    "7": "7 points on the MSK-64 scale (moderate earthquake risk)",
    "8+": "8 points or more on the MSK-64 scale (high earthquake risk)",
}

_FOUNDATION_EN = {
    "strip": "strip foundation: a continuous reinforced concrete strip under all load-bearing walls",
    "slab": "slab foundation: a single monolithic reinforced concrete raft under the whole building",
    "pile": "pile foundation: bored, driven or screw piles that carry loads to deeper soil, tied by a grillage",
    "column": "column foundation: separate concrete pads or posts under corners and wall junctions, tied by a grade beam",
}

# Поле state для каждого фактора jev_rules.json: Jev видит, к какому полю относится оценка
_STATE_FIELDS = {
    "soil_type": "site.soil_type",
    "bearing_capacity": "site.soil_bearing_capacity",
    "groundwater_level": "site.groundwater_level",
    "frost_depth": "site.soil_freezing_depth",
    "storeys": "building.storeys",
    "wall_material": "building.wall_material",
    "seismicity": "conditions.seismicity",
}

_INFLUENCE_ORDER = {"very strong": 0, "strong": 1, "moderate": 2}

_HOW_TO_WEIGH = (
    "Each assessment applies this foundation type to one field of `state` and was written by a foundation "
    "engineer for exactly the value in `state`. Verdicts from best to worst: favourable, acceptable, neutral, "
    "unfavourable, excluded. A single 'excluded' verdict makes this foundation unsuitable on its own. "
    "Otherwise weigh the verdicts by influence: very strong counts most, then strong, then moderate; "
    "'neutral' verdicts do not matter. Suitable means both safe and economically reasonable: a foundation "
    "that is excessive where a simpler one would do is less suitable."
)


def _storeys_band(floors: int) -> str:
    """Границы из справочника: столбчатый до 2 этажей, лента до 5, плита до 25."""
    if floors <= 2:
        return "1-2"
    if floors <= 5:
        return "3-5"
    if floors <= 10:
        return "6-10"
    if floors <= 25:
        return "11-25"
    return "26+"


def _storeys(floors: int) -> str:
    band = _storeys_band(floors)
    band_text = "more than 25 storeys" if band == "26+" else f"{band.replace('-', ' to ')} storeys"
    return f"{floors} {'storey' if floors == 1 else 'storeys'} (band: {band_text})"


def _input_values(data: FoundationInput) -> dict[str, str]:
    """Значения входа в ключах jev_rules.json; промерзание только если его ввели."""
    values = {
        "soil_type": data.soil_type.value,
        "bearing_capacity": data.bearing_capacity.value,
        "groundwater_level": data.groundwater_level.value,
        "storeys": _storeys_band(data.floors),
        "wall_material": data.wall_material.value,
        "seismicity": data.seismicity,
    }
    if data.frost_depth is not None:
        values["frost_depth"] = data.frost_depth.value
    return values


def build_state(data: FoundationInput) -> dict[str, Any]:
    """Только факторы из справочника: площадь на выбор типа не влияет и идёт лишь в расчёт стоимости."""
    climate = REGION_CLIMATE.get(data.region, {}).get("en") or region_name(data.region)
    site = {
        "soil_type": _SOIL_EN[data.soil_type.value],
        "soil_bearing_capacity": _BEARING_EN[data.bearing_capacity.value],
        "groundwater_level": _GROUNDWATER_EN[data.groundwater_level.value],
    }
    if data.frost_depth is not None:
        site["soil_freezing_depth"] = _FROST_EN[data.frost_depth.value]
    return {
        "site": site,
        "building": {
            "storeys": _storeys(data.floors),
            "wall_material": _WALL_EN[data.wall_material.value],
        },
        "conditions": {
            "region_and_climate": climate,
            "seismicity": _SEISMICITY_EN[data.seismicity],
        },
    }


def _assessments(ftype: str, values: dict[str, str]) -> list[dict[str, str]]:
    """Оценки типа для фактических значений входа, от сильного влияния к слабому."""
    rules = load_jev_rules()[ftype]
    items = []
    for factor, value in values.items():
        verdict, reason = rules[factor]["values"][value]
        items.append(
            {
                "field": _STATE_FIELDS[factor],
                "influence": rules[factor]["influence"],
                "verdict": verdict,
                "reason": reason,
            }
        )
    return sorted(items, key=lambda item: _INFLUENCE_ORDER[item["influence"]])


def build_questions(data: FoundationInput) -> dict[str, Any]:
    values = _input_values(data)
    questions: dict[str, Any] = {}
    for ftype in FOUNDATION_TYPES:
        name = f"{ftype} foundation"
        questions[ftype] = {
            "type": "noul",
            "instructions": {
                "foundation": _FOUNDATION_EN[ftype],
                "question": (
                    f"Is a {name} a suitable choice for the building in `building`, on the site in `site`, "
                    "under the `conditions`?"
                ),
                "assessments": _assessments(ftype, values),
                "how_to_weigh": _HOW_TO_WEIGH,
            },
            "criteria": {
                "true": {
                    "what": (
                        f"A foundation engineer would choose or seriously consider a {name} here: no assessment "
                        "is 'excluded', and the very strong and strong assessments are mostly favourable or "
                        "acceptable."
                    ),
                    "examples": [
                        "Pile foundation on fill soil with high groundwater and very deep freezing.",
                        "Column foundation for a 1-storey timber house on dry sand with shallow freezing.",
                    ],
                },
                "false": {
                    "what": (
                        f"A foundation engineer would reject a {name} here: at least one assessment is "
                        "'excluded', or several very strong or strong assessments are unfavourable, or another "
                        "foundation type would clearly be cheaper for the same safety."
                    ),
                    "examples": [
                        "Column foundation under a 5-storey brick building.",
                        "Strip foundation on weak saturated clay with deep freezing.",
                    ],
                },
            },
        }
    return questions


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

    body = {"model": settings.jev_model, "state": build_state(data), "questions": build_questions(data)}
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
