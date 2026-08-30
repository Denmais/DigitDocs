import os
from typing import Any

from pymongo import MongoClient
from pymongo.collection import Collection
from sqlalchemy.orm import Session

from models import DocumentField, DocumentType


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

def sync_forms_to_sqlite(db: Session) -> None:
    """Создаёт в SQLite типы документов и поля из MongoDB."""
    form_ids = list_form_ids()

    for form_id in form_ids:
        form = get_form(form_id)

        document_type = (
            db.query(DocumentType)
            .filter(
                DocumentType.title == form_id
            )
            .first()
        )

        if document_type is None:
            document_type = DocumentType(
                title=form_id,
            )

            db.add(document_type)
            db.flush()

        for field in form.get("fields", []):
            field_id = field.get("id")

            if not field_id:
                continue

            document_field = (
                db.query(DocumentField)
                .filter(
                    DocumentField.document_type_id
                    == document_type.id,
                    DocumentField.title
                    == field_id,
                )
                .first()
            )

            if document_field is None:
                document_field = DocumentField(
                    document_type_id=document_type.id,
                    title=field_id,
                    ru_title=field.get("label"),
                    value_type=field.get(
                        "type",
                        "text",
                    ),
                    unit=field.get("unit") or "",
                )

                db.add(document_field)

            else:
                # Заодно обновляем описание,
                # если оно изменилось в Mongo.
                document_field.ru_title = (
                    field.get("label")
                )

                document_field.value_type = (
                    field.get("type", "text")
                )

                document_field.unit = (
                    field.get("unit") or ""
                )

    db.commit()