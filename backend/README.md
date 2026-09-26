# Backend — Помощник проектировщика фундамента

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Swagger: http://127.0.0.1:8000/docs
- `POST /api/foundation/recommend`
- `POST /api/foundation/report`
