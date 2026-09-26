from fastapi import APIRouter, HTTPException

from app.schemas.foundation import (
    AnalyzeRequest,
    CompareAnalysisResponse,
    FoundationInput,
    FoundationRecommendResponse,
    ReportRequest,
    ReportResponse,
)
from app.services.comparison import build_compare_analysis
from app.services.recommendation import recommend
from app.services.report import generate_report

router = APIRouter(prefix="/foundation", tags=["foundation"])


@router.post("/recommend", response_model=FoundationRecommendResponse)
def post_recommend(payload: FoundationInput) -> FoundationRecommendResponse:
    try:
        return recommend(payload)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/analyze", response_model=CompareAnalysisResponse)
def post_analyze(payload: AnalyzeRequest) -> CompareAnalysisResponse:
    return build_compare_analysis(payload.input, payload.result)


@router.post("/report", response_model=ReportResponse)
def post_report(payload: ReportRequest) -> ReportResponse:
    return generate_report(payload.input, payload.result)
