"""Общий HTTP-клиент для внешних моделей.

Сертификаты берутся из системного хранилища (truststore), а не только из certifi:
антивирусы с HTTPS-инспекцией (например, Kaspersky) подменяют сертификаты,
и certifi-only клиент падает с CERTIFICATE_VERIFY_FAILED.
"""

import ssl

import httpx

try:
    import truststore

    _VERIFY: ssl.SSLContext | bool = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
except ImportError:  # pragma: no cover - truststore указан в requirements.txt
    _VERIFY = True

# Статусы, при которых OpenRouter советует повторить запрос
RETRY_STATUSES = frozenset({429, 500, 502, 503, 524, 529})


def make_client(timeout: float) -> httpx.Client:
    return httpx.Client(timeout=timeout, verify=_VERIFY)


def error_detail(response: httpx.Response) -> str:
    """Текст ошибки из ответа OpenRouter ({"error": {"message": ...}}) или начало тела."""
    try:
        message = response.json().get("error", {}).get("message")
    except (ValueError, AttributeError):
        message = None
    return str(message or response.text[:300])
