# -*- coding: utf-8 -*-

from backend.app.i18n.ru import TEXTS_RU

DEFAULT_LANG = "ru"
_TEXTS = {
    "ru": TEXTS_RU,
}


def t(key: str, lang: str = DEFAULT_LANG) -> str:
    """
    Простая функция перевода:
    - возвращает строку по ключу
    - если ключа нет — возвращает сам ключ (чтобы сразу было видно, что забыли добавить)
    """
    return _TEXTS.get(lang, {}).get(key, key)
