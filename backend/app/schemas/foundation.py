from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class SoilType(str, Enum):
    SAND = "sand"
    SANDY_LOAM = "sandy_loam"
    LOAM = "loam"
    CLAY = "clay"
    FILL = "fill"


class BearingCapacity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class GroundwaterLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class WallMaterial(str, Enum):
    WOOD = "wood"
    AERATED_CONCRETE = "aerated_concrete"
    BRICK = "brick"
    REINFORCED_CONCRETE = "reinforced_concrete"


FoundationType = Literal["strip", "slab", "pile", "column"]


class FoundationInput(BaseModel):
    soil_type: SoilType
    bearing_capacity: BearingCapacity
    groundwater_level: GroundwaterLevel
    floors: int = Field(ge=1, le=10)
    building_area_m2: float = Field(gt=0)
    wall_material: WallMaterial
    region: str
    seismicity: str = Field(description="0-6, 7, or 8+")


class FoundationOption(BaseModel):
    type: FoundationType
    score: int = Field(ge=0, le=100)
    estimated_cost_rub: float
    labor_hours: float
    reasons: list[str]


class FoundationRecommendResponse(BaseModel):
    recommended: FoundationOption
    alternatives: list[FoundationOption]
    warning: str | None = None
    score_source: Literal["jev", "rules_fallback"] = "rules_fallback"


class TypeInsight(BaseModel):
    type: FoundationType
    pros: list[str]
    cons: list[str]


class CompareAnalysisResponse(BaseModel):
    overview: str
    why_recommended: str
    types: list[TypeInsight]
    provider: Literal["deepseek", "template"]


class AnalyzeRequest(BaseModel):
    input: FoundationInput
    result: FoundationRecommendResponse


class ReportRequest(BaseModel):
    input: FoundationInput
    result: FoundationRecommendResponse


class ReportResponse(BaseModel):
    report_text: str
