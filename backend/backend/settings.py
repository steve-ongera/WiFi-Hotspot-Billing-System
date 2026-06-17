import os
from datetime import timedelta
from pathlib import Path
 

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-&@c25om(k4#_s8*d&$v98e+h)-luy&8ti_^#_c7#yl@jc_q*++'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['*']


# Application definition

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]
 
THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_ratelimit",
]
 
LOCAL_APPS = [
    "core",
]
 
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS
 

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    "corsheaders.middleware.CorsMiddleware",   
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ---------------------------------------------------------------------------
# Custom user model
# ---------------------------------------------------------------------------
 
AUTH_USER_MODEL = "core.User"


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
 
LANGUAGE_CODE = "en-us"
TIME_ZONE     = "Africa/Nairobi"
USE_I18N      = True
USE_TZ        = True


# ---------------------------------------------------------------------------
# Static & media files
# ---------------------------------------------------------------------------
 
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
 
MEDIA_URL  = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
 
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
 
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/minute",
        "user": "300/minute",
    },
    "EXCEPTION_HANDLER": "rest_framework.views.exception_handler",
}
 
# ---------------------------------------------------------------------------
# Simple JWT
# ---------------------------------------------------------------------------
 
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(minutes=int(os.environ.get("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", 60))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("JWT_REFRESH_TOKEN_LIFETIME_DAYS", 7))),
    "ROTATE_REFRESH_TOKENS":  True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN":       True,
    "ALGORITHM":               "HS256",
    "AUTH_HEADER_TYPES":       ("Bearer",),
    "AUTH_HEADER_NAME":        "HTTP_AUTHORIZATION",
    "USER_ID_FIELD":           "id",
    "USER_ID_CLAIM":           "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "rest_framework_simplejwt.serializers.TokenObtainPairSerializer",
    "TOKEN_REFRESH_SERIALIZER": "rest_framework_simplejwt.serializers.TokenRefreshSerializer",
}
 
# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
 
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
]
CORS_ALLOW_HEADERS = [
    "accept", "accept-encoding", "authorization", "content-type",
    "dnt", "origin", "user-agent", "x-csrftoken", "x-requested-with",
]
 


# ---------------------------------------------------------------------------
# M-Pesa Daraja API
# ---------------------------------------------------------------------------
 
MPESA_ENVIRONMENT    = os.environ.get("MPESA_ENVIRONMENT",    "sandbox")
MPESA_CONSUMER_KEY   = os.environ.get("MPESA_CONSUMER_KEY",   "")
MPESA_CONSUMER_SECRET = os.environ.get("MPESA_CONSUMER_SECRET","")
MPESA_SHORTCODE      = os.environ.get("MPESA_SHORTCODE",      "174379")
MPESA_PASSKEY        = os.environ.get("MPESA_PASSKEY",        "")
MPESA_CALLBACK_URL   = os.environ.get("MPESA_CALLBACK_URL",   "https://yourdomain.com/api/payments/mpesa/callback/")
MPESA_TRANSACTION_TYPE = os.environ.get("MPESA_TRANSACTION_TYPE", "CustomerPayBillOnline")
 
# Safaricom's production IP whitelist for callback validation
MPESA_ALLOWED_IPS = [
    "196.201.214.200", "196.201.214.206", "196.201.213.114",
    "196.201.214.207", "196.201.214.208", "196.201.213.44",
    "196.201.212.127", "196.201.212.138", "196.201.212.129",
    "196.201.212.136", "196.201.212.74",  "196.201.212.69",
]
 
# ---------------------------------------------------------------------------
# MikroTik RouterOS API
# ---------------------------------------------------------------------------
 
MIKROTIK_HOST     = os.environ.get("MIKROTIK_HOST",     "192.168.88.1")
MIKROTIK_PORT     = int(os.environ.get("MIKROTIK_PORT", "8728"))
MIKROTIK_USERNAME = os.environ.get("MIKROTIK_USERNAME", "admin")
MIKROTIK_PASSWORD = os.environ.get("MIKROTIK_PASSWORD", "")
 
HOTSPOT_DEFAULT_PROFILE = os.environ.get("HOTSPOT_DEFAULT_PROFILE", "default")
HOTSPOT_SERVER_NAME     = os.environ.get("HOTSPOT_SERVER_NAME",     "hotspot1")
 
# ---------------------------------------------------------------------------
# Africa's Talking SMS (optional)
# ---------------------------------------------------------------------------
 
AT_USERNAME = os.environ.get("AT_USERNAME", "sandbox")
AT_API_KEY  = os.environ.get("AT_API_KEY",  "")
 
# ---------------------------------------------------------------------------
# Email (optional)
# ---------------------------------------------------------------------------
 
EMAIL_BACKEND       = "django.core.mail.backends.console.EmailBackend"
EMAIL_HOST          = os.environ.get("EMAIL_HOST",          "smtp.gmail.com")
EMAIL_PORT          = int(os.environ.get("EMAIL_PORT",      "587"))
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = os.environ.get("EMAIL_HOST_USER",     "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL  = os.environ.get("DEFAULT_FROM_EMAIL",  "WifiBill <noreply@wifibill.co.ke>")
 
# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
 
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style":  "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style":  "{",
        },
    },
    "handlers": {
        "console": {
            "class":     "logging.StreamHandler",
            "formatter": "verbose",
        },
        "file": {
            "class":     "logging.handlers.RotatingFileHandler",
            "filename":  BASE_DIR / "logs" / "wifibill.log",
            "maxBytes":  5 * 1024 * 1024,   # 5 MB
            "backupCount": 5,
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {
            "handlers":  ["console"],
            "level":     "WARNING",
            "propagate": False,
        },
        "core": {
            "handlers":  ["console", "file"],
            "level":     "DEBUG",
            "propagate": False,
        },
        "services": {
            "handlers":  ["console", "file"],
            "level":     "DEBUG",
            "propagate": False,
        },
        "tasks": {
            "handlers":  ["console", "file"],
            "level":     "DEBUG",
            "propagate": False,
        },
    },
    "root": {
        "handlers": ["console"],
        "level":    "WARNING",
    },
}
