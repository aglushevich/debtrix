from i18n.ru import TEXTS_RU

def t(key: str) -> str:
    return TEXTS_RU.get(key, key)