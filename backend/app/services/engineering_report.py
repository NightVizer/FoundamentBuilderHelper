"""Инженерный отчёт (запрос B): разделы отчёта одним запросом к LLM.

Типы и оценки пригодности задаёт Jev, LLM их не меняет и только описывает.
Шаблонного фолбэка нет: при ошибке LLM эндпоинт отдаёт 502.
"""

import json
import logging
import re
from datetime import date
from typing import Any
from uuid import uuid4

from pydantic import ValidationError

from app.schemas.foundation import (
    MATRIX_CRITERIA,
    EngineeringReportContent,
    EngineeringReportResponse,
    FoundationInput,
    FoundationRecommendResponse,
    RankedFoundation,
    ReportMeta,
    ReportParameter,
    ScoredType,
    SourceGroup,
)
from app.services.comparison import _OFF_TOPIC, IncompleteAnswerError, rank_top3
from app.services.deepseek_client import chat_completion_json
from app.services.reference import (
    FOUNDATION_NAMES,
    FROST_LABELS,
    GROUNDWATER_LABELS,
    LEVEL_LABELS,
    REGION_CLIMATE,
    SEISMICITY_LABELS,
    SOIL_LABELS,
    WALL_LABELS,
    region_name,
)

logger = logging.getLogger(__name__)

REPORT_VERSION = "1.0"
MAX_ITEMS = 6

# Сверх фильтра запроса A: сроки работ, ссылки на нормативы, упоминания ИИ (план отчёта, раздел 1).
_BANNED = re.compile(
    "|".join(
        [
            _OFF_TOPIC.pattern,
            r"\d+\s*(?:из|/)\s*100\b",
            r"срок\w*\s+(?:строительств|возведени|производств|монтаж)",
            r"\b(?:СП|СНиП|ГОСТ|ТСН|ВСН|Еврокод\w*|Eurocode)\b",
            r"нейросет|искусственн\w*\s+интеллект|\bИИ\b|языков\w*\s+модел|сгенерир",
        ]
    ),
    re.I,
)
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")

SYSTEM_PROMPT = """Ты составляешь разделы инженерного отчёта по выбору типа фундамента для проектировщиков.
Варианты фундамента и оценки их пригодности уже определены, ты их не пересматриваешь и не меняешь порядок.

Правила:
1. Отвечай только JSON по заданной схеме, без markdown и пояснений вокруг.
2. Используй инженерную терминологию: несущая способность грунта основания, осадка и неравномерная осадка,
   деформации основания, уровень грунтовых вод, гидростатическое давление, обводнение котлована, глубина
   сезонного промерзания, морозное пучение, пучинистость грунта, касательные силы пучения, сейсмические
   воздействия, пространственная жёсткость конструкции, технологичность производства работ и другие термины,
   относящиеся к каждому критерию.
3. Сухой фактологический стиль технического документа. Без оценочных и разговорных оборотов
   («отличный вариант», «к сожалению», «смело можно», «идеально»), без обращений к читателю.
4. Не упоминай искусственный интеллект, нейросети, модели, автоматическую генерацию и источник оценок.
5. Не ссылайся на нормативные документы (СП, СНиП, ГОСТ и любые другие).
6. Не пиши о стоимости, ценах, экономии, сроках строительства, трудозатратах. Не приводи оценки и проценты
   пригодности. Числа допускаются только из исходных данных (этажность, площадь, баллы, диапазон промерзания).
7. Опирайся только на исходные данные. Не добавляй параметры, которых там нет (результаты изысканий, уклон
   участка, глубины заложения, сечения, армирование, марки бетона). Характеристики называй теми же словами,
   что в исходных данных, не усиливая и не ослабляя: средняя несущая способность остаётся «средней», грунт
   при ней не «слабый», не «прочный», несущая способность не «недостаточная»; средний уровень грунтовых вод
   не «высокий». Недостатки варианта описывай через его работу в заданных условиях, а не через свойства грунта.
8. Риски только технические: связанные с выбором типа фундамента в заданных грунтовых, гидрогеологических,
   климатических и сейсмических условиях и с нагрузками от здания.
9. Язык русский."""


def _area(value: float) -> str:
    """12345.5 → '12 345,5'."""
    text = f"{value:,.2f}".rstrip("0").rstrip(".")
    return text.replace(",", " ").replace(".", ",")


def _climate(data: FoundationInput) -> str:
    """Климат без названия региона: фронт выбирает регион как представителя типа климата.

    Качественная оценка промерзания из описания убирается, если глубина задана отдельно,
    чтобы не противоречить ей.
    """
    text = REGION_CLIMATE.get(data.region, {}).get("ru") or region_name(data.region)
    if data.frost_depth is not None:
        text = ", ".join(part for part in text.split(", ") if "промерзан" not in part)
    return text[:1].upper() + text[1:]


