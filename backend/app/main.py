import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.foundation import router as foundation_router

# Логи сервисов (app.*): ошибки Jev/LLM, латентность, стоимость вызова
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(
    title="Помощник проектировщика фундамента",
    description="MVP: предварительный подбор типа фундамента",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(foundation_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
