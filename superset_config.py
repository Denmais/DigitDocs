import os
from urllib.parse import quote_plus


SECRET_KEY = os.environ["SUPERSET_SECRET_KEY"]

db_host = os.getenv("SUPERSET_DB_HOST", "superset-db")
db_port = os.getenv("SUPERSET_DB_PORT", "5432")
db_name = os.getenv("SUPERSET_DB_NAME", "superset")
db_user = quote_plus(os.getenv("SUPERSET_DB_USER", "superset"))
db_password = quote_plus(os.environ["SUPERSET_DB_PASSWORD"])

SQLALCHEMY_DATABASE_URI = (
    f"postgresql+psycopg2://{db_user}:{db_password}"
    f"@{db_host}:{db_port}/{db_name}"
)

PREVENT_UNSAFE_DB_CONNECTIONS = False

REDIS_HOST = os.getenv("SUPERSET_REDIS_HOST", "superset-redis")
REDIS_PORT = int(os.getenv("SUPERSET_REDIS_PORT", "6379"))

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": 1,
}

DATA_CACHE_CONFIG = CACHE_CONFIG