import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services import comparison, jev_client

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
    """Тесты не ходят в сеть: ключей нет, проценты по умолчанию от rule engine (SCORE_SOURCE=rules)."""
    for var in ("OPENROUTER_API_KEY", "JEV_API_KEY", "DEEPSEEK_API_KEY"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("SCORE_SOURCE", "rules")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def use_jev(monkeypatch, handler):
    """Включает Jev с поддельным транспортом httpx вместо OpenRouter."""
    monkeypatch.setenv("SCORE_SOURCE", "jev")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    get_settings.cache_clear()
    monkeypatch.setattr(
        jev_client, "make_client", lambda timeout: httpx.Client(transport=httpx.MockTransport(handler))
    )


def jev_answers(nouls):
    return {"answers": {t: {"type": "noul", "noul": v} for t, v in nouls.items()}, "usage": {"cost": 0.00004}}


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
    assert body["scores"] == {o["type"]: o["score"] for o in all_opts}
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


@pytest.mark.parametrize(
    ("code", "stored"),
    [("krasnoyarsk_krai", "krasnoyarsk"), ("sverdlovsk_oblast", "ekb"), ("ekb", "ekb"), ("moscow", "moscow")],
)
def test_spec_region_codes_accepted(code, stored):
    from app.schemas.foundation import FoundationInput

    assert FoundationInput(**{**SPEC_INPUT, "region": code}).region == stored
    assert recommend(region=code).status_code == 200


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


# --- Jev ------------------------------------------------------------------------


def test_jev_request_and_percentages(monkeypatch):
    sent = {}

    def handler(request: httpx.Request) -> httpx.Response:
        sent["url"] = str(request.url)
        sent["auth"] = request.headers["Authorization"]
        sent["body"] = json.loads(request.content)
        return httpx.Response(200, json=jev_answers({"strip": 0.41, "slab": 0.5, "pile": 0.734, "column": 0.405}))

    use_jev(monkeypatch, handler)
    res = recommend()
    assert res.status_code == 200, res.text
    body = res.json()

    # Один вызов Decisions API OpenRouter: 4 вопроса Noul, у каждого criteria true и false
    assert sent["url"] == "https://openrouter.ai/api/alpha/decisions"
    assert sent["auth"] == "Bearer test-key"
    assert sent["body"]["model"] == "typesafe/jev-1.13"
    questions = sent["body"]["questions"]
    assert set(questions) == {"strip", "slab", "pile", "column"}
    for q in questions.values():
        assert q["type"] == "noul"
        assert set(q["criteria"]) == {"true", "false"}
    assert "sharply continental" in sent["body"]["state"]["conditions"]["region_and_climate"]

    # noul 0-1 × 100 → проценты, сортировка по убыванию
    assert body["score_source"] == "jev"
    assert body["scores"] == {"pile": 73, "slab": 50, "strip": 41, "column": 40}
    assert body["recommended"]["type"] == "pile"
    assert [o["type"] for o in body["alternatives"]] == ["slab", "strip", "column"]


def test_jev_questions_carry_assessments_for_actual_input(monkeypatch):
    sent = {}

    def handler(request: httpx.Request) -> httpx.Response:
        sent["body"] = json.loads(request.content)
        return httpx.Response(200, json=jev_answers({"strip": 0.3, "slab": 0.6, "pile": 0.8, "column": 0.1}))

    use_jev(monkeypatch, handler)
    assert recommend(frost_depth="very_deep").status_code == 200

    state = sent["body"]["state"]
    assert state["site"]["soil_freezing_depth"] == "very deep (more than 2.0 m)"
    assert state["building"]["storeys"] == "3 storeys (band: 3 to 5 storeys)"
    assert "footprint_area" not in state["building"]

    def verdicts(ftype):
        items = sent["body"]["questions"][ftype]["instructions"]["assessments"]
        return {a["field"]: a["verdict"] for a in items}

    # По одной оценке на поле входа: 7 факторов с промерзанием
    assert len(verdicts("pile")) == 7
    assert verdicts("column")["building.storeys"] == "excluded"
    assert verdicts("pile")["site.soil_freezing_depth"] == "favourable"
    assert verdicts("strip")["site.groundwater_level"] == "unfavourable"
    influences = [a["influence"] for a in sent["body"]["questions"]["column"]["instructions"]["assessments"]]
    assert influences == sorted(influences, key=["very strong", "strong", "moderate"].index)


def test_jev_without_frost_depth_omits_it(monkeypatch):
    sent = {}

    def handler(request: httpx.Request) -> httpx.Response:
        sent["body"] = json.loads(request.content)
        return httpx.Response(200, json=jev_answers({"strip": 0.3, "slab": 0.6, "pile": 0.8, "column": 0.1}))

    use_jev(monkeypatch, handler)
    assert recommend().status_code == 200
    assert "soil_freezing_depth" not in sent["body"]["state"]["site"]
    fields = {a["field"] for a in sent["body"]["questions"]["slab"]["instructions"]["assessments"]}
    assert "site.soil_freezing_depth" not in fields and len(fields) == 6


def test_jev_rules_cover_every_input_value():
    from app.schemas.foundation import BearingCapacity, FrostDepth, GroundwaterLevel, SoilType, WallMaterial
    from app.services.reference import load_jev_rules

    expected = {
        "soil_type": {v.value for v in SoilType},
        "bearing_capacity": {v.value for v in BearingCapacity},
        "groundwater_level": {v.value for v in GroundwaterLevel},
        "frost_depth": {v.value for v in FrostDepth},
        "storeys": {"1-2", "3-5", "6-10", "11-25", "26+"},
        "wall_material": {v.value for v in WallMaterial},
        "seismicity": {"0-6", "7", "8+"},
    }
    verdicts = {"favourable", "acceptable", "neutral", "unfavourable", "excluded"}
    rules = load_jev_rules()
    for ftype in ("strip", "slab", "pile", "column"):
        assert set(rules[ftype]) == set(expected)
        for factor, values in expected.items():
            assert rules[ftype][factor]["influence"] in {"very strong", "strong", "moderate"}
            assert set(rules[ftype][factor]["values"]) == values, (ftype, factor)
            for verdict, reason in rules[ftype][factor]["values"].values():
                assert verdict in verdicts and reason


def test_jev_error_is_502_not_rules(monkeypatch):
    error = {"error": {"code": 402, "message": "Insufficient credits"}}
    use_jev(monkeypatch, lambda request: httpx.Response(402, json=error))
    res = recommend()
    assert res.status_code == 502
    assert "Insufficient credits" in res.json()["detail"]


def test_jev_retries_overload_once(monkeypatch):
    statuses = iter([529, 200])

    def handler(request):
        status = next(statuses)
        if status != 200:
            return httpx.Response(status, json={"error": {"message": "Provider returned error"}})
        return httpx.Response(200, json=jev_answers({"strip": 0.4, "slab": 0.5, "pile": 0.7, "column": 0.4}))

    use_jev(monkeypatch, handler)
    monkeypatch.setattr(jev_client.time, "sleep", lambda s: None)
    assert recommend().status_code == 200


def test_jev_without_key_is_502(monkeypatch):
    monkeypatch.setenv("SCORE_SOURCE", "jev")
    get_settings.cache_clear()
    assert recommend().status_code == 502


def test_jev_malformed_answer_is_502(monkeypatch):
    use_jev(monkeypatch, lambda request: httpx.Response(200, json=jev_answers({"strip": 0.4})))
    assert recommend().status_code == 502


# --- /explain и /analyze --------------------------------------------------------

TOP3 = [{"type": "pile", "score": 73}, {"type": "slab", "score": 50}, {"type": "strip", "score": 41}]

TEXTS = {
    "pile": {
        "pros": ["Проходит к несущему слою при высоком УГВ", "Высокая стоимость устройства ростверка"],
        "cons": ["Нужна спецтехника"],
        "vs_others": "Надёжнее плитного и ленточного при высоком УГВ.",
    },
    "slab": {"pros": ["Равномерно распределяет нагрузку"], "cons": ["Сложная гидроизоляция"]},
    "strip": {"pros": ["Жёсткая опора под кирпичные стены"], "cons": ["Риск подтопления"]},
    "column": {"pros": ["Мало земляных работ"], "cons": ["Не для тяжёлых стен"], "vs_others": "..."},
}


def fake_llm(monkeypatch, *answers):
    """Подменяет вызов LLM; ответы выдаются по очереди, последний повторяется."""
    calls = []

    def chat(system, user):
        calls.append(user)
        return answers[min(len(calls), len(answers)) - 1]

    monkeypatch.setattr(comparison, "chat_completion_json", chat)
    return calls


def test_explain_contract(monkeypatch):
    calls = fake_llm(monkeypatch, {"explanations": TEXTS})
    res = client.post("/api/foundation/explain", json={"input": SPEC_INPUT, "top3": TOP3})
    assert res.status_code == 200, res.text
    ex = res.json()["explanations"]

    assert list(ex) == ["pile", "slab", "strip"]
    assert ex["pile"]["vs_others"] == TEXTS["pile"]["vs_others"]
    assert "vs_others" not in ex["slab"] and "vs_others" not in ex["strip"]
    # Пункт про стоимость отброшен (ТЗ §9)
    assert ex["pile"]["pros"] == ["Проходит к несущему слою при высоком УГВ"]

    # Промпт: только топ-3, без стоимости и трудозатрат, с климатом региона
    prompt = calls[0]
    assert '"column"' not in prompt
    assert "cost_rub" not in prompt and "labor" not in prompt
    assert "глубокое сезонное промерзание" in prompt


def test_explain_retries_incomplete_answer(monkeypatch):
    calls = fake_llm(monkeypatch, {"explanations": {"pile": TEXTS["pile"]}}, {"explanations": TEXTS})
    res = client.post("/api/foundation/explain", json={"input": SPEC_INPUT, "top3": TOP3})
    assert res.status_code == 200, res.text
    assert len(calls) == 2


def test_explain_incomplete_twice_is_502(monkeypatch):
    fake_llm(monkeypatch, {"explanations": {"pile": TEXTS["pile"]}})
    res = client.post("/api/foundation/explain", json={"input": SPEC_INPUT, "top3": TOP3})
    assert res.status_code == 502


def test_explain_without_llm_key_is_502():
    # Вместо шаблонного текста ошибка (ТЗ §7)
    res = client.post("/api/foundation/explain", json={"input": SPEC_INPUT, "top3": TOP3})
    assert res.status_code == 502


def test_explain_rejects_duplicate_types():
    top = [{"type": "pile", "score": 73}, {"type": "pile", "score": 50}]
    assert client.post("/api/foundation/explain", json={"input": SPEC_INPUT, "top3": top}).status_code == 422


def test_analyze_compat_returns_top3(monkeypatch):
    fake_llm(monkeypatch, {"explanations": TEXTS})
    result = recommend().json()
    order = [o["type"] for o in _all(result)]

    res = client.post("/api/foundation/analyze", json={"input": SPEC_INPUT, "result": result})
    assert res.status_code == 200, res.text
    body = res.json()
    assert [t["type"] for t in body["types"]] == order[:3]
    assert body["why_recommended"] == TEXTS[order[0]]["vs_others"]
    assert body["provider"] == "deepseek"


def test_analyze_without_llm_key_is_502():
    result = recommend().json()
    res = client.post("/api/foundation/analyze", json={"input": SPEC_INPUT, "result": result})
    assert res.status_code == 502


def _all(body):
    return [body["recommended"], *body["alternatives"]]
