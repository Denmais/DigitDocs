from __future__ import annotations
from pydantic import BaseModel, ConfigDict, AnyUrl, Field

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID


class UploadFile(BaseModel):
    type: str
    comment: str | None


class DocumentTypeSerializer(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str


class StorageInfo(BaseModel):
    file_url: str
    preview_available: bool


class UploadResponse(BaseModel):
    upload_id: UUID
    filename: str
    document_type: DocumentTypeSerializer
    storage: StorageInfo
    status: str
    uploaded_at: datetime


class Rectangle(BaseModel):
    x: float
    y: float
    width: float
    height: float


class ExtractField(BaseModel):
    task_id: str
    field_id: str
    page: int
    crop: Rectangle


class Source(BaseModel):
    crop: Rectangle


class ExtractOutput(BaseModel):
    id: str
    label: str
    type: str
    unit: str
    value: str
    source: Source


class CollectOutput(BaseModel):
    id: str
    label: str
    type: str
    unit: str
    value: str
    display_value: str

class HistoryOutput(BaseModel):
    name: str
    value: str
    timestamp: str