def source_groups(data: FoundationInput) -> list[SourceGroup]:
    """Раздел «Исходные данные»: эхо входа. Те же строки уходят в промпт."""
    climate_rows = [ReportParameter(label="Климат", value=_climate(data))]
    if data.frost_depth is not None:
        climate_rows.append(
            ReportParameter(label="Глубина сезонного промерзания", value=FROST_LABELS[data.frost_depth.value])
        )
    climate_rows.append(ReportParameter(label="Сейсмичность", value=SEISMICITY_LABELS[data.seismicity]))
    return [
        SourceGroup(
            title="Грунтовые условия",
            rows=[
                ReportParameter(label="Тип грунта", value=SOIL_LABELS[data.soil_type.value]),
                ReportParameter(label="Несущая способность грунта", value=LEVEL_LABELS[data.bearing_capacity.value]),
                ReportParameter(
                    label="Уровень грунтовых вод", value=GROUNDWATER_LABELS[data.groundwater_level.value]
                ),
            ],
        ),
        SourceGroup(
            title="Здание",
            rows=[
                ReportParameter(label="Этажность", value=str(data.floors)),
                ReportParameter(label="Площадь здания", value=f"{_area(data.building_area_m2)} м²"),
                ReportParameter(label="Материал стен", value=WALL_LABELS[data.wall_material.value]),
            ],
        ),
        SourceGroup(title="Климат и сейсмичность", rows=climate_rows),
    ]


def _user_prompt(data: FoundationInput, top: list[ScoredType]) -> str:
    source = "\n".join(f"- {row.label}: {row.value.lower()}" for group in source_groups(data) for row in group.rows)
    ranking = "\n".join(
        f"{i}. {item.type}: {FOUNDATION_NAMES[item.type]}, оценка пригодности {item.score} из 100"
        for i, item in enumerate(top, start=1)
    )
    codes = [item.type for item in top]
    criteria = "\n".join(f"   - {c}" for c in MATRIX_CRITERIA)
    shape = {
        "summary_reason": "...",
        "matrix": [{"criterion": c, "assessments": {t: "..." for t in codes}} for c in MATRIX_CRITERIA],
        "review": [
            {"type": t, "applicability": "...", "advantages": ["..."], "disadvantages": ["..."], "conditions": "..."}
            for t in codes
        ],
        "risks": [
            {"scope": codes[0], "description": "...", "probability": "средняя", "consequence": "...", "mitigation": "..."}
        ],
        "conclusion": "...",
        "application_conditions": ["..."],
    }
    return f"""Исходные данные:
{source}

Варианты фундамента по убыванию пригодности (первый рекомендован):
{ranking}

Заполни разделы отчёта:
- summary_reason: одно предложение, какими условиями из исходных данных обусловлен выбор варианта "{codes[0]}".
- matrix: ровно {len(MATRIX_CRITERIA)} строк в этом порядке, названия критериев без изменений:
{criteria}
  В assessments для каждого варианта ({", ".join(codes)}) краткая качественная оценка работы
  фундамента по критерию в заданных условиях, до 12 слов.
- review: по одному элементу на каждый вариант в том же порядке ({", ".join(codes)}).
  applicability: 2-4 предложения, чем обоснована применимость варианта в заданных условиях.
  advantages: 3-4 пункта. disadvantages: 2-3 пункта, только технические ограничения.
  conditions: 1-2 предложения, при каких условиях и мероприятиях вариант применим.
- risks: для каждого варианта 1-3 технических риска (scope — код варианта) и не более 2 рисков,
  общих для площадки (scope — "общие"). probability: только "низкая", "средняя" или "высокая".
  description, consequence и mitigation: по одному предложению.
- conclusion: итоговый абзац, 3-5 предложений: рекомендованный вариант, определяющие условия, роль альтернатив.
- application_conditions: 3-5 условий применения результатов отчёта (предварительный характер решения,
  необходимые инженерно-геологические изыскания и расчёты основания).
Пункты списков короткие, до 15 слов.

Верни JSON строго такой структуры:
{json.dumps(shape, ensure_ascii=False, indent=2)}"""


def _is_banned(text: str) -> bool:
    return bool(_BANNED.search(text))


def _clean_text(value: Any, where: str) -> str:
    """Абзац без предложений о стоимости, сроках, нормативах и т.п."""
    if not isinstance(value, str):
        return ""
    sentences = [s for s in _SENTENCE_END.split(value.strip()) if s]
    kept = [s for s in sentences if not _is_banned(s)]
    if len(kept) < len(sentences):
        logger.info("LLM: отброшены предложения в %s: %s", where, [s for s in sentences if _is_banned(s)])
    return " ".join(kept)


