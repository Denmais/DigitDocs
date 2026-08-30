import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote
from typing import Annotated

import uvicorn
from fastapi import (
    Body,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile as FastAPIUploadFile,
    status,
)
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

import models
from database import (
    SessionLocal,
    close_clickhouse_client,
    engine,
    get_clickhouse_client,
)
from mongo_forms import sync_forms_to_sqlite
from schemas import UploadResponse
from create_mart import create_mart
from storage import ensure_storage, get_object
from view import (
    auto_process,
    collect,
    excel,
    extract,
    process,
    types,
    upload_file,
)

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(__file__)
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
os.makedirs(FRONTEND_DIR, exist_ok=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_clickhouse():
    return get_clickhouse_client()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        sync_forms_to_sqlite(db)

    finally:
        db.close()
    get_clickhouse_client().command("SELECT 1")
    ensure_storage()

    try:
        yield
    finally:
        close_clickhouse_client()


app = FastAPI(lifespan=lifespan)


def _safe_file(directory: str, filename: str) -> Path:
    base = Path(directory).resolve()
    candidate = (base / filename).resolve()

    if candidate != base and base not in candidate.parents:
        raise HTTPException(status_code=404, detail="File not found")

    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return candidate


def stream_minio_object(
    object_name: str,
    download_name: str | None = None,
    fallback_content_type: str = "application/octet-stream",
):
    """Потоково отдаёт объект из MinIO."""
    try:
        obj = get_object(object_name)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=410,
            detail="File is no longer available in storage",
        ) from exc

    body = obj["Body"]
    headers = {}

    if obj.get("ContentLength") is not None:
        headers["Content-Length"] = str(obj["ContentLength"])

    if download_name:
        headers["Content-Disposition"] = (
            "attachment; "
            f"filename*=UTF-8''{quote(download_name)}"
        )

    return StreamingResponse(
        body.iter_chunks(chunk_size=1024 * 1024),
        media_type=obj.get("ContentType") or fallback_content_type,
        headers=headers,
        background=BackgroundTask(body.close),
    )


@app.get(
    "/uploads/{filename:path}",
    name="uploads_file",
    include_in_schema=False,
)
def uploads_file(filename: str):
    return stream_minio_object(
        filename,
        fallback_content_type="image/png",
    )

@app.post(
    "/api/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload(
    request: Request,
    file: Annotated[FastAPIUploadFile, File()],
    type_id: Annotated[str, Form()],
    comment: Annotated[str | None, Form()] = None,
    db: Session = Depends(get_db),
):
    try:
        filename = Path(file.filename or "").name
        if not filename:
            raise HTTPException(
                status_code=400,
                detail="No file / empty filename",
            )

        file_data = await file.read()
        if not file_data:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty",
            )

        validate_data = upload_file(
            db=db,
            file_data=file_data,
            filename=filename,
            content_type=file.content_type or "application/pdf",
            form={"type_id": type_id, "comment": comment},
            request=request,
        )

        return validate_data
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("upload failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        await file.close()


@app.get("/download/{filename:path}", name="download_file")
def download_file(filename: str):
    """Отдаёт исходный документ из MinIO."""
    return stream_minio_object(
        filename,
        download_name=filename.rsplit("/", 1)[-1],
        fallback_content_type="application/pdf",
    )

@app.get("/api/document-types")
def get_types(db: Session = Depends(get_db)):
    try:
        return types(db)
    except Exception as exc:
        logger.exception("document-types failed")
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/process/status")
def get_fields(
    request: Request,
    task_id: Annotated[str, Query()],
    db: Session = Depends(get_db),
):
    try:
        validate_data = process(
            db,
            args={"task_id": task_id},
            request=request,
        )

        if validate_data is None:
            raise HTTPException(status_code=400, detail="Unknown task_id")

        return validate_data
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("process/status failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/process/auto")
def process_automatically(
    request: Request,
    payload: Annotated[dict, Body()],
    db: Session = Depends(get_db),
    clickhouse=Depends(get_clickhouse),
):
    if not payload or not payload.get("task_id"):
        raise HTTPException(status_code=400, detail="task_id is required")

    try:
        return auto_process(
            db=db,
            args={"task_id": payload["task_id"]},
            clickhouse=clickhouse,
            request=request,
        )
    except Exception as exc:
        logger.exception("process/auto failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/extract-field")
def extract_data(
    payload: Annotated[dict, Body()],
    db: Session = Depends(get_db),
    clickhouse=Depends(get_clickhouse),
):
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or empty JSON body")

    try:
        return extract(payload, db, clickhouse)
    except Exception as exc:
        logger.exception("extract-field failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/collect")
def collect_data(
    payload: Annotated[dict, Body()],
    db: Session = Depends(get_db),
    clickhouse=Depends(get_clickhouse),
):
    try:
        return collect(db, payload, clickhouse)
    except Exception as exc:
        logger.exception("collect failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc



@app.post("/api/bi/publish")
def publish_bi(
    payload: Annotated[dict, Body()],
    clickhouse=Depends(get_clickhouse),
):
    """Создаёт или обновляет BI-витрину в Superset."""
    task_id = payload.get("task_id") if payload else None

    if not task_id:
        raise HTTPException(
            status_code=400,
            detail="task_id is required",
        )

    try:
        return create_mart(
            task_id=task_id,
            clickhouse=clickhouse,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("bi/publish failed")
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


@app.get("/api/excel")
def collect_xls(
    task_id: Annotated[str, Query()],
    db: Session = Depends(get_db),
    clickhouse=Depends(get_clickhouse),
):
    try:
        object_name = excel(
            db,
            args={"task_id": task_id},
            clickhouse=clickhouse,
        )

        return stream_minio_object(
            object_name,
            download_name=f"{task_id}.xlsx",
            fallback_content_type=(
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("excel failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.get("/", include_in_schema=False)
@app.get("/{path:path}", include_in_schema=False)
def serve_frontend(path: str = ""):
    if path.startswith(("api/", "download/", "uploads/")):
        raise HTTPException(status_code=404, detail="Not found")

    if path:
        try:
            candidate = _safe_file(FRONTEND_DIR, path)
            return FileResponse(candidate)
        except HTTPException:
            pass

    index_path = Path(FRONTEND_DIR, "index.html")
    if not index_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="frontend/index.html not found",
        )

    return FileResponse(index_path)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )