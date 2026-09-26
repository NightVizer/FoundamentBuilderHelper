"""Конвейер рекомендации: score (Jev) → стоимость → трудозатраты → сортировка → причины."""

import logging

from app.config import get_settings
from app.schemas.foundation import (
    FoundationInput,
    FoundationOption,
    FoundationRecommendResponse,
)
from app.services.jev_client import fetch_jev_scores
from app.services.pricing import estimate_cost, estimate_labor_hours, total_cost
from app.services.reference import FOUNDATION_NAMES
from app.services.scoring import score_all_types

logger = logging.getLogger(__name__)


def _condition_warnings(data: FoundationInput) -> list[str]:
    warnings: list[str] = []
    if data.bearing_capacity.value == "low" and data.groundwater_level.value == "high":
        warnings.append(
            "Низкая несущая способность при высоком УГВ: необходимы инженерно-геологические изыскания."
        )
    if data.soil_type.value == "fill":
        warnings.append("Насыпной грунт: требуется оценка состава и степени уплотнения.")
    if data.seismicity == "8+":
        warnings.append("Сейсмичность 8+ баллов: требуется расчёт на сейсмические воздействия.")
    if data.floors >= 5:
        warnings.append("Здание 5+ этажей: оценка MVP ориентировочная, нужен детальный расчёт нагрузок.")
    return warnings


def recommend(data: FoundationInput) -> FoundationRecommendResponse:
    """Данные уже проверены Pydantic-схемой FoundationInput.

    Проценты только от Jev (ТЗ §2); ошибка Jev пробрасывается (эндпоинт отдаёт 502).
    Rule engine даёт проценты только при явном SCORE_SOURCE=rules (тесты, офлайн-разработка),
    а в остальном — только тексты reasons/limitations для отчёта.
    """
    scored = score_all_types(data)
    if get_settings().score_source == "rules":
        logger.warning("SCORE_SOURCE=rules: проценты считает rule engine, а не Jev")
        jev_scores = None
    else:
        jev_scores = fetch_jev_scores(data)

    options: list[FoundationOption] = []
    for ftype, result in scored.items():
        breakdown = estimate_cost(data, ftype)
        options.append(
            FoundationOption(
                type=ftype,
                name=FOUNDATION_NAMES[ftype],
                score=jev_scores[ftype] if jev_scores else result.score,
                estimated_cost_rub=total_cost(breakdown),
                labor_hours=estimate_labor_hours(data, ftype),
                reasons=result.reasons,
                limitations=result.limitations,
                cost_breakdown=breakdown,
            )
        )

    # При равном score выше — более дешёвый вариант
    options.sort(key=lambda o: (-o.score, o.estimated_cost_rub))

    return FoundationRecommendResponse(
        scores={o.type: o.score for o in options},
        recommended=options[0],
        alternatives=options[1:],
        warnings=_condition_warnings(data),
        score_source="jev" if jev_scores else "rules_fallback",
    )
