# Backend — Помощник проектировщика фундамента

Предварительный выбор типа фундамента (ленточный, плитный, свайный, столбчатый):
rule engine → score → стоимость → трудозатраты → сортировка → причины → (LLM) ТЭО.
Это не нормативный расчёт, а поддержка решения проектировщика.

## Запуск

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # необязательно: ключ LLM
uvicorn app.main:app --reload --port 8000
```

Swagger: http://127.0.0.1:8000/docs · Тесты: `python -m pytest`

## API

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/foundation/options` | допустимые значения полей формы и регионы с русскими названиями |
| POST | `/api/foundation/recommend` | расчёт 4 вариантов: score, стоимость, трудозатраты, причины |
| POST | `/api/foundation/report` | ТЭО: `{input, result}` → параметры, обоснование (LLM или шаблон), сравнение, `report_text` |
| POST | `/api/foundation/analyze` | плюсы/минусы по каждому типу |

Пример запроса `/recommend`:

```json
{
  "soil_type": "loam",
  "bearing_capacity": "medium",
  "groundwater_level": "high",
  "floors": 3,
  "building_area_m2": 450,
  "wall_material": "brick",
  "region": "krasnoyarsk",
  "seismicity": 7
}
```

`seismicity` принимает число баллов (0–12) или категорию `"0-6"`, `"7"`, `"8+"`.
Регионы: `krasnoyarsk`, `moscow`, `spb`, `ekb`, `novosibirsk`, `krasnodar`.

## Где что настраивается

- `app/data/rules.json` — базовые оценки и баллы по факторам (грунт, несущая способность, УГВ,
  этажность, материал стен, сейсмичность) с текстами причин.
- `app/data/prices.json` — региональные цены (`concrete_m3`, `rebar_ton`, `excavation_m3`,
  `installation_m3`) и коэффициенты, удельные объёмы работ по типам, нормы трудозатрат.
- `app/services/scoring.py` — rule engine; `pricing.py` — стоимость и трудозатраты;
  `recommendation.py` — конвейер; `report.py` — ТЭО и промпт LLM.
