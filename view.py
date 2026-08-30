import datetime
import os
import re
import uuid
import tempfile
from difflib import SequenceMatcher
from pathlib import Path
from io import BytesIO
from urllib.parse import quote

from openpyxl import Workbook
from pdf2image import convert_from_path
from PIL import Image
from sqlalchemy.orm import Session

from database import CLICKHOUSE_TABLE
from mongo_forms import get_form, list_form_ids
from models import Crop, DocumentField, DocumentType, UploadedFile
from ocr_engine import ocr_on_image_with_bbox01
from storage import (
    delete_object,
    download_to_file,
    read_bytes,
    upload_bytes,
    upload_fileobj,
)
from schemas import (
    CollectOutput,
    DocumentTypeSerializer,
    ExtractField,
    ExtractOutput,
    Rectangle,
    Source,
    StorageInfo,
    UploadResponse,
)


BASE_DIR = os.path.dirname(__file__)
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")


def request_url(request, route_name: str, **path_params) -> str:
    """Строит ссылку на файл или превью."""
    if request is not None:
        return str(request.url_for(route_name, **path_params))

    filename = quote(str(path_params.get("filename", "")))
    if route_name == "download_file":
        return f"/download/{filename}"
    if route_name == "uploads_file":
        return f"/uploads/{filename}"
    return filename


def find_upload(db: Session, task_id: str) -> UploadedFile | None:
    """Ищет загруженный файл по task_id."""
    return (
        db.query(UploadedFile)
        .filter(UploadedFile.upload_id == task_id)
        .first()
    )


def render_pages(uploaded: UploadedFile, request=None) -> list[dict]:
    """Конвертирует PDF и сохраняет PNG-превью в MinIO."""
    pages = []

    with tempfile.TemporaryDirectory() as temp_dir:
        pdf_path = os.path.join(temp_dir, "document.pdf")
        download_to_file(uploaded.filepath, pdf_path)
        converted_pages = convert_from_path(pdf_path, dpi=150)

        for page_number, image in enumerate(converted_pages):
            preview_key = (
                f"previews/{uploaded.upload_id}/{page_number}.png"
            )

            buffer = BytesIO()
            image.save(buffer, format="PNG")
            upload_bytes(
                buffer.getvalue(),
                preview_key,
                "image/png",
            )

            pages.append(
                {
                    "page": page_number,
                    "image_url": request_url(
                        request,
                        "uploads_file",
                        filename=preview_key,
                    ),
                    "storage_key": preview_key,
                }
            )

    return pages


def upload_file(
    db: Session,
    file_data: bytes,
    filename: str,
    content_type: str,
    form,
    request=None,
):
    """Сохраняет документ в MinIO и создаёт запись в SQLite."""

    document_type = (
        db.query(DocumentType)
        .filter(
            DocumentType.title
            == form.get("type_id")
        )
        .first()
    )

    if document_type is None:
        raise ValueError(
            f"Unknown document type: "
            f"{form.get('type_id')}"
        )

    get_form(document_type.title)

    upload_uuid = uuid.uuid4()
    uploaded_at = datetime.datetime.now()

    object_name = (
        f"documents/"
        f"{upload_uuid}/"
        f"{filename}"
    )

    upload_bytes(
        file_data,
        object_name,
        content_type,
    )

    new_file = UploadedFile(
        filename=filename,
        filepath=object_name,
        upload_id=str(upload_uuid),
        document_type=document_type,
        comment=form.get("comment"),
        uploaded_at=uploaded_at,
    )

    try:
        db.add(new_file)
        db.commit()
        db.refresh(new_file)

    except Exception:
        db.rollback()

        try:
            delete_object(object_name)

        except Exception as cleanup_error:
            print(
                f"[MINIO] cleanup failed for "
                f"{object_name}: "
                f"{cleanup_error}"
            )

        raise

    storage = StorageInfo(
        file_url=request_url(
            request,
            "download_file",
            filename=object_name,
        ),
        preview_available=False,
    )

    doc = DocumentTypeSerializer.model_validate(
        document_type
    )

    return UploadResponse(
        upload_id=upload_uuid,
        filename=filename,
        storage=storage,
        document_type=doc,
        uploaded_at=uploaded_at,
        status="upload",
    )


