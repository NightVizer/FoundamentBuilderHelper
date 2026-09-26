from fastapi import APIRouter, HTTPException

from app.schemas.foundation import (
    AnalyzeRequest,
    CompareAnalysisResponse,
    FoundationInput,
    FoundationRecommendResponse,
    InputOptionsResponse,
    OptionItem,
    ReportRequest,
    ReportResponse,
)
from app.services.comparison import build_compare_analysis
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
    try:
        return recommend(payload)
    except JevAnalysisError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/analyze", response_model=CompareAnalysisResponse)
def post_analyze(payload: AnalyzeRequest) -> CompareAnalysisResponse:
    return build_compare_analysis(payload.input, payload.result)


@router.post("/report", response_model=ReportResponse)
def post_report(payload: ReportRequest) -> ReportResponse:
    return generate_report(payload.input, payload.result)
