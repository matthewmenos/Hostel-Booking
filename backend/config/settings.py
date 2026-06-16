"""
Django settings for the Ghana University Hostel Booking & Management Platform.

Architecture notes
-------------------
This project uses a DUAL-SQLite, multi-tenant data model:

  * ``default``  -> ``data/global_system.db``
        Shared/global resources: users, hostel (tenant) metadata, the
        consolidated booking ledger, and payments. This is the single
        authoritative store for high-concurrency data (bookings/payments),
        which keeps the hot path off the per-tenant files.

  * ``tenant_<slug>`` (registered at RUNTIME, not declared here)
        One private SQLite ``.db`` file per hostel/tenant holding localized
        operational data (rooms, bed spaces, announcements). These connections
        are injected dynamically by ``tenants.tenant_manager`` and routed by
        ``tenants.routers.TenantRouter``. See those modules for the mechanism.

Media files and the durable copies of the tenant ``.db`` files live in
Cloudflare R2 when ``R2_*`` env vars are present, otherwise on local disk
(see ``core/storage.py`` and ``core/r2_client.py``).
"""

from pathlib import Path
import os

from dotenv import load_dotenv

# backend/
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env if present.
load_dotenv(BASE_DIR / ".env")


# --- Helpers ----------------------------------------------------------------
def env_bool(key: str, default: bool = False) -> bool:
    return os.getenv(key, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(key: str, default: str = "") -> list[str]:
    raw = os.getenv(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# --- Core -------------------------------------------------------------------
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

# Local directory holding the runtime SQLite files and (in fallback mode) media.
DATA_DIR = BASE_DIR / "data"
DB_STORE_DIR = DATA_DIR / "db_store"
MEDIA_LOCAL_DIR = DATA_DIR / "media"
for _d in (DATA_DIR, DB_STORE_DIR, MEDIA_LOCAL_DIR):
    _d.mkdir(parents=True, exist_ok=True)


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    "django_filters",
    # Local apps
    "accounts",
    "global_app",
    "tenants",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Resolves the active tenant and syncs its .db back to R2 on response.
    # Placed last so it wraps the full request/response cycle.
    "tenants.middleware.TenantMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# --- Databases --------------------------------------------------------------
# Only ``default`` (the global DB) is declared statically. Per-tenant
# connections are added to ``connections.databases`` at runtime by
# ``tenants.tenant_manager.ensure_tenant_db``.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": str(DATA_DIR / "global_system.db"),
    }
}

DATABASE_ROUTERS = ["tenants.routers.TenantRouter"]


# --- Auth -------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# --- DRF + JWT --------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

from datetime import timedelta  # noqa: E402  (kept local to JWT config)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# --- CORS -------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
# Allow the custom tenant header from the browser.
CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-tenant-slug",
]


# --- Internationalization ---------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Accra"
USE_I18N = True
USE_TZ = True


# --- Static & Media ---------------------------------------------------------
STATIC_URL = "static/"

# R2 configuration (consumed by core/storage.py + core/r2_client.py).
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "")
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL", "")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")

# R2 is "enabled" only when the essential credentials are all present.
R2_ENABLED = all(
    [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT_URL]
)
# Key prefix under which tenant .db files are stored in the bucket.
R2_DB_PREFIX = "tenant-databases"

if R2_ENABLED:
    # Serve/store media via R2 (django-storages S3 backend pointed at R2).
    STORAGES = {
        "default": {"BACKEND": "core.storage.R2MediaStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
else:
    # Local-disk fallback so the project runs without Cloudflare credentials.
    MEDIA_URL = "media/"
    MEDIA_ROOT = str(MEDIA_LOCAL_DIR)


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --- Logging (surface R2 transfer issues clearly) ---------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "tenants": {"handlers": ["console"], "level": "INFO"},
        "core": {"handlers": ["console"], "level": "INFO"},
    },
}