def types(db: Session):
    """Возвращает типы документов, которые настроены в MongoDB."""
    configured_type_ids = set(list_form_ids())
    document_types = db.query(DocumentType).all()

    return [
        DocumentTypeSerializer.model_validate(item).model_dump()
        for item in document_types
        if item.title in configured_type_ids
    ]


def process(db: Session, args, request=None):
    """Готовит страницы PDF для ручной обработки."""
    task_id = args.get("task_id")
    uploaded = find_upload(db, task_id)
    if uploaded is None:
        return None

    pages = render_pages(uploaded, request)
    form_json = get_form(uploaded.document_type.title)

    return {
        "task_id": task_id,
        "pages": [
            {
                "page": page["page"],
                "image_url": page["image_url"],
            }
            for page in pages
        ],
        **form_json,
    }


def validate_rectangle(rectangle: Rectangle) -> None:
    """Проверяет, что crop находится внутри страницы."""
    if rectangle.x < 0 or rectangle.y < 0:
        raise ValueError("crop coordinates must be non-negative")
    if rectangle.width <= 0 or rectangle.height <= 0:
        raise ValueError("crop width and height must be positive")
    if rectangle.x + rectangle.width > 1:
        raise ValueError("crop exceeds image width")
    if rectangle.y + rectangle.height > 1:
        raise ValueError("crop exceeds image height")


def parse_numeric_value(value: str) -> float | None:
    """Преобразует распознанное число в float."""
    normalized = value.strip().replace(" ", "").replace(",", ".")
    if not normalized:
        return None

    try:
        return float(normalized)
    except ValueError:
        return None


def clean_field_value(raw_text: str, value_type: str) -> str:
    """Очищает OCR-текст с учётом типа поля."""
    text = raw_text.strip()

    if value_type == "number":
        text = re.sub(r"[^0-9.,\-]", "", text)
        text = text.replace(",", ".")

        if text.count(".") > 1:
            first_dot = text.find(".")
            text = text[: first_dot + 1] + text[first_dot + 1 :].replace(".", "")

    return text


