from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, Field, ValidationInfo, field_validator, model_validator

from app.services.reference import PRELIMINARY_WARNING, REGION_ALIASES, region_ids


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


class FrostDepth(str, Enum):
    """Глубина сезонного промерзания, диапазоны как на форме фронта."""

    SHALLOW = "shallow"  # до 0,8 м
    MODERATE = "moderate"  # 0,8-1,5 м
    DEEP = "deep"  # 1,5-2,0 м
    VERY_DEEP = "very_deep"  # более 2,0 м


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
    frost_depth: FrostDepth | None = Field(
        default=None, description="Глубина промерзания; без неё Jev судит только по описанию климата"
    )

    @field_validator("region")
    @classmethod
    def _check_region(cls, value: str) -> str:
        """Принимает коды prices.json и коды из ТЗ (krasnoyarsk_krai, sverdlovsk_oblast)."""
        value = REGION_ALIASES.get(value, value)
        allowed = region_ids()
        if value not in allowed:
            accepted = [*allowed, *REGION_ALIASES]
            raise ValueError(f"Неизвестный регион '{value}'. Допустимые: {', '.join(accepted)}")
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
    scores: dict[FoundationType, int] = Field(
        default_factory=dict,
        description="Пригодность всех 4 типов, 0-100, не нормализуется (контракт ТЗ §5)",
    )
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


class ScoredType(BaseModel):
    type: FoundationType
    score: int = Field(ge=0, le=100)


class ExplainRequest(BaseModel):
    input: FoundationInput
    top3: list[ScoredType] = Field(min_length=1, max_length=3, description="Первый элемент считается победителем")

    @model_validator(mode="after")
    def _unique_types(self) -> "ExplainRequest":
        types = [item.type for item in self.top3]
        if len(set(types)) != len(types):
            raise ValueError("Типы фундамента в top3 не должны повторяться")
        return self


class Explanation(BaseModel):
    pros: list[str]
    cons: list[str]
    vs_others: str | None = Field(default=None, description="Только у победителя")


class ExplainResponse(BaseModel):
    explanations: dict[FoundationType, Explanation]


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


class EngineeringReportRequest(BaseModel):
    input: FoundationInput
    result: FoundationRecommendResponse


def _lower(value: object) -> object:
    return value.strip().lower() if isinstance(value, str) else value


RiskProbability = Annotated[Literal["низкая", "средняя", "высокая"], BeforeValidator(_lower)]
RiskScope = Annotated[FoundationType | Literal["общие"], BeforeValidator(_lower)]

# Критерии сравнительной матрицы: фиксированный список и порядок (план отчёта, раздел 3)
MATRIX_CRITERIA: tuple[str, ...] = (
    "Несущая способность",
    "Осадки и деформации",
    "Влияние грунтовых вод",
    "Климатические воздействия (промерзание)",
    "Сейсмостойкость",
)


class MatrixRow(BaseModel):
    criterion: str
    assessments: dict[FoundationType, str]


class ReviewItem(BaseModel):
    type: FoundationType
    applicability: str = Field(min_length=1)
    advantages: list[str] = Field(min_length=1)
    disadvantages: list[str] = Field(min_length=1)
    conditions: str = Field(min_length=1)


class RiskItem(BaseModel):
    scope: RiskScope
    description: str = Field(min_length=1)
    probability: RiskProbability
    consequence: str = Field(min_length=1)
    mitigation: str = Field(min_length=1)


class EngineeringReportContent(BaseModel):
    """Разделы отчёта из запроса B.

    Проверки против топ-3 выполняются, если в context передан {"top3": [типы по порядку]}.
    """

    summary_reason: str = Field(min_length=1)
    matrix: list[MatrixRow]
    review: list[ReviewItem]
    risks: list[RiskItem]
    conclusion: str = Field(min_length=1)
    application_conditions: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def _match_top3(self, info: ValidationInfo) -> "EngineeringReportContent":
        top: list[str] | None = (info.context or {}).get("top3")
        if not top:
            return self
        if [item.type for item in self.review] != top:
            raise ValueError(f"review должен содержать типы {top} в том же порядке")
        if [row.criterion for row in self.matrix] != list(MATRIX_CRITERIA):
            raise ValueError(f"matrix должна содержать критерии {list(MATRIX_CRITERIA)}")
        for row in self.matrix:
            missing = [t for t in top if t not in row.assessments]
            if missing:
                raise ValueError(f"matrix «{row.criterion}»: нет оценки для {missing}")
            row.assessments = {t: row.assessments[t] for t in top}
        for risk in self.risks:
            if risk.scope != "общие" and risk.scope not in top:
                raise ValueError(f"risks: scope {risk.scope} не входит в топ-3")
        uncovered = [t for t in top if not any(r.scope == t for r in self.risks)]
        if uncovered:
            raise ValueError(f"risks: нет рисков для {uncovered}")
        return self


class ReportMeta(BaseModel):
    # Формат ограничен: отчёт для PDF приходит от клиента, номер идёт в заголовок и в шаблон
    report_number: str = Field(pattern=r"^[0-9A-Za-z-]{1,32}$")
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="Дата формирования, ISO 8601")
    version: str


class RankedFoundation(BaseModel):
    type: FoundationType
    name: str
    score: int = Field(ge=0, le=100)


class SourceGroup(BaseModel):
    title: str
    rows: list[ReportParameter]


class EngineeringReportResponse(EngineeringReportContent):
    meta: ReportMeta
    top3: list[RankedFoundation]
    source_data: list[SourceGroup]
    provider: Literal["deepseek", "template"] = Field(description="Только для отладки, в отчёте не выводится")


class EngineeringPdfRequest(BaseModel):
    """Готовый отчёт со страницы: PDF повторяет его без нового запроса к LLM."""

    report: EngineeringReportResponse


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
