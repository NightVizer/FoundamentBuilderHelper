"""Справочные данные MVP: правила, цены и русские названия для UI и отчётов."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

FOUNDATION_TYPES: tuple[str, ...] = ("strip", "slab", "pile", "column")

FOUNDATION_NAMES: dict[str, str] = {
    "strip": "Ленточный фундамент",
    "slab": "Плитный фундамент",
    "pile": "Свайный фундамент",
    "column": "Столбчатый фундамент",
}

SOIL_LABELS: dict[str, str] = {
    "sand": "Песок",
    "sandy_loam": "Супесь",
    "loam": "Суглинок",
    "clay": "Глина",
    "fill": "Насыпной грунт",
}

LEVEL_LABELS: dict[str, str] = {
    "low": "Низкая",
    "medium": "Средняя",
    "high": "Высокая",
}

GROUNDWATER_LABELS: dict[str, str] = {
    "low": "Низкий",
    "medium": "Средний",
    "high": "Высокий",
}

WALL_LABELS: dict[str, str] = {
    "wood": "Дерево",
    "aerated_concrete": "Газобетон",
    "brick": "Кирпич",
    "reinforced_concrete": "Железобетон",
}

# Прилагательные для строки «Объект: 3-этажное кирпичное здание»
WALL_ADJECTIVES: dict[str, str] = {
    "wood": "деревянное",
    "aerated_concrete": "газобетонное",
    "brick": "кирпичное",
    "reinforced_concrete": "железобетонное",
}

SEISMICITY_LABELS: dict[str, str] = {
    "0-6": "до 6 баллов",
    "7": "7 баллов",
    "8+": "8 баллов и более",
}

PRELIMINARY_WARNING = "Предварительное решение. Требуется проверка проектировщиком."

# Коды регионов из ТЗ §3 → коды prices.json. Принимаются оба варианта.
REGION_ALIASES: dict[str, str] = {
    "krasnoyarsk_krai": "krasnoyarsk",
    "sverdlovsk_oblast": "ekb",
}

# Климат региона: качественные категории (без норм и цифр), общие для Jev и LLM.
# en — в state для Jev (английский для неё основной), ru — в промпт LLM.
REGION_CLIMATE: dict[str, dict[str, str]] = {
    "moscow": {
        "en": "Moscow region, Russia: temperate continental climate, cold winters, moderate seasonal soil freezing",
        "ru": "умеренно-континентальный климат, холодная зима, умеренное сезонное промерзание грунта",
    },
    "spb": {
        "en": "Saint Petersburg, Russia: humid temperate climate, mild but long winters, moderate seasonal soil freezing, waterlogged soils are common",
        "ru": "влажный умеренный климат, долгая мягкая зима, умеренное сезонное промерзание грунта",
    },
    "ekb": {
        "en": "Sverdlovsk Oblast (Yekaterinburg), Russia: continental climate, long cold winters, deep seasonal soil freezing",
        "ru": "континентальный климат, долгая холодная зима, глубокое сезонное промерзание грунта",
    },
    "novosibirsk": {
        "en": "Novosibirsk, Russia: sharply continental climate, very cold long winters, deep seasonal soil freezing",
        "ru": "резко континентальный климат, очень холодная долгая зима, глубокое сезонное промерзание грунта",
    },
    "krasnoyarsk": {
        "en": "Krasnoyarsk Krai, Russia: sharply continental climate, very cold long winters, deep seasonal soil freezing",
        "ru": "резко континентальный климат, очень холодная долгая зима, глубокое сезонное промерзание грунта",
    },
    "krasnodar": {
        "en": "Krasnodar, southern Russia: mild climate, short warm winters, shallow seasonal soil freezing",
        "ru": "мягкий климат, короткая тёплая зима, неглубокое сезонное промерзание грунта",
    },
}


def _load(name: str) -> dict[str, Any]:
    with open(_DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


@lru_cache
def load_rules() -> dict[str, Any]:
    return _load("rules.json")


@lru_cache
def load_prices() -> dict[str, Any]:
    return _load("prices.json")


def region_ids() -> list[str]:
    return list(load_prices()["regions"])


def region_name(region: str) -> str:
    return load_prices()["regions"].get(region, {}).get("name", region)


def floors_bucket(floors: int) -> str:
    return "5+" if floors >= 5 else str(floors)
