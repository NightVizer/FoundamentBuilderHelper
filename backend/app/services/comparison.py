"""Тексты «плюсы / минусы / чем лучше альтернатив» для топ-3 одним запросом к LLM (ТЗ §5).

Типы и проценты задаёт Jev, LLM их не меняет и только описывает.
Шаблонного фолбэка нет: при ошибке LLM эндпоинт отдаёт 502 (ТЗ §7).
"""

import json
import logging
import re
from typing import Any

from app.schemas.foundation import (
    CompareAnalysisResponse,
    Explanation,
    ExplainResponse,
    FoundationInput,
    FoundationRecommendResponse,
    ScoredType,
    TypeInsight,
)
from app.services.deepseek_client import DeepSeekError, chat_completion_json
from app.services.reference import (
    FOUNDATION_NAMES,
    GROUNDWATER_LABELS,
    LEVEL_LABELS,
    REGION_CLIMATE,
    SEISMICITY_LABELS,
    SOIL_LABELS,
    WALL_LABELS,
    region_name,
)

logger = logging.getLogger(__name__)

MAX_ITEMS = 6

# Стоимость и трудозатраты исключены из MVP (ТЗ §9); LLM изредка нарушает правило 2 промпта,
# поэтому такие пункты отбрасываются в коде.
_OFF_TOPIC = re.compile(
    r"стоимост|\bцен[аыуе]\b|\bдорог|дешёв|дешев|экономи|бюджет|трудо[её]мк|трудозатрат|\d+\s*%", re.I
)


class IncompleteAnswerError(DeepSeekError):
    """LLM ответила, но без нужного типа или с пустыми списками."""

SYSTEM_PROMPT = """Ты инженер-консультант по фундаментам. Пишешь пояснения к уже сделанному выбору для заказчика.
Выбор и оценки пригодности сделала другая модель, ты их не пересматриваешь.

Правила:
1. Опирайся только на исходные данные из запроса. Не придумывай параметры, которых там нет
   (уклон участка, конкретная глубина промерзания, результаты изысканий, сроки, бюджет и т.п.).
   Передавай значения точно, не усиливая и не ослабляя их: при средней несущей способности
   грунт не «слабый» и не «прочный», при среднем уровне грунтовых вод он не «высокий».
2. Не пиши о стоимости, цене, экономии, трудозатратах и сроках строительства. Минусы только
   технические: нужна спецтехника, сложная гидроизоляция, риск осадок, чувствительность к пучению и т.п.
3. Не пиши числа оценок и проценты пригодности, не называй варианты «лучшим на N%».
4. Не делай нормативных расчётов: никаких глубин заложения, сечений, армирования, марок бетона.
5. Не меняй список типов и их порядок.
6. Каждый пункт привязан к условиям задачи (грунт, несущая способность, грунтовые воды, этажность,
   площадь, материал стен, климат региона, сейсмичность). Плюсы только положительные, минусы только
   отрицательные. Пункт «существенных минусов нет» не допускается: укажи реальное ограничение.
7. Язык русский, пункты короткие (до 15 слов), без markdown.
Отвечай только JSON."""


def _input_block(data: FoundationInput) -> str:
    climate = REGION_CLIMATE.get(data.region, {}).get("ru")
    region = region_name(data.region) + (f" ({climate})" if climate else "")
    lines = [
        f"- Тип грунта: {SOIL_LABELS[data.soil_type.value]}",
        f"- Несущая способность грунта: {LEVEL_LABELS[data.bearing_capacity.value].lower()}",
        f"- Уровень грунтовых вод: {GROUNDWATER_LABELS[data.groundwater_level.value].lower()}",
        f"- Этажность: {data.floors}",
        f"- Площадь здания: {data.building_area_m2:g} м²",
        f"- Материал стен: {WALL_LABELS[data.wall_material.value].lower()}",
        f"- Регион: {region}",
        f"- Сейсмичность: {SEISMICITY_LABELS[data.seismicity]}",
    ]
    return "\n".join(lines)


