"""Конвейер рекомендации: score → стоимость → трудозатраты → сортировка → причины."""

from app.schemas.foundation import (
    FoundationInput,
    FoundationOption,
    FoundationRecommendResponse,
)
from app.services.jev_client import fetch_jev_scores
from app.services.pricing import estimate_cost, estimate_labor_hours, total_cost
from app.services.reference import FOUNDATION_NAMES
from app.services.scoring import score_all_types


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
    """Данные уже проверены Pydantic-схемой FoundationInput."""
    scored = score_all_types(data)
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
        recommended=options[0],
        alternatives=options[1:],
        warnings=_condition_warnings(data),
        score_source="jev" if jev_scores else "rules_fallback",
    )
