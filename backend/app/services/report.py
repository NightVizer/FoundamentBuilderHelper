"""ТЭО: все числа берутся из результата расчёта, LLM пишет только текст обоснования."""

import logging

from app.schemas.foundation import (
    FoundationInput,
    FoundationRecommendResponse,
    ReportComparisonRow,
    ReportParameter,
    ReportResponse,
)
from app.services.deepseek_client import DeepSeekError, chat_completion_json
from app.services.reference import (
    GROUNDWATER_LABELS,
    LEVEL_LABELS,
    SEISMICITY_LABELS,
    SOIL_LABELS,
    WALL_ADJECTIVES,
    WALL_LABELS,
    region_name,
)

logger = logging.getLogger(__name__)

TITLE = "Технико-экономическое обоснование"

REPORT_WARNING = (
    "Результат является предварительным и требует проверки квалифицированным проектировщиком."
)

SYSTEM_PROMPT = """Ты являешься помощником проектировщика.
Сформируй краткое технико-экономическое обоснование на основании предоставленных результатов расчёта.
Не изменяй:
- типы фундаментов;
- score;
- стоимость;
- трудозатраты.
Не придумывай отсутствующие параметры.
Укажи, что результат является предварительным и требует проверки проектировщиком.
Отвечай на русском языке строго в формате JSON: {"justification": "<текст обоснования, 2–4 абзаца>"}"""


def format_rub(value: int) -> str:
    """4200000 → '4,2 млн ₽'."""
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}".replace(".", ",") + " млн ₽"
    return f"{value:,}".replace(",", " ") + " ₽"


def _object_description(data: FoundationInput) -> str:
    return f"{data.floors}-этажное {WALL_ADJECTIVES[data.wall_material.value]} здание"


def _parameters(data: FoundationInput) -> list[ReportParameter]:
    area = f"{data.building_area_m2:g}"
    return [
        ReportParameter(label="Объект", value=_object_description(data)),
        ReportParameter(label="Площадь", value=f"{area} м²"),
        ReportParameter(label="Материал стен", value=WALL_LABELS[data.wall_material.value]),
        ReportParameter(label="Грунт", value=SOIL_LABELS[data.soil_type.value]),
        ReportParameter(label="Несущая способность", value=LEVEL_LABELS[data.bearing_capacity.value]),
        ReportParameter(label="Уровень грунтовых вод", value=GROUNDWATER_LABELS[data.groundwater_level.value]),
        ReportParameter(label="Регион", value=region_name(data.region)),
        ReportParameter(label="Сейсмичность", value=SEISMICITY_LABELS[data.seismicity]),
    ]


def _template_justification(result: FoundationRecommendResponse) -> str:
    rec = result.recommended
    factors = ";\n".join(f"• {r[0].lower() + r[1:]}" for r in rec.reasons) or "• совокупность введённых условий"
    text = (
        f"{rec.name} получил максимальную оценку ({rec.score}/100) "
        f"из-за сочетания следующих факторов:\n{factors}.\n\n"
        f"Ориентировочная стоимость — {format_rub(rec.estimated_cost_rub)}, "
        f"трудозатраты — {rec.labor_hours} чел.-ч."
    )
    if result.alternatives:
        alt = result.alternatives[0]
        text += (
            f"\n\nБлижайшая альтернатива — {alt.name.lower()} ({alt.score}/100, "
            f"{format_rub(alt.estimated_cost_rub)}, {alt.labor_hours} чел.-ч)."
        )
    if rec.limitations:
        text += "\n\nОграничения рекомендуемого варианта: " + "; ".join(l.lower() for l in rec.limitations) + "."
    return text + "\n\n" + REPORT_WARNING


def _llm_justification(data: FoundationInput, result: FoundationRecommendResponse) -> str:
    options = [result.recommended, *result.alternatives]
    options_block = "\n".join(
        f"- {o.name} ({o.type}): score={o.score}/100, стоимость={o.estimated_cost_rub} руб., "
        f"трудозатраты={o.labor_hours} чел.-ч; за: {'; '.join(o.reasons) or '—'}; "
        f"против: {'; '.join(o.limitations) or '—'}"
        for o in options
    )
    params_block = "\n".join(f"- {p.label}: {p.value}" for p in _parameters(data))
    user_prompt = (
        f"Исходные данные:\n{params_block}\n\n"
        f"Результаты расчёта (рекомендуемый вариант — первый):\n{options_block}"
    )
    raw = chat_completion_json(SYSTEM_PROMPT, user_prompt)
    text = str(raw.get("justification") or "").strip()
    if not text:
        raise DeepSeekError("LLM вернул пустое обоснование")
    return text


def generate_report(data: FoundationInput, result: FoundationRecommendResponse) -> ReportResponse:
    try:
        justification = _llm_justification(data, result)
        provider = "deepseek"
    except DeepSeekError as exc:
        logger.info("Обоснование сформировано шаблоном: %s", exc)
        justification = _template_justification(result)
        provider = "template"

    rec = result.recommended
    options = [rec, *result.alternatives]
    comparison = [
        ReportComparisonRow(
            type=o.type,
            name=o.name,
            score=o.score,
            estimated_cost_rub=o.estimated_cost_rub,
            labor_hours=o.labor_hours,
        )
        for o in options
    ]
    parameters = _parameters(data)
    warnings = [REPORT_WARNING, *result.warnings]

    sep = "─" * 40
    report_text = "\n".join(
        [
            TITLE.upper(),
            "",
            *(f"{p.label}: {p.value}" for p in parameters),
            sep,
            "РЕКОМЕНДУЕМОЕ РЕШЕНИЕ",
            rec.name,
            f"Score: {rec.score}/100",
            f"Стоимость: {format_rub(rec.estimated_cost_rub)}",
            f"Трудозатраты: {rec.labor_hours} чел.-ч",
            sep,
            "ОБОСНОВАНИЕ",
            justification,
            sep,
            "СРАВНЕНИЕ",
            *(
                f"{o.name:<22} {o.score:>3}/100  {format_rub(o.estimated_cost_rub):>12}  {o.labor_hours} чел.-ч"
                for o in options
            ),
            sep,
            "ПРЕДУПРЕЖДЕНИЕ",
            *warnings,
        ]
    )

    return ReportResponse(
        title=TITLE,
        object_description=_object_description(data),
        parameters=parameters,
        recommended_name=rec.name,
        recommended_score=rec.score,
        justification=justification,
        comparison=comparison,
        warning=" ".join(warnings) if result.warnings else REPORT_WARNING,
        provider=provider,
        report_text=report_text,
    )

