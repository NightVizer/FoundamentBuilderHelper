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

Тело запроса — JSON полей формы (`FoundationInput`). Ответ:

```json
{
  "suitability": {
    "strip": 72,
    "slab": 68,
    "pile": 81,
    "column": 55
  },
  "notes": { "pile": ["краткий комментарий модели"] }
}
```

## API

| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/api/foundation/recommend` | Шаг 1: JEV + смета |
| POST | `/api/foundation/analyze` | Шаг 2: DeepSeek (плюсы/минусы) |
| POST | `/api/foundation/report` | ТЭО (числа + текст DeepSeek) |
| GET | `/health` | Проверка сервиса |
