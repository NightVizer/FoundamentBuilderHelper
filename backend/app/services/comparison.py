from app.schemas.foundation import (
    CompareAnalysisResponse,
    FoundationInput,
    FoundationRecommendResponse,
    FoundationType,
    TypeInsight,
)
from app.services.deepseek_client import DeepSeekError, chat_completion_json

_TYPE_RU = {
    "strip": "ленточный",
    "slab": "плитный",
    "pile": "свайный",
    "column": "столбчатый",
}


def _template_analysis(
    data: FoundationInput, result: FoundationRecommendResponse
) -> CompareAnalysisResponse:
    all_opts = [result.recommended, *result.alternatives]
    types: list[TypeInsight] = []
    for opt in all_opts:
        types.append(
            TypeInsight(
                type=opt.type,
                pros=[f"Пригодность по модели JEV: {opt.score}%", *opt.reasons[:2]],
                cons=["Упрощённый шаблон без LLM — задайте DEEPSEEK_API_KEY"],
            )
        )
    return CompareAnalysisResponse(
        overview="Сравнение сформировано шаблоном (DeepSeek не подключён).",
        why_recommended=f"Наибольший процент пригодности у {_TYPE_RU[result.recommended.type]} фундамента ({result.recommended.score}%).",
        types=types,
        provider="template",
    )


def build_compare_analysis(
    data: FoundationInput, result: FoundationRecommendResponse
) -> CompareAnalysisResponse:
    """Шаг 2: плюсы/минусы по уже рассчитанным процентам JEV (scores не меняются)."""
    all_opts = [result.recommended, *result.alternatives]
    options_block = "\n".join(
        f"- {o.type}: suitability={o.score}%, cost_rub={o.estimated_cost_rub}, labor_h={o.labor_hours}"
        for o in all_opts
    )
    input_block = data.model_dump_json()

    system = (
        "Ты инженер-консультант по фундаментам. Отвечай только JSON на русском языке. "
        "Не меняй числа suitability, cost_rub, labor_h — используй их как факты. "
        "Не выдумывай нормативные расчёты."
    )
    user = f"""Исходные данные (JSON):
{input_block}

Результаты модели JEV (процент пригодности 0-100 и смета):
{options_block}

Верни JSON строго такой структуры:
{{
  "overview": "краткий вывод для заказчика",
  "why_recommended": "почему лидирующий вариант лучше альтернатив в этих условиях",
  "types": [
    {{
      "type": "strip|slab|pile|column",
      "pros": ["..."],
      "cons": ["..."]
    }}
  ]
}}
Для каждого из четырёх типов укажи pros и cons с учётом грунта, УГВ, этажности, региона, сейсмичности и материала стен."""

    try:
        raw = chat_completion_json(system, user)
    except DeepSeekError:
        return _template_analysis(data, result)

    types_raw = raw.get("types") or []
    by_type: dict[FoundationType, TypeInsight] = {}
    for item in types_raw:
        if not isinstance(item, dict):
            continue
        ftype = item.get("type")
        if ftype not in ("strip", "slab", "pile", "column"):
            continue
        by_type[ftype] = TypeInsight(
            type=ftype,
            pros=[str(x) for x in (item.get("pros") or [])][:8],
            cons=[str(x) for x in (item.get("cons") or [])][:8],
        )

    ordered: list[TypeInsight] = []
    for opt in all_opts:
        if opt.type in by_type:
            ordered.append(by_type[opt.type])
        else:
            ordered.append(
                TypeInsight(
                    type=opt.type,
                    pros=[f"Пригодность JEV: {opt.score}%"],
                    cons=["DeepSeek не вернул описание для этого типа"],
                )
            )

    return CompareAnalysisResponse(
        overview=str(raw.get("overview") or "Сравнительный анализ вариантов фундамента."),
        why_recommended=str(
            raw.get("why_recommended")
            or f"Рекомендован {_TYPE_RU[result.recommended.type]} фундамент."
        ),
        types=ordered,
        provider="deepseek",
    )
