import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

client = TestClient(app)

# Пример запроса из описания MVP (раздел 6)
SPEC_INPUT = {
    "soil_type": "loam",
    "bearing_capacity": "medium",
    "groundwater_level": "high",
    "floors": 3,
    "building_area_m2": 450,
    "wall_material": "brick",
    "region": "krasnoyarsk",
    "seismicity": 7,
}


@pytest.fixture(autouse=True)
def no_external_services(monkeypatch):
    """Тесты не ходят в JEV/DeepSeek: работают rule engine и шаблон."""
    for var in ("JEV_API_URL", "DEEPSEEK_API_KEY"):
        monkeypatch.delenv(var, raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def recommend(**overrides):
    return client.post("/api/foundation/recommend", json={**SPEC_INPUT, **overrides})


def test_spec_example_recommends_pile():
    res = recommend()
    assert res.status_code == 200, res.text
    body = res.json()

    rec = body["recommended"]
    assert rec["type"] == "pile"
    assert rec["name"] == "Свайный фундамент"
    assert "Высокий уровень грунтовых вод" in rec["reasons"]
    assert body["warning"] == "Предварительное решение. Требуется проверка проектировщиком."

    all_opts = [rec, *body["alternatives"]]
    assert {o["type"] for o in all_opts} == {"strip", "slab", "pile", "column"}
    scores = [o["score"] for o in all_opts]
    assert scores == sorted(scores, reverse=True)
    for o in all_opts:
        assert 0 <= o["score"] <= 100
        assert o["estimated_cost_rub"] > 0
        assert o["labor_hours"] > 0


def test_region_changes_cost_but_not_score():
    kras = recommend(region="krasnoyarsk").json()["recommended"]
    msk = recommend(region="moscow").json()["recommended"]
    assert kras["type"] == msk["type"]
    assert kras["score"] == msk["score"]
    assert kras["estimated_cost_rub"] != msk["estimated_cost_rub"]


def test_light_house_on_strong_soil_prefers_shallow_foundation():
    res = recommend(
        soil_type="sand",
        bearing_capacity="high",
        groundwater_level="low",
        floors=1,
        wall_material="wood",
        seismicity="0-6",
    )
    assert res.json()["recommended"]["type"] in ("column", "strip")


def test_more_floors_increase_cost_and_labor():
    low = {o["type"]: o for o in _all(recommend(floors=1).json())}
    high = {o["type"]: o for o in _all(recommend(floors=5).json())}
    for ftype in low:
        assert high[ftype]["estimated_cost_rub"] > low[ftype]["estimated_cost_rub"]
        assert high[ftype]["labor_hours"] > low[ftype]["labor_hours"]


@pytest.mark.parametrize(
    ("value", "expected"),
    [(0, "0-6"), (6, "0-6"), ("0-6", "0-6"), (7, "7"), ("7", "7"), (8, "8+"), (9, "8+"), ("8+", "8+")],
)
def test_seismicity_normalization(value, expected):
    from app.schemas.foundation import FoundationInput

    assert FoundationInput(**{**SPEC_INPUT, "seismicity": value}).seismicity == expected


@pytest.mark.parametrize(
    "overrides",
    [
        {"region": "atlantis"},
        {"soil_type": "rock"},
        {"floors": 0},
        {"building_area_m2": -5},
        {"seismicity": 15},
        {"seismicity": "много"},
    ],
)
def test_invalid_input_rejected(overrides):
    assert recommend(**overrides).status_code == 422


def test_options_lists_regions():
    body = client.get("/api/foundation/options").json()
    regions = {r["value"]: r["label"] for r in body["region"]}
    assert regions["krasnoyarsk"] == "Красноярский край"
    assert len(body["foundation_types"]) == 4


def test_report_keeps_numbers_from_result():
    result = recommend().json()
    res = client.post("/api/foundation/report", json={"input": SPEC_INPUT, "result": result})
    assert res.status_code == 200, res.text
    report = res.json()

    assert report["provider"] == "template"
    assert report["object_description"] == "3-этажное кирпичное здание"
    assert report["recommended_name"] == result["recommended"]["name"]
    assert report["recommended_score"] == result["recommended"]["score"]
    assert [r["estimated_cost_rub"] for r in report["comparison"]] == [
        o["estimated_cost_rub"] for o in _all(result)
    ]
    assert "Красноярский край" in report["report_text"]
    assert "предварительным" in report["warning"]


def test_analyze_template():
    result = recommend().json()
    res = client.post("/api/foundation/analyze", json={"input": SPEC_INPUT, "result": result})
    assert res.status_code == 200, res.text
    assert len(res.json()["types"]) == 4


def _all(body):
    return [body["recommended"], *body["alternatives"]]
