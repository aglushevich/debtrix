from __future__ import annotations

import json
import urllib.error
import urllib.request


BASE = "http://127.0.0.1:8000"


def fetch(path: str, method: str = "GET", payload: dict | None = None):
    data = None
    headers = {}

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        url=f"{BASE}{path}",
        method=method,
        data=data,
        headers=headers,
    )

    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return response.status, body
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


def print_step(title: str, status: int, body: str) -> None:
    print(f"\n=== {title} ===")
    print(f"HTTP {status}")
    print(body)


def main() -> None:
    steps = [
        ("root", "/", "GET", None),
        ("cases", "/cases", "GET", None),
        ("dashboard", "/cases/1/dashboard", "GET", None),
        ("timeline", "/cases/1/timeline", "GET", None),
        ("integrations", "/cases/1/integrations", "GET", None),
        ("fns sync", "/cases/1/integrations/fns/sync", "POST", None),
        ("fssp check", "/cases/1/integrations/fssp/check", "POST", None),
        ("external actions list", "/cases/1/external-actions", "GET", None),
        (
            "prepare external action",
            "/cases/1/external-actions/send_to_fssp/prepare",
            "POST",
            None,
        ),
        ("start esia", "/external-actions/1/esia-session/start", "POST", None),
        ("authorize esia", "/esia-sessions/1/authorize", "POST", None),
        ("dispatch", "/external-actions/1/dispatch", "POST", None),
        ("saved views", "/portfolio/views", "GET", None),
        (
            "create saved view",
            "/portfolio/views",
            "POST",
            {
                "title": "Просрочка",
                "description": "Системный smoke-check вид",
                "entity_type": "case",
                "filters": {"status": "overdue"},
                "sorting": None,
                "columns": ["id", "debtor_name", "status"],
                "is_default": False,
                "is_shared": False,
            },
        ),
        (
            "batch preview",
            "/portfolio/batches/preview",
            "POST",
            {
                "action_code": "send_to_fssp",
                "case_ids": [1],
            },
        ),
        (
            "batch run",
            "/portfolio/batches/run",
            "POST",
            {
                "action_code": "send_to_fssp",
                "case_ids": [1],
            },
        ),
    ]

    for title, path, method, payload in steps:
        status, body = fetch(path, method=method, payload=payload)
        print_step(title, status, body)


if __name__ == "__main__":
    main()