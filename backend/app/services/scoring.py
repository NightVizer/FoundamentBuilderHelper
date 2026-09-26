import json
from pathlib import Path

from app.schemas.foundation import FoundationInput, FoundationType

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_rules() -> dict:
    with open(_DATA_DIR / "rules.json", encoding="utf-8") as f:
        return json.load(f)


def _clamp_score(value: int) -> int:
    return max(0, min(100, value))


def score_all_types(data: FoundationInput) -> dict[FoundationType, tuple[int, list[str]]]:
    rules = _load_rules()
    base = rules["base_scores"]
    modifiers = rules["modifiers"]
    templates = rules["reason_templates"]

    result: dict[FoundationType, tuple[int, list[str]]] = {}

    for ftype in rules["foundation_types"]:
        score = int(base[ftype])
        reasons = list(templates.get(ftype, []))

        bc = modifiers["bearing_capacity"][data.bearing_capacity.value]
        score += bc[ftype]

        gw = modifiers["groundwater_level"][data.groundwater_level.value]
        score += gw[ftype]

        if data.floors >= 4:
            ft = modifiers["floors_threshold"]["4"]
            score += ft[ftype]
            if ftype == "slab":
                reasons.append("Многоэтажность повышает привлекательность плитного фундамента")
        elif data.floors >= 3:
            ft = modifiers["floors_threshold"]["3"]
            score += ft[ftype]

        if data.seismicity in ("7", "8+"):
            seis = modifiers["seismicity_high"]["types"]
            score += seis[ftype]
            if ftype == "slab":
                reasons.append("Учтена повышенная сейсмичность")

        result[ftype] = (_clamp_score(score), reasons)

    return result
