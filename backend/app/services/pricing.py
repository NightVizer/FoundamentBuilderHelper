"""Ориентировочная стоимость и трудозатраты (не смета).

Стоимость = (бетон + арматура + земляные работы + монтаж) × региональный коэффициент.
Объёмы работ считаются от площади здания с учётом нагрузки (этажность, материал стен)
и условий площадки (УГВ, насыпной грунт, сейсмичность).
"""

from dataclasses import dataclass

from app.schemas.foundation import CostBreakdown, FoundationInput, FoundationType
from app.services.reference import load_prices


@dataclass
class WorkVolumes:
    concrete_m3: float
    rebar_t: float
    excavation_m3: float
    installation_factor: float


def _load_factor(data: FoundationInput) -> float:
    load = load_prices()["load"]
    return (1 + (data.floors - 1) * load["per_extra_floor"]) * load["wall_material"][data.wall_material.value]


def work_volumes(data: FoundationInput, foundation_type: FoundationType) -> WorkVolumes:
    prices = load_prices()
    q = prices["quantities"][foundation_type]
    adj = prices["adjustments"]
    area = data.building_area_m2

    concrete = q["concrete_m3_per_m2"] * area * _load_factor(data)
    rebar = concrete * q["rebar_t_per_m3"] * adj["seismic_rebar"][data.seismicity]

    excavation = q["excavation_m3_per_m2"] * area
    if data.groundwater_level.value == "high":
        excavation *= adj["high_groundwater_excavation"]  # водопонижение
    if data.soil_type.value == "fill":
        excavation *= adj["fill_soil_excavation"]  # замена/уплотнение насыпного грунта

    return WorkVolumes(
        concrete_m3=concrete,
        rebar_t=rebar,
        excavation_m3=excavation,
        installation_factor=q["installation_factor"],
    )


def estimate_cost(data: FoundationInput, foundation_type: FoundationType) -> CostBreakdown:
    region = load_prices()["regions"][data.region]
    k = region["coefficient"]
    v = work_volumes(data, foundation_type)

    return CostBreakdown(
        concrete_rub=round(v.concrete_m3 * region["concrete_m3"] * k),
        rebar_rub=round(v.rebar_t * region["rebar_ton"] * k),
        excavation_rub=round(v.excavation_m3 * region["excavation_m3"] * k),
        installation_rub=round(v.concrete_m3 * region["installation_m3"] * v.installation_factor * k),
        regional_coefficient=k,
        concrete_m3=round(v.concrete_m3, 1),
        rebar_t=round(v.rebar_t, 2),
        excavation_m3=round(v.excavation_m3, 1),
    )


def total_cost(breakdown: CostBreakdown) -> int:
    """Итог, округлённый до тысяч рублей — точнее для ориентировочной оценки не нужно."""
    total = breakdown.concrete_rub + breakdown.rebar_rub + breakdown.excavation_rub + breakdown.installation_rub
    return round(total, -3)


def estimate_labor_hours(data: FoundationInput, foundation_type: FoundationType) -> int:
    labor = load_prices()["labor"]
    v = work_volumes(data, foundation_type)
    hours = (
        v.concrete_m3 * labor["concrete_h_per_m3"] * labor["complexity"][foundation_type]
        + v.rebar_t * labor["rebar_h_per_t"]
        + v.excavation_m3 * labor["excavation_h_per_m3"]
    )
    return round(hours)
