from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.services.reference import PRELIMINARY_WARNING, region_ids


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
Seismicity = Literal["0-6", "7", "8+"]


class FoundationInput(BaseModel):
    soil_type: SoilType
    bearing_capacity: BearingCapacity
    groundwater_level: GroundwaterLevel
    floors: int = Field(ge=1, le=50, description="Этажность; 5 и более — категория 5+")
    building_area_m2: float = Field(gt=0, le=100_000, description="Площадь здания, м²")
    wall_material: WallMaterial
    region: str = Field(description="Код региона из GET /api/foundation/options")
    seismicity: Seismicity = Field(
        description="Сейсмичность, баллы: число 0–12 или категория '0-6', '7', '8+'"
    )

    @field_validator("region")
    @classmethod
    def _check_region(cls, value: str) -> str:
        allowed = region_ids()
        if value not in allowed:
            raise ValueError(f"Неизвестный регион '{value}'. Допустимые: {', '.join(allowed)}")
        return value

    @field_validator("seismicity", mode="before")
    @classmethod
    def _normalize_seismicity(cls, value: object) -> str:
        """Принимает 7, "7", "0-6", "8+", 9 и т.п. и приводит к категории MVP."""
        if isinstance(value, str) and value.strip() in ("0-6", "8+"):
            return value.strip()
        try:
            points = int(str(value).strip())
        except (TypeError, ValueError):
            raise ValueError("Сейсмичность: число баллов 0–12 или '0-6', '7', '8+'") from None
        if not 0 <= points <= 12:
            raise ValueError("Сейсмичность должна быть в диапазоне 0–12 баллов")
        if points <= 6:
            return "0-6"
        return "7" if points == 7 else "8+"


class CostBreakdown(BaseModel):
    concrete_rub: int
    rebar_rub: int
    excavation_rub: int
    installation_rub: int
    regional_coefficient: float
    concrete_m3: float
    rebar_t: float
    excavation_m3: float


class FoundationOption(BaseModel):
    type: FoundationType
    name: str
    score: int = Field(ge=0, le=100)
    estimated_cost_rub: int
    labor_hours: int
    reasons: list[str] = Field(default_factory=list, description="Факторы в пользу варианта")
    limitations: list[str] = Field(default_factory=list, description="Факторы против варианта")
    cost_breakdown: CostBreakdown | None = None


class FoundationRecommendResponse(BaseModel):
    recommended: FoundationOption
    alternatives: list[FoundationOption]
    warning: str = PRELIMINARY_WARNING
    warnings: list[str] = Field(default_factory=list, description="Дополнительные предупреждения по условиям")
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


class ReportParameter(BaseModel):
    label: str
    value: str


class ReportComparisonRow(BaseModel):
    type: FoundationType
    name: str
    score: int
    estimated_cost_rub: int
    labor_hours: int


class ReportResponse(BaseModel):
    title: str
    object_description: str
    parameters: list[ReportParameter]
    recommended_name: str
    recommended_score: int
    justification: str
    comparison: list[ReportComparisonRow]
    warning: str
    provider: Literal["deepseek", "template"]
    report_text: str = Field(description="Полный текст ТЭО для экспорта")


class OptionItem(BaseModel):
    value: str
    label: str


class InputOptionsResponse(BaseModel):
    soil_type: list[OptionItem]
    bearing_capacity: list[OptionItem]
    groundwater_level: list[OptionItem]
    wall_material: list[OptionItem]
    seismicity: list[OptionItem]
    region: list[OptionItem]
    foundation_types: list[OptionItem]
