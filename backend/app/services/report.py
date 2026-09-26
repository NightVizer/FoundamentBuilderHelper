from app.schemas.foundation import FoundationInput, FoundationRecommendResponse, ReportResponse
from app.services.comparison import build_compare_analysis

_TYPE_RU = {
    "strip": "ленточный",
    "slab": "плитный",
    "pile": "свайный",
    "column": "столбчатый",
}


def generate_report(data: FoundationInput, result: FoundationRecommendResponse) -> ReportResponse:
    """ТЭО: числа из JEV + текст сравнения из DeepSeek (если ключ задан)."""
    analysis = build_compare_analysis(data, result)
    rec = result.recommended
    alt_lines = "\n".join(
        f"- {_TYPE_RU[a.type]}: {a.score} баллов, ~{a.estimated_cost_rub:,.0f} ₽, {a.labor_hours} ч"
        for a in result.alternatives
    )
    reasons = "\n".join(f"  • {r}" for r in rec.reasons)

    text = f"""Технико-экономическое обоснование (предварительное)

Исходные данные:
  Грунт: {data.soil_type.value}, несущая способность: {data.bearing_capacity.value}
  УГВ: {data.groundwater_level.value}, этажность: {data.floors}, площадь: {data.building_area_m2} м²
  Материал стен: {data.wall_material.value}, регион: {data.region}, сейсмичность: {data.seismicity}

Рекомендуемое решение: {_TYPE_RU[rec.type]} фундамент
  Пригодность (JEV): {rec.score}%
  Ориентировочная стоимость: {rec.estimated_cost_rub:,.0f} ₽
  Трудозатраты: {rec.labor_hours} ч

Обоснование:
{reasons}

Альтернативы:
{alt_lines}

Сравнительный анализ ({analysis.provider}):
{analysis.overview}

{analysis.why_recommended}

""" + "\n".join(
        f"{_TYPE_RU[t.type].capitalize()}:\n  + " + "\n  + ".join(t.pros[:5])
        + "\n  − " + "\n  − ".join(t.cons[:5])
        for t in analysis.types
    ) + f"""

{result.warning or "Расчёт предварительный; не заменяет проектную документацию."}
"""
    return ReportResponse(report_text=text.strip())
