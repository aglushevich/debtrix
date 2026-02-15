from backend.app.i18n.ru import RU

def t(key: str) -> str:
    return RU.get(key, key)