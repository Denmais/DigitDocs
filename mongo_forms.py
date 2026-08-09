import os
from typing import Any

from pymongo import MongoClient
from pymongo.collection import Collection


MONGODB_HOST = os.getenv(
    "MONGODB_HOST",
    "mongodb",
)

MONGODB_PORT = int(
    os.getenv(
        "MONGODB_PORT",
        "27017",
    )
)

MONGODB_DATABASE = os.getenv(
    "MONGODB_DATABASE",
    "invoice",
)

MONGODB_USER = os.getenv(
    "MONGODB_USER",
    "invoice_app",
)

MONGODB_PASSWORD = os.environ[
    "MONGODB_PASSWORD"
]

MONGODB_AUTH_SOURCE = os.getenv(
    "MONGODB_AUTH_SOURCE",
    MONGODB_DATABASE,
)

MONGODB_FORMS_COLLECTION = os.getenv(
    "MONGODB_FORMS_COLLECTION",
    "document_forms",
)


mongo_client: MongoClient[
    dict[str, Any]
] = MongoClient(
    host=MONGODB_HOST,
    port=MONGODB_PORT,
    username=MONGODB_USER,
    password=MONGODB_PASSWORD,
    authSource=MONGODB_AUTH_SOURCE,
    serverSelectionTimeoutMS=5000,
)


mongo_db = mongo_client[
    MONGODB_DATABASE
]

forms_collection: Collection[
    dict[str, Any]
] = mongo_db[
    MONGODB_FORMS_COLLECTION
]


def ping_mongo() -> None:
    """Проверяет подключение к MongoDB."""
    mongo_client.admin.command(
        "ping"
    )


def get_form(
    document_type: str,
) -> dict[str, Any]:
    """Возвращает форму документа из MongoDB."""

    document = forms_collection.find_one(
        {
            "_id": document_type,
        },
        {
            "_id": 0,
        },
    )

    if document is None:
        raise ValueError(
            "No MongoDB form configured "
            f"for document type: {document_type}"
        )

    fields = document.get("fields")

    if not isinstance(fields, list):
        raise ValueError(
            "Invalid MongoDB form for "
            f"document type {document_type}: "
            "'fields' must be an array"
        )

    auto_crop = document.get(
        "auto_crop"
    )

    if (
        auto_crop is not None
        and not isinstance(
            auto_crop,
            dict,
        )
    ):
        raise ValueError(
            "Invalid MongoDB form for "
            f"document type {document_type}: "
            "'auto_crop' must be an object"
        )

    return document


def list_form_ids() -> list[str]:
    """Возвращает настроенные типы документов."""

    return [
        str(item["_id"])
        for item
        in forms_collection
        .find(
            {},
            {"_id": 1},
        )
        .sort("_id", 1)
    ]