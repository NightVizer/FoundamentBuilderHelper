import logging

from fastapi import APIRouter, HTTPException

from app.schemas.foundation import (
    AnalyzeRequest,
    CompareAnalysisResponse,
    ExplainRequest,
    ExplainResponse,
    FoundationInput,
    FoundationRecommendResponse,
    InputOptionsResponse,
    OptionItem,
    ReportRequest,
    ReportResponse,
)
from app.services.comparison import build_compare_analysis, explain_with_retry
from app.services.deepseek_client import DeepSeekError
from app.services.jev_client import JevAnalysisError
from app.services.recommendation import recommend
from app.services.reference import (
    FOUNDATION_NAMES,
    GROUNDWATER_LABELS,
    LEVEL_LABELS,
    SEISMICITY_LABELS,
    SOIL_LABELS,
    WALL_LABELS,
    load_prices,
)
from app.services.report import generate_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/foundation", tags=["foundation"])


def _items(labels: dict[str, str]) -> list[OptionItem]:
    return [OptionItem(value=k, label=v) for k, v in labels.items()]


@router.get("/options", response_model=InputOptionsResponse)
def get_options() -> InputOptionsResponse:
    """Допустимые значения полей формы с русскими названиями (регионы — из prices.json)."""
    regions = {k: v["name"] for k, v in load_prices()["regions"].items()}
    return InputOptionsResponse(
        soil_type=_items(SOIL_LABELS),
        bearing_capacity=_items(LEVEL_LABELS),
        groundwater_level=_items(GROUNDWATER_LABELS),
        wall_material=_items(WALL_LABELS),
        seismicity=_items(SEISMICITY_LABELS),
        region=_items(regions),
        foundation_types=_items(FOUNDATION_NAMES),
    )


@router.post("/recommend", response_model=FoundationRecommendResponse)
def post_recommend(payload: FoundationInput) -> FoundationRecommendResponse:
    """Проценты всех 4 типов от Jev. Ошибка Jev → 502 (ТЗ §7), без подмены rule engine."""
    try:
        return recommend(payload)
    except JevAnalysisError as exc:
        logger.error("/recommend: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/explain", response_model=ExplainResponse, response_model_exclude_none=True)
def post_explain(payload: ExplainRequest) -> ExplainResponse:
    """Контракт ТЗ §5: {input, top3} → explanations.{type}.{pros, cons, vs_others у победителя}."""
    try:
        return explain_with_retry(payload.input, payload.top3)
    except DeepSeekError as exc:
        logger.error("/explain: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/analyze", response_model=CompareAnalysisResponse)
def post_analyze(payload: AnalyzeRequest) -> CompareAnalysisResponse:
    """Совместимость с текущим фронтом: тексты для топ-3, why_recommended = vs_others победителя."""
    try:
        return build_compare_analysis(payload.input, payload.result)
    except DeepSeekError as exc:
        logger.error("/analyze: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/report", response_model=ReportResponse)
def post_report(payload: ReportRequest) -> ReportResponse:
    return generate_report(payload.input, payload.result)
