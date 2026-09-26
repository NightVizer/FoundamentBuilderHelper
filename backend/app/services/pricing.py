import json
from pathlib import Path

from app.schemas.foundation import FoundationInput, FoundationType

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_prices() -> dict:
    with open(_DATA_DIR / "prices.json", encoding="utf-8") as f:
        return json.load(f)


def estimate_cost(data: FoundationInput, foundation_type: FoundationType) -> float:
    prices = _load_prices()
    region_key = data.region if data.region in prices["regions"] else "ekb"
    coefficient = prices["regions"][region_key]["coefficient"]
    rates = prices["unit_rates_rub_per_m2"][foundation_type]
    area = data.building_area_m2
    floor_factor = 1.0 + (data.floors - 1) * 0.08

    base = sum(rates.values()) * area * floor_factor
    return round(base * coefficient, 2)


def estimate_labor_hours(data: FoundationInput, foundation_type: FoundationType) -> float:
    prices = _load_prices()
    hours_per_m2 = prices["labor_hours_per_m2"][foundation_type]
    floor_factor = 1.0 + (data.floors - 1) * 0.1
    return round(hours_per_m2 * data.building_area_m2 * floor_factor, 1)
