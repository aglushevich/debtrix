from __future__ import annotations

from typing import Any


def get_document_readiness(
    documents: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for item in documents:
        result.append(
            {
                "code": item.get("code"),
                "title": item.get("title"),
                "ready": bool(item.get("ready")),
                "missing_fields": item.get("missing_fields") or [],
            }
        )
    return result