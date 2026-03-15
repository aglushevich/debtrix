from __future__ import annotations

import os


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./backend/debtrix.db")

APP_ENV = os.getenv("APP_ENV", "local")
APP_DEBUG = os.getenv("APP_DEBUG", "true").lower() in {"1", "true", "yes", "on"}

DEFAULT_TENANT_NAME = os.getenv("DEFAULT_TENANT_NAME", "Default Tenant")
DEFAULT_TENANT_SLUG = os.getenv("DEFAULT_TENANT_SLUG", "default")