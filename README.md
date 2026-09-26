# Помощник проектировщика фундамента (MVP)

Предварительный подбор типа фундамента по упрощённым правилам: оценка 0–100, ориентировочная стоимость и трудозатраты, ТЭО.

Спецификация: `Описание.docx`.

## Структура

```
backend/          FastAPI, rule engine, JSON rules/prices
frontend/         React + TypeScript + Vite + Tailwind
```

## Запуск

**Backend** (порт 8000):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium
uvicorn app.main:app --reload
```

**Frontend** (порт 5173, прокси `/api` → backend):

```bash
cd frontend
npm install
npm run dev
```

## Двухэтапный анализ

1. **JEV** — по входным данным возвращает **процент пригодности** (0–100) для `strip`, `slab`, `pile`, `column`. Стоимость и трудозатраты считаются локально по `prices.json`.
2. **DeepSeek** — получает те же входы и **готовые проценты JEV**, пишет плюсы/минусы и сравнение (числа не пересчитывает).

Переменные окружения: `backend/.env.example`. Без `JEV_API_URL` работает fallback на rule-engine; без `DEEPSEEK_API_KEY` — текстовый шаблон.

### Контракт JEV (POST `JEV_API_URL`)

Один вызов OpenRouter Decisions API (`typesafe/jev-1.13`), 4 вопроса Noul, по одному на тип
(`backend/app/services/jev_client.py`):

- `state` — входы формы на английском, числа переведены в категории (этажность — диапазоном, промерзание —
  диапазоном формы). Площадь в `state` не идёт: на выбор типа она не влияет, только на смету.
- `questions.<type>.instructions.assessments` — оценки из `backend/app/data/jev_rules.json` (выжимка справочника
  по типам фундаментов) только для фактических значений входа: поле, сила влияния, вердикт
  (`favourable` … `excluded`), причина.
- Ответ: `{"answers": {"pile": {"type": "noul", "noul": 0.91}, ...}}`, noul × 100 = процент.

Без `frost_depth` во входе оценка по промерзанию не передаётся.

## API

| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/api/foundation/recommend` | Шаг 1: JEV + смета |
| POST | `/api/foundation/analyze` | Шаг 2: DeepSeek (плюсы/минусы) |
| POST | `/api/foundation/report` | ТЭО (числа + текст DeepSeek) |
| POST | `/api/foundation/report/engineering` | Инженерный отчёт (DeepSeek, запрос B) |
| POST | `/api/foundation/report/engineering/pdf` | PDF инженерного отчёта (Playwright) |
| GET | `/health` | Проверка сервиса |