def _clean_items(value: Any, where: str) -> list[str]:
    if not isinstance(value, list):
        return []
    items = [str(x).strip() for x in value if isinstance(x, str | int | float) and str(x).strip()]
    dropped = [x for x in items if _is_banned(x)]
    if dropped:
        logger.info("LLM: отброшены пункты в %s: %s", where, dropped)
    return [x for x in items if x not in dropped][:MAX_ITEMS]


def _criterion_key(text: str) -> str:
    text = re.sub(r"\(.*?\)", "", text.lower().replace("ё", "е"))
    return " ".join(text.split())


_CRITERIA_BY_KEY = {_criterion_key(c): c for c in MATRIX_CRITERIA}


def _dicts(value: Any) -> list[dict[str, Any]]:
    return [x for x in value if isinstance(x, dict)] if isinstance(value, list) else []


def _clean_answer(raw: dict[str, Any], top: list[str]) -> dict[str, Any]:
    """Пост-фильтр ответа до проверки схемой: названия критериев к каноническим, лишние типы и пункты вне темы долой."""
    matrix: dict[str, dict[str, Any]] = {}
    for row in _dicts(raw.get("matrix")):
        name = _CRITERIA_BY_KEY.get(_criterion_key(str(row.get("criterion", ""))))
        if name is None:
            logger.info("LLM: неизвестный критерий матрицы: %r", row.get("criterion"))
            continue
        assessments = row.get("assessments") if isinstance(row.get("assessments"), dict) else {}
        cleaned = {t: str(assessments[t]).strip() for t in top if str(assessments.get(t) or "").strip()}
        matrix[name] = {"criterion": name, "assessments": {t: v for t, v in cleaned.items() if not _is_banned(v)}}

    review = [
        {
            "type": item.get("type"),
            "applicability": _clean_text(item.get("applicability"), f"review.{item.get('type')}.applicability"),
            "advantages": _clean_items(item.get("advantages"), f"review.{item.get('type')}.advantages"),
            "disadvantages": _clean_items(item.get("disadvantages"), f"review.{item.get('type')}.disadvantages"),
            "conditions": _clean_text(item.get("conditions"), f"review.{item.get('type')}.conditions"),
        }
        for item in _dicts(raw.get("review"))
    ]

    risk_fields = ("description", "consequence", "mitigation")
    risks = []
    for item in _dicts(raw.get("risks")):
        texts = {f: str(item.get(f) or "").strip() for f in risk_fields}
        if any(_is_banned(t) for t in texts.values()):
            logger.info("LLM: отброшен риск вне темы: %s", texts["description"])
            continue
        risks.append({"scope": item.get("scope"), "probability": item.get("probability"), **texts})

    return {
        "summary_reason": _clean_text(raw.get("summary_reason"), "summary_reason"),
        "matrix": [matrix[c] for c in MATRIX_CRITERIA if c in matrix],
        "review": review,
        "risks": risks,
        "conclusion": _clean_text(raw.get("conclusion"), "conclusion"),
        "application_conditions": _clean_items(raw.get("application_conditions"), "application_conditions"),
    }


def generate_content(data: FoundationInput, top: list[ScoredType]) -> EngineeringReportContent:
    codes = [item.type for item in top]
    raw = chat_completion_json(SYSTEM_PROMPT, _user_prompt(data, top))
    try:
        return EngineeringReportContent.model_validate(_clean_answer(raw, codes), context={"top3": codes})
    except ValidationError as exc:
        raise IncompleteAnswerError(
            f"LLM: ответ не прошёл проверку схемы отчёта (ключи ответа: {sorted(raw)}): {exc}"
        ) from exc


def generate_content_with_retry(data: FoundationInput, top: list[ScoredType]) -> EngineeringReportContent:
    """Ответ, не прошедший проверку схемы, запрашивается повторно один раз (всего 2 попытки)."""
    try:
        return generate_content(data, top)
    except IncompleteAnswerError as exc:
        logger.warning("Отчёт: неполный ответ LLM, повтор: %s", exc)
        return generate_content(data, top)


def build_engineering_report(data: FoundationInput, result: FoundationRecommendResponse) -> EngineeringReportResponse:
    top = rank_top3(result)
    content = generate_content_with_retry(data, top)
    return EngineeringReportResponse(
        **content.model_dump(),
        meta=ReportMeta(report_number=uuid4().hex[:8].upper(), date=date.today().isoformat(), version=REPORT_VERSION),
        top3=[RankedFoundation(type=t.type, name=FOUNDATION_NAMES[t.type], score=t.score) for t in top],
        source_data=source_groups(data),
        provider="deepseek",
    )