def normalize_text(value: str) -> str:
    """Нормализует текст перед проверкой шаблона."""
    value = value.lower().replace("ё", "е")
    value = re.sub(r"[‐‑–—−]", "-", value)
    value = re.sub(r"\s*[-]\s*", "-", value)
    value = re.sub(r"[^a-zа-я0-9\s-]", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def compare_text(recognized: str, expected: str) -> tuple[bool, float]:
    """Сравнивает OCR-текст с ожидаемой фразой."""
    recognized_text = normalize_text(recognized)
    expected_text = normalize_text(expected)

    if not recognized_text or not expected_text:
        return False, 0.0

    if expected_text in recognized_text:
        return True, 1.0

    score = SequenceMatcher(None, recognized_text, expected_text).ratio()
    return score >= 0.72, score


def read_crop(
    image: Image.Image,
    crop_data: dict,
    psm: int = 6,
    numeric: bool = False,
) -> tuple[Rectangle, str]:
    crop = Rectangle.model_validate(crop_data)
    validate_rectangle(crop)

    text = ocr_on_image_with_bbox01(
        image,
        crop,
        lang="rus+eng",
        psm=psm,
        oem=3,
        numeric=numeric,
    ).strip()

    return crop, text


def find_field(form_json: dict, field_id: str) -> dict:
    """Находит описание поля в форме MongoDB."""
    field = next(
        (
            item
            for item in form_json.get("fields", [])
            if item.get("id") == field_id
        ),
        None,
    )

    if field is None:
        known_ids = [item.get("id") for item in form_json.get("fields", [])]
        raise ValueError(
            f"Unknown field_id: {field_id}. "
            f"Known ids: {known_ids}"
        )

    return field


def get_document_field(db: Session, uploaded: UploadedFile, field: dict) -> DocumentField:
    """Возвращает или создаёт описание поля в SQLite."""
    document_field = (
        db.query(DocumentField)
        .filter(
            DocumentField.document_type_id == uploaded.document_type_id,
            DocumentField.title == str(field.get("id")),
        )
        .first()
    )

    if document_field is not None:
        return document_field

    document_field = DocumentField(
        document_type_id=uploaded.document_type_id,
        title=str(field.get("id")),
        ru_title=field.get("label"),
        value_type=field.get("type", "text"),
        unit=field.get("unit") or "",
    )
    db.add(document_field)
    return document_field


def save_result(
    db: Session,
    clickhouse,
    uploaded: UploadedFile,
    page: int,
    image: Image.Image,
    crop_data: Rectangle,
    field: dict,
    raw_text: str,
    value: str,
) -> dict:
    """Сохраняет crop в SQLite, а значение в ClickHouse."""
    document_field = get_document_field(db, uploaded, field)
    image_width, image_height = image.size

    crop = Crop(
        file_id=uploaded.id,
        page=page,
        x=round(crop_data.x * image_width),
        y=round(crop_data.y * image_height),
        width=round(crop_data.width * image_width),
        height=round(crop_data.height * image_height),
    )
    db.add(crop)

    timestamp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    clickhouse_id = uuid.uuid4().int & ((1 << 64) - 1)

    try:
        db.flush()

        clickhouse.insert(
            CLICKHOUSE_TABLE,
            [[
                clickhouse_id,
                uploaded.upload_id,
                page,
                crop.id,
                document_field.id,
                uploaded.document_type.title,
                uploaded.filename,
                str(field.get("id")),
                field.get("label") or "",
                field.get("unit") or "",
                field.get("type", "text"),
                raw_text,
                value,
                parse_numeric_value(value),
                timestamp,
            ]],
            column_names=[
                "id",
                "upload_id",
                "page",
                "crop_id",
                "field_id",
                "document_type",
                "filename",
                "title",
                "ru_title",
                "unit",
                "value_type",
                "raw_value",
                "value",
                "numeric_value",
                "timestamp",
            ],
        )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "id": str(field.get("id")),
        "label": field.get("label") or "",
        "type": field.get("type", "text"),
        "unit": field.get("unit") or "",
        "value": value,
    }


def validate_page(image: Image.Image, auto_crop: dict) -> tuple[bool, list[dict]]:
    """Проверяет страницу по контрольным crop из MongoDB."""
    checks = auto_crop.get("validation", [])
    if not checks:
        raise ValueError("auto_crop.validation is empty")

    results = []

    for check in checks:
        expected_text = check.get("expected_text", "")
        _, recognized_text = read_crop(image, check.get("crop", {}), psm=7)
        valid, score = compare_text(recognized_text, expected_text)

        results.append(
            {
                "id": check.get("id"),
                "expected": expected_text,
                "recognized": recognized_text,
                "valid": valid,
                "score": round(score, 3),
            }
        )

    return all(item["valid"] for item in results), results


def save_auto_page_results(
    db: Session,
    clickhouse,
    uploaded: UploadedFile,
    page_number: int,
    image: Image.Image,
    recognized_fields: list[dict],
) -> list[dict]:
    """Сохраняет все поля страницы одной пачкой."""
    image_width, image_height = image.size
    timestamp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

    prepared = []

    try:
        for item in recognized_fields:
            field = item["field"]
            crop_data = item["crop"]
            document_field = get_document_field(db, uploaded, field)

            crop = Crop(
                file_id=uploaded.id,
                page=page_number,
                x=round(crop_data.x * image_width),
                y=round(crop_data.y * image_height),
                width=round(crop_data.width * image_width),
                height=round(crop_data.height * image_height),
            )
            db.add(crop)

            prepared.append(
                {
                    **item,
                    "document_field": document_field,
                    "crop_model": crop,
                }
            )

        db.flush()

        rows = []
        for item in prepared:
            field = item["field"]
            rows.append(
                [
                    uuid.uuid4().int & ((1 << 64) - 1),
                    uploaded.upload_id,
                    page_number,
                    item["crop_model"].id,
                    item["document_field"].id,
                    uploaded.document_type.title,
                    uploaded.filename,
                    str(field.get("id")),
                    field.get("label") or "",
                    field.get("unit") or "",
                    field.get("type", "text"),
                    item["raw_text"],
                    item["value"],
                    parse_numeric_value(item["value"]),
                    timestamp,
                ]
            )

        if rows:
            clickhouse.insert(
                CLICKHOUSE_TABLE,
                rows,
                column_names=[
                    "id",
                    "upload_id",
                    "page",
                    "crop_id",
                    "field_id",
                    "document_type",
                    "filename",
                    "title",
                    "ru_title",
                    "unit",
                    "value_type",
                    "raw_value",
                    "value",
                    "numeric_value",
                    "timestamp",
                ],
            )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return [
        {
            "id": str(item["field"].get("id")),
            "label": item["field"].get("label") or "",
            "type": item["field"].get("type", "text"),
            "unit": item["field"].get("unit") or "",
            "value": item["value"],
        }
        for item in prepared
    ]


def process_auto_fields(
    db: Session,
    clickhouse,
    uploaded: UploadedFile,
    page_number: int,
    image: Image.Image,
    form_json: dict,
    auto_crop: dict,
) -> list[dict]:
    """Распознаёт все автоматические поля страницы."""
    recognized_fields = []

    for field_id, crop_config in auto_crop.get("fields", {}).items():
        field = find_field(
            form_json,
            field_id,
        )

        numeric = (
            field.get("type") == "number"
            or field.get("id") == "document_date"
        )

        crop, raw_text = read_crop(
            image,
            crop_config.get("crop", {}),
            psm=7,
            numeric=numeric,
        )

        value = clean_field_value(
            raw_text,
            field.get("type", "text"),
        )

        recognized_fields.append(
            {
                "field": field,
                "crop": crop,
                "raw_text": raw_text,
                "value": value,
            }
        )

    return save_auto_page_results(
        db=db,
        clickhouse=clickhouse,
        uploaded=uploaded,
        page_number=page_number,
        image=image,
        recognized_fields=recognized_fields,
    )


def auto_process(db: Session, args, clickhouse, request=None):
    """Автоматически проверяет и обрабатывает все страницы файла."""
    task_id = args.get("task_id")
    if not task_id:
        raise ValueError("task_id is required")

    uploaded = find_upload(db, task_id)
    if uploaded is None:
        raise ValueError(f"Unknown task_id: {task_id}")

    form_json = get_form(uploaded.document_type.title)
    auto_crop = form_json.get("auto_crop")
    if not auto_crop:
        raise ValueError(
            f"auto_crop is not configured for document type: "
            f"{uploaded.document_type.title}"
        )

    pages = render_pages(uploaded, request)
    page_results = []

    for page in pages:
        page_result = {"page": page["page"], "image_url": page["image_url"],
                       "status": None, "validation": [],
                       "fields": []}
        try:
            image = Image.open(BytesIO(read_bytes(page["storage_key"]))).convert("RGB")
            valid, validation = validate_page(image, auto_crop)
            page_result["validation"] = validation

            if not valid:
                page_result["status"] = "validation_failed"
                page_results.append(page_result)
                continue

            page_result["fields"] = process_auto_fields(
                db=db,
                clickhouse=clickhouse,
                uploaded=uploaded,
                page_number=page["page"],
                image=image,
                form_json=form_json,
                auto_crop=auto_crop,
            )
            page_result["status"] = "processed"

        except Exception as exc:
            db.rollback()
            page_result["status"] = "processing_failed"
            page_result["error"] = str(exc)
            print(
                f"Auto processing failed for task={task_id}, "
                f"page={page['page']}: {exc}"
            )

        page_results.append(page_result)

    processed = sum(
        1 for page in page_results
        if page["status"] == "processed"
    )
    validation_failed = sum(
        1 for page in page_results
        if page["status"] == "validation_failed"
    )
    processing_failed = sum(
        1 for page in page_results
        if page["status"] == "processing_failed"
    )

    if processed == len(page_results):
        status = "processed"
    elif processed > 0:
        status = "partial"
    elif processing_failed and validation_failed:
        status = "failed"
    elif processing_failed:
        status = "processing_failed"
    else:
        status = "validation_failed"

    return {
        "task_id": task_id,
        "document_type": uploaded.document_type.title,
        "status": status,
        "pages_total": len(page_results),
        "pages_processed": processed,
        "pages_validation_failed": validation_failed,
        "pages_processing_failed": processing_failed,
        "pages_failed": validation_failed + processing_failed,
        "pages": page_results,
    }


