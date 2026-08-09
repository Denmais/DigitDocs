import os
from io import BytesIO

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.environ["MINIO_ACCESS_KEY"]
MINIO_SECRET_KEY = os.environ["MINIO_SECRET_KEY"]
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "invoice-files")
MINIO_EXPIRATION_DAYS = int(os.getenv("MINIO_EXPIRATION_DAYS", "20"))


s3 = boto3.client(
    "s3",
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
    region_name="us-east-1",
    config=Config(
        signature_version="s3v4",
        s3={"addressing_style": "path"},
    ),
)


def ensure_storage() -> None:
    """Создаёт bucket и задаёт общий срок хранения файлов."""
    try:
        s3.head_bucket(Bucket=MINIO_BUCKET)
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        if code not in {"404", "NoSuchBucket", "NotFound"}:
            raise

        s3.create_bucket(Bucket=MINIO_BUCKET)
        print(f"[MINIO] bucket created: {MINIO_BUCKET}")

    lifecycle_config = {
        "Rules": [
            {
                "ID": f"delete-all-after-{MINIO_EXPIRATION_DAYS}-days",
                "Filter": {"Prefix": ""},
                "Status": "Enabled",
                "Expiration": {"Days": MINIO_EXPIRATION_DAYS},
            }
        ]
    }

    s3.put_bucket_lifecycle_configuration(
        Bucket=MINIO_BUCKET,
        LifecycleConfiguration=lifecycle_config,
    )


def upload_fileobj(file_obj, object_name: str, content_type: str) -> None:
    """Загружает файловый объект в MinIO."""
    file_obj.seek(0)
    s3.upload_fileobj(
        file_obj,
        MINIO_BUCKET,
        object_name,
        ExtraArgs={"ContentType": content_type},
    )
    file_obj.seek(0)
    print(f"[MINIO] uploaded: {object_name}")


def upload_bytes(
    data: bytes,
    object_name: str,
    content_type: str,
) -> None:
    """Загружает байты в MinIO."""

    buffer = BytesIO(data)

    s3.upload_fileobj(
        buffer,
        MINIO_BUCKET,
        object_name,
        ExtraArgs={
            "ContentType": content_type,
        },
    )


def download_to_file(object_name: str, destination: str) -> None:
    """Скачивает объект MinIO во временный локальный файл."""
    try:
        s3.download_file(MINIO_BUCKET, object_name, destination)
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        if code in {"404", "NoSuchKey", "NoSuchObject", "NotFound"}:
            raise FileNotFoundError(object_name) from exc
        raise


def read_bytes(object_name: str) -> bytes:
    """Читает объект MinIO целиком в память."""
    obj = get_object(object_name)
    body = obj["Body"]
    try:
        return body.read()
    finally:
        body.close()


def get_object(object_name: str):
    """Открывает объект MinIO для потоковой отдачи."""
    try:
        return s3.get_object(Bucket=MINIO_BUCKET, Key=object_name)
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        if code in {"404", "NoSuchKey", "NoSuchObject", "NotFound"}:
            raise FileNotFoundError(object_name) from exc
        raise


def delete_object(object_name: str) -> None:
    """Удаляет объект из MinIO."""
    s3.delete_object(Bucket=MINIO_BUCKET, Key=object_name)