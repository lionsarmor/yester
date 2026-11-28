import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
STATE = Path(os.environ.get("RODDY_ID_STATE", "/var/lib/roddy-id"))
SECRET_KEY = (STATE / "django.key").read_text().strip()
IDP_OIDC_PRIVATE_KEY = (STATE / "signing.pem").read_text()
ALLOWED_HOSTS = ["accounts.roddy.world"]
ROOT_URLCONF = "urls"
INSTALLED_APPS = ["django.contrib.auth", "django.contrib.contenttypes",
                  "django.contrib.sessions", "django.contrib.messages", "people",
                  "allauth", "allauth.account", "allauth.idp", "allauth.idp.oidc"]
MIDDLEWARE = ["django.middleware.security.SecurityMiddleware", "people.cors.BrowserClientCors",
              "django.contrib.sessions.middleware.SessionMiddleware",
              "django.middleware.common.CommonMiddleware", "django.middleware.csrf.CsrfViewMiddleware",
              "django.contrib.auth.middleware.AuthenticationMiddleware",
              "django.contrib.messages.middleware.MessageMiddleware",
              "allauth.account.middleware.AccountMiddleware", "django.middleware.clickjacking.XFrameOptionsMiddleware"]
TEMPLATES = [{"BACKEND":"django.template.backends.django.DjangoTemplates", "DIRS":[BASE_DIR / "templates"],
              "APP_DIRS":True, "OPTIONS":{"context_processors":["django.template.context_processors.request",
              "django.contrib.auth.context_processors.auth","django.contrib.messages.context_processors.messages"]}}]
DATABASES = {"default":{"ENGINE":"django.db.backends.sqlite3","NAME":STATE / "accounts.sqlite3",
                        "OPTIONS":{"timeout":10, "transaction_mode":"IMMEDIATE"}}}
AUTH_USER_MODEL = "people.Person"
AUTHENTICATION_BACKENDS = ["allauth.account.auth_backends.AuthenticationBackend"]
AUTH_PASSWORD_VALIDATORS = [{"NAME":"django.contrib.auth.password_validation.MinimumLengthValidator",
                             "OPTIONS":{"min_length":15}},
                            {"NAME":"django.contrib.auth.password_validation.CommonPasswordValidator"}]
ACCOUNT_ADAPTER = "people.adapter.HandleAdapter"
ACCOUNT_SIGNUP_FIELDS = ["email*", "username*", "password1*", "password2*"]
ACCOUNT_LOGIN_METHODS = {"username", "email"}
ACCOUNT_USERNAME_MIN_LENGTH = 2
ACCOUNT_EMAIL_VERIFICATION = "mandatory" if os.getenv("RODDY_SMTP_HOST") else "none"
ACCOUNT_DEFAULT_HTTP_PROTOCOL = "https"
ACCOUNT_EMAIL_NOTIFICATIONS = False
ACCOUNT_EMAIL_SUBJECT_PREFIX = "[RODDY ID] "
ACCOUNT_UNIQUE_EMAIL = True
EMAIL_HOST = os.getenv("RODDY_SMTP_HOST", "")
EMAIL_HOST_USER = os.getenv("RODDY_SMTP_USER","")
EMAIL_HOST_PASSWORD = os.getenv("RODDY_SMTP_PASSWORD","")
EMAIL_USE_TLS = True
EMAIL_PORT = 587
DEFAULT_FROM_EMAIL = os.getenv("RODDY_SMTP_FROM","support@roddy.world")
CACHES = {"default":{"BACKEND":"django.core.cache.backends.filebased.FileBasedCache","LOCATION":STATE / "cache"}}
# Caddy is the only upstream and replaces incoming forwarding headers.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_NAME = "__Host-roddyid"
CSRF_COOKIE_NAME = "__Host-roddycsrf"
SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
LOGIN_URL = "/login/"
LOGIN_REDIRECT_URL = ACCOUNT_LOGOUT_REDIRECT_URL = "/"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
ALLAUTH_TRUSTED_PROXY_COUNT = 1
IDP_OIDC_ADAPTER = "people.adapter.BuddyClaims"
IDP_OIDC_SCOPE_CHOICES = ["openid", "profile", "email", ("buddies", "Read your confirmed buddy list")]
ALLOWED_HOSTS.append("index.roddy.world")
MIDDLEWARE.insert(1,"people.project_index.IndexHost")
