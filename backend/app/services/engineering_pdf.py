"""PDF инженерного отчёта: Jinja2-шаблон → headless Chromium (Playwright).

Установка браузера: python -m playwright install chromium
"""

import asyncio
import logging
import sys
import time
from datetime import date
from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from playwright.async_api import Error as PlaywrightError
from playwright.async_api import async_playwright

from app.schemas.foundation import EngineeringReportResponse

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
RENDER_TIMEOUT_MS = 30_000

MONTHS = (
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
)  # fmt: skip


class PdfRenderError(Exception):
    pass


def _long_date(iso: str) -> str:
    """'2026-09-26' → '26 сентября 2026'."""
    try:
        d = date.fromisoformat(iso)
    except ValueError:
        return iso
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


@lru_cache
def _env() -> Environment:
    env = Environment(loader=FileSystemLoader(_TEMPLATES_DIR), autoescape=select_autoescape(["html"]))
    env.filters["long_date"] = _long_date
    return env


def render_html(report: EngineeringReportResponse) -> str:
    names = {item.type: item.name for item in report.top3}
    short = {t: name.split()[0] for t, name in names.items()}  # «Свайный» для шапки матрицы
    return _env().get_template("engineering_report.html").render(report=report, names=names, short=short)


async def _print(html: str) -> bytes:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        try:
            page = await browser.new_page()
            # networkidle: шрифты Google Fonts; без сети остаются системные из font-family
            await page.set_content(html, wait_until="networkidle", timeout=RENDER_TIMEOUT_MS)
            await page.evaluate("() => document.fonts.ready.then(() => true)")
            return await page.pdf(prefer_css_page_size=True, print_background=True)
        finally:
            await browser.close()


def html_to_pdf(html: str) -> bytes:
    """Синхронная обёртка для потока запроса FastAPI.

    Отдельный цикл событий: uvicorn --reload на Windows работает на SelectorEventLoop,
    а запуск браузера требует подпроцессов (ProactorEventLoop).
    """
    loop = asyncio.ProactorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()
    started = time.perf_counter()
    try:
        pdf = loop.run_until_complete(_print(html))
    except PlaywrightError as exc:
        raise PdfRenderError(f"Не удалось сформировать PDF: {exc.message}") from exc
    finally:
        loop.close()
    logger.info("PDF отчёта: %d КБ за %d мс", len(pdf) // 1024, round((time.perf_counter() - started) * 1000))
    return pdf


def render_pdf(report: EngineeringReportResponse) -> bytes:
    return html_to_pdf(render_html(report))
