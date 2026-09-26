from typing import Literal, cast

from app.schemas.foundation import (
    FoundationInput,
    FoundationOption,
    FoundationRecommendResponse,
    FoundationType,
)

ScoreSource = Literal["jev", "rules_fallback"]
from app.services.jev_client import JevAnalysisError, analyze_with_jev
from app.services.pricing import estimate_cost, estimate_labor_hours

_TYPE_LABELS: dict[FoundationType, str] = {
    "strip": "ленточный",
    "slab": "плитный",
    "pile": "свайный",
    "column": "столбчатый",
}


def _build_warning(data: FoundationInput) -> str | None:
    if data.bearing_capacity.value == "low" and data.groundwater_level.value == "high":
        return (
            "Низкая несущая способность и высокий УГВ: результат носит предварительный характер. "
            "Требуется инженерно-геологическое обследование."
        )
    if data.soil_type.value == "fill":
        return "Насыпные грунты: рекомендация демонстрационная, необходима оценка уплотнения."
    return None


def recommend(data: FoundationInput) -> FoundationRecommendResponse:
    try:
        scores, notes, score_source = analyze_with_jev(data)
    except JevAnalysisError as exc:
        raise ValueError(str(exc)) from exc

    options: list[FoundationOption] = []

    for ftype, score in scores.items():
        reasons = notes.get(ftype) or []
        options.append(
            FoundationOption(
                type=ftype,
                score=score,
                estimated_cost_rub=estimate_cost(data, ftype),
                labor_hours=estimate_labor_hours(data, ftype),
                reasons=reasons,
            )
        )

    options.sort(key=lambda o: o.score, reverse=True)
    recommended = options[0]
    alternatives = options[1:]

    recommended.reasons = [
        f"Рекомендован {_TYPE_LABELS[recommended.type]} фундамент (пригодность {recommended.score}%).",
        *recommended.reasons,
    ]

    return FoundationRecommendResponse(
        recommended=recommended,
        alternatives=alternatives,
        warning=_build_warning(data),
        score_source=cast(ScoreSource, score_source),
    )