def latest_extract_rows(clickhouse, task_id: str) -> list[dict]:
    """Берёт последние значения полей для каждой страницы."""
    result = clickhouse.query(
        f"""
        SELECT
            page,
            title,
            argMax(ru_title, timestamp) AS ru_title,
            argMax(value_type, timestamp) AS value_type,
            argMax(unit, timestamp) AS unit,
            argMax(value, timestamp) AS value,
            max(timestamp) AS latest_timestamp
        FROM {CLICKHOUSE_TABLE}
        WHERE upload_id = {{upload_id:String}}
        GROUP BY page, title
        ORDER BY page, title
        """,
        parameters={"upload_id": task_id},
    )

    return [dict(zip(result.column_names, row)) for row in result.result_rows]


def extract(form, db: Session, clickhouse):
    """Распознаёт одно поле, которое пользователь выделил вручную."""
    val_data = ExtractField.model_validate(form)
    validate_rectangle(val_data.crop)

    uploaded = find_upload(db, val_data.task_id)
    if uploaded is None:
        raise ValueError(f"Unknown task_id: {val_data.task_id}")

    preview_key = f"previews/{val_data.task_id}/{val_data.page}.png"

    try:
        preview_data = read_bytes(preview_key)
    except FileNotFoundError as exc:
        raise ValueError(
            "Preview page is missing. Call /api/process/status first."
        ) from exc

    image = Image.open(BytesIO(preview_data)).convert("RGB")
    raw_text = ocr_on_image_with_bbox01(
        image,
        val_data.crop,
        lang="rus+eng",
        psm=6,
        oem=3,
    ).strip()

    form_json = get_form(uploaded.document_type.title)
    field = find_field(form_json, val_data.field_id)
    value = clean_field_value(raw_text, field.get("type", "text"))

    save_result(
        db=db,
        clickhouse=clickhouse,
        uploaded=uploaded,
        page=val_data.page,
        image=image,
        crop_data=val_data.crop,
        field=field,
        raw_text=raw_text,
        value=value,
    )

    data = ExtractOutput(
        id=str(field.get("id")),
        label=field.get("label") or "",
        type=field.get("type", "text"),
        unit=field.get("unit") or "",
        value=value,
        source=Source(crop=val_data.crop),
    )
    return data.model_dump()


def collect(db: Session, form, clickhouse):
    """Собирает последние распознанные значения по task_id."""
    task_id = form.get("task_id") if form else None
    if not task_id:
        raise ValueError("task_id is required")

    uploaded = find_upload(db, task_id)
    if uploaded is None:
        raise ValueError(f"Unknown task_id: {task_id}")

    data = latest_extract_rows(clickhouse, task_id)
    output_data = []
    for item in data:
        row = CollectOutput(
            id=item["title"],
            label=item["ru_title"],
            type=item["value_type"],
            unit=item["unit"],
            value=item["value"],
            display_value=item["value"],
        ).model_dump()
        row["page"] = item["page"]
        output_data.append(row)

    return {
        "result_id": uuid.uuid4(),
        "document_type": uploaded.document_type.title,
        "table": output_data,
    }


def excel(db: Session, args, clickhouse):
    """Формирует Excel и сохраняет его в MinIO."""
    task_id = args.get("task_id")
    if not task_id:
        raise ValueError("task_id is required")

    uploaded = find_upload(db, task_id)
    if uploaded is None:
        raise ValueError(f"Unknown task_id: {task_id}")

    data = latest_extract_rows(clickhouse, task_id)

    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Выгрузка"
    worksheet.append(["Страница", "Параметр", "Итоговое значение"])

    for item in data:
        worksheet.append([
            item["page"] + 1,
            item["ru_title"],
            item["value"],
        ])

    buffer = BytesIO()
    workbook.save(buffer)

    object_name = f"exports/{task_id}.xlsx"
    upload_bytes(
        buffer.getvalue(),
        object_name,
        (
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
    )
    return object_name