def _user_prompt(data: FoundationInput, top: list[ScoredType]) -> str:
    winner, alternatives = top[0], top[1:]
    ranking = "\n".join(
        f"{i}. {item.type}: {FOUNDATION_NAMES[item.type]}" for i, item in enumerate(top, start=1)
    )
    alt_names = ", ".join(FOUNDATION_NAMES[a.type].lower() for a in alternatives)
    vs_rule = (
        f'У "{winner.type}" добавь "vs_others": 2-3 предложения, чем он лучше, чем {alt_names}, '
        "именно в этих условиях. Называй альтернативы по имени."
        if alternatives
        else ""
    )
    shape: dict[str, Any] = {
        winner.type: {"pros": ["..."], "cons": ["..."], **({"vs_others": "..."} if alternatives else {})},
        **{a.type: {"pros": ["..."], "cons": ["..."]} for a in alternatives},
    }
    return f"""Исходные данные:
{_input_block(data)}

Варианты по убыванию пригодности (первый рекомендован):
{ranking}

Для "{winner.type}": 3-4 плюса и 2-3 минуса.
Для остальных: 2-3 плюса и 2 минуса.
{vs_rule}

Верни JSON строго такой структуры, ключи верхнего уровня — коды типов:
{json.dumps({"explanations": shape}, ensure_ascii=False, indent=2)}"""


def _clean_list(value: Any, ftype: str, field: str) -> list[str]:
    if not isinstance(value, list):
        raise IncompleteAnswerError(f"LLM: у {ftype} нет списка {field}")
    items = [str(x).strip() for x in value if str(x).strip()]
    dropped = [x for x in items if _OFF_TOPIC.search(x)]
    if dropped:
        logger.info("LLM: отброшены пункты про стоимость/проценты у %s: %s", ftype, dropped)
        items = [x for x in items if x not in dropped]
    if not items:
        raise IncompleteAnswerError(f"LLM: у {ftype} пустой список {field}")
    return items[:MAX_ITEMS]


def explain_top(data: FoundationInput, top: list[ScoredType]) -> ExplainResponse:
    """Тексты для переданных типов (первый — победитель, у него есть vs_others)."""
    raw = chat_completion_json(SYSTEM_PROMPT, _user_prompt(data, top))
    block = raw.get("explanations", raw)
    if not isinstance(block, dict):
        raise IncompleteAnswerError("LLM: нет объекта explanations")

    explanations: dict[str, Explanation] = {}
    for index, item in enumerate(top):
        entry = block.get(item.type)
        if not isinstance(entry, dict):
            raise IncompleteAnswerError(f"LLM не вернул текст для {item.type}")
        vs_others = None
        if index == 0 and len(top) > 1:
            vs_others = str(entry.get("vs_others") or "").strip()
            if not vs_others:
                raise IncompleteAnswerError(f"LLM не вернул vs_others для {item.type}")
        explanations[item.type] = Explanation(
            pros=_clean_list(entry.get("pros"), item.type, "pros"),
            cons=_clean_list(entry.get("cons"), item.type, "cons"),
            vs_others=vs_others,
        )
    return ExplainResponse(explanations=explanations)


def explain_with_retry(data: FoundationInput, top: list[ScoredType]) -> ExplainResponse:
    """Неполный ответ LLM (нет типа, пустой список) повторяется один раз."""
    try:
        return explain_top(data, top)
    except IncompleteAnswerError as exc:
        logger.warning("Неполный ответ LLM, повтор: %s", exc)
        return explain_top(data, top)


def rank_top3(result: FoundationRecommendResponse) -> list[ScoredType]:
    """Топ-3 как на фронте: по убыванию score, при равенстве сохраняется порядок бэкенда."""
    options = sorted([result.recommended, *result.alternatives], key=lambda o: -o.score)
    return [ScoredType(type=o.type, score=o.score) for o in options[:3]]


def build_compare_analysis(
    data: FoundationInput, result: FoundationRecommendResponse
) -> CompareAnalysisResponse:
    """Старый контракт /analyze поверх /explain: тексты только для топ-3."""
    top = rank_top3(result)
    explained = explain_with_retry(data, top).explanations
    winner = explained[top[0].type]
    return CompareAnalysisResponse(
        overview=f"Рекомендован {FOUNDATION_NAMES[top[0].type].lower()}.",
        why_recommended=winner.vs_others or "",
        types=[TypeInsight(type=t.type, pros=explained[t.type].pros, cons=explained[t.type].cons) for t in top],
        provider="deepseek",
    )
