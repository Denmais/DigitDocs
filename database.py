import os
from functools import lru_cache

import clickhouse_connect
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


SQLALCHEMY_DATABASE_URL = os.getenv(
    "SQLALCHEMY_DATABASE_URL",
    "sqlite:///./data/sql_app.db",
)

_engine_kwargs: dict = {"pool_pre_ping": True}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    bind=engine,
)


class Base(DeclarativeBase):
    pass


CLICKHOUSE_DATABASE = os.getenv("CLICKHOUSE_DATABASE", "analytics")
CLICKHOUSE_TABLE = f"{CLICKHOUSE_DATABASE}.extract_data"


def _as_bool(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


@lru_cache(maxsize=1)
def get_clickhouse_client():
    """Один потокобезопасный HTTP-клиент ClickHouse на процесс приложения."""
    return clickhouse_connect.get_client(
        host=os.getenv("CLICKHOUSE_HOST", "clickhouse"),
        port=int(os.getenv("CLICKHOUSE_PORT", "8123")),
        username=os.getenv("CLICKHOUSE_USER", "default"),
        password=os.getenv("CLICKHOUSE_PASSWORD", ""),
        database=CLICKHOUSE_DATABASE,
        secure=_as_bool(os.getenv("CLICKHOUSE_SECURE")),
    )


def close_clickhouse_client() -> None:
    if get_clickhouse_client.cache_info().currsize:
        get_clickhouse_client().close()
        get_clickhouse_client.cache_clear()