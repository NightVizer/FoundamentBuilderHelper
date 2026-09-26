"""Rule engine: оценка 0..100 для каждого типа фундамента по таблице правил rules.json.

Это демонстрационная логика MVP, а не инженерный коэффициент.
"""

from dataclasses import dataclass, field

from app.schemas.foundation import FoundationInput, FoundationType
from app.services.reference import floors_bucket, load_rules


@dataclass
class ScoreResult:
    score: int
    reasons: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)


def _factor_values(data: FoundationInput) -> dict[str, str]:
    """Значение каждого фактора rules.json для введённых данных."""
    return {
        "bearing_capacity": data.bearing_capacity.value,
        "groundwater_level": data.groundwater_level.value,
        "floors": floors_bucket(data.floors),
        "wall_material": data.wall_material.value,
        "seismicity": data.seismicity,
        "soil_type": data.soil_type.value,
    }


def score_all_types(data: FoundationInput) -> dict[FoundationType, ScoreResult]:
    rules = load_rules()
    values = _factor_values(data)
    result: dict[FoundationType, ScoreResult] = {}

    for ftype in rules["foundation_types"]:
        score = rules["base_scores"][ftype]
        contributions: list[tuple[int, str]] = []

        for factor, value in values.items():
            rule = rules["factors"][factor][value]
            points = rule["points"][ftype]
            score += points
            if points:
                contributions.append((points, rule["reason"]))

        # Самые весомые факторы — первыми
        contributions.sort(key=lambda c: abs(c[0]), reverse=True)
        result[ftype] = ScoreResult(
            score=max(0, min(100, score)),
            reasons=[reason for points, reason in contributions if points > 0],
            limitations=[reason for points, reason in contributions if points < 0],
        )

    return result
