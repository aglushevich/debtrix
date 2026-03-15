from __future__ import annotations

import re
from fastapi import HTTPException


_DIGITS_RE = re.compile(r"\D+")


def _digits_only(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = _DIGITS_RE.sub("", value)
    return cleaned or None


def normalize_and_validate_inn_ogrn(
    inn: str | None,
    ogrn: str | None,
) -> tuple[str | None, str | None]:
    inn_norm = _digits_only(inn)
    ogrn_norm = _digits_only(ogrn)

    if inn_norm and len(inn_norm) not in {10, 12}:
        raise HTTPException(status_code=422, detail="ИНН должен содержать 10 или 12 цифр")

    if ogrn_norm and len(ogrn_norm) not in {13, 15}:
        raise HTTPException(status_code=422, detail="ОГРН должен содержать 13 или 15 цифр")

    if not inn_norm and not ogrn_norm:
        raise HTTPException(status_code=422, detail="Нужно передать inn или ogrn")

    return inn_norm, ogrn_norm


def resolve_inn_ogrn_with_fallback(
    inn_in: str | None,
    ogrn_in: str | None,
    inn_fallback: str | None,
    ogrn_fallback: str | None,
) -> tuple[str | None, str | None]:
    inn_candidate = inn_in or inn_fallback
    ogrn_candidate = ogrn_in or ogrn_fallback
    return normalize_and_validate_inn_ogrn(inn_candidate, ogrn_candidate)