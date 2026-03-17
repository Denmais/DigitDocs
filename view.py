from sqlalchemy.orm import Session
from models import DocumentType, UploadedFile, ExtractData
from schemas import (UploadResponse, StorageInfo, DocumentTypeSerializer,
                     ExtractField, ExtractOutput, Source, CollectOutput, HistoryOutput)
import os
import datetime
from flask import url_for
import uuid
from uuid import UUID
from openpyxl import Workbook
from pydantic import TypeAdapter
from ocr_engine import ocr_on_image_with_bbox01
import json
from PIL import Image
from pdf2image import convert_from_path

BASE_DIR = os.path.dirname(__file__)
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
XLS = os.path.join(BASE_DIR, "xls")
PATH = os.path.join(BASE_DIR, "media")
UPLOADS = os.path.join(BASE_DIR, "uploads")

FORMS_DIR = os.path.join(BASE_DIR, "forms")
DEFAULT_FORM = os.path.join(BASE_DIR, "form.json")
#"form.json"

def get_form_path_for_task(db: Session, task_id: str) -> str:
    uploaded = db.query(UploadedFile).filter(UploadedFile.upload_id == task_id).first()
    if not uploaded or not uploaded.type:
        return DEFAULT_FORM

    doc_title = uploaded.type.title  # electricity / water_cold / water_hot ...
    candidate = os.path.join(FORMS_DIR, f"{doc_title}.json")
    print("DOC_TITLE:", doc_title, "FORM:", candidate, "EXISTS:", os.path.exists(candidate))

    return candidate if os.path.exists(candidate) else DEFAULT_FORM


def load_form_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)



def upload_file(db: Session, files, form):
    file = files['file']
    if file.filename == '':
        return None
    if file:
        filename = file.filename
        filepath = os.path.join(PATH, filename)
        file.save(filepath)
        type = db.query(DocumentType).filter(DocumentType.title == form.get("type_id")).first()
        u = uuid.uuid4()
        new_file = UploadedFile(filename=filename, filepath=filepath,
                                upload_id=str(u),
                                type=type,
                                comment=form.get("comment"),
                                uploaded_at=datetime.datetime.now())
        db.add(new_file)
        db.commit()
        db.refresh(new_file)
        storage = StorageInfo(file_url=url_for('download_file', filename=filename, _external=True),
                              preview_available=False)

        doc = DocumentTypeSerializer(id=type.id, title=type.title)
        validated_data = UploadResponse(upload_id=u, filename=filename,
                                        storage=storage,
                                        document_type=doc,
                                        uploaded_at=datetime.datetime.now(),
                                        status='upload')
        #print(validated_data)
        return validated_data


def types(db: Session):
    types = db.query(DocumentType).all()
    val_types = [DocumentTypeSerializer.model_validate(i).model_dump() for i in types]
    print(val_types)
    return val_types


def process(db: Session, args):
    val_data = {"task_id": args.get("task_id"), "pages": []}

    uploaded = db.query(UploadedFile).filter(UploadedFile.upload_id == val_data["task_id"]).first()
    if not uploaded:
        return None

    file_name = uploaded.filename

    conv_data = convert_from_path(f"{PATH}/{file_name}", dpi=120)
    for cnt, img in enumerate(conv_data):
        img.save(f"{UPLOADS}/{val_data['task_id']}_{cnt}.png", "PNG")
        val_data["pages"].append({
            "page": cnt,
            "image_url": f"http://ghjk-ljbn-mnbv-jgva.ispvds.com/uploads/{val_data['task_id']}_{cnt}.png"
        })

    form_path = get_form_path_for_task(db, val_data["task_id"])
    data = load_form_json(form_path)

    val_data.update(data)
    return val_data


def extract(form, db):
    val_data = ExtractField.model_validate(form)

    img = Image.open(f"{UPLOADS}/{val_data.task_id}_{val_data.page}.png").convert("RGB")
    text = ocr_on_image_with_bbox01(
        img,
        val_data.crop,
        lang="rus+eng",
        psm=6,
        oem=3
    ).strip()

    print("OCR result:", text)

    form_path = get_form_path_for_task(db, val_data.task_id)
    js = load_form_json(form_path)

    typed = next((i for i in js.get("fields", []) if i.get("id") == val_data.field_id), None)
    if not typed:
        raise ValueError(
            f"Unknown field_id: {val_data.field_id}. "
            f"Known ids: {[f.get('id') for f in js.get('fields', [])]} "
            f"(form={form_path})"
        )
    file_name = db.query(UploadedFile).filter(UploadedFile.upload_id == val_data.task_id).first().filename
    val_crop = Source(crop=val_data.crop)

    data = ExtractOutput(
        id=typed.get("id"),
        label=typed.get("label"),
        type=typed.get("type", "text"),
        unit=typed.get("unit", ""),
        value=text,
        source=val_crop
    )
    item = db.query(ExtractData).filter(ExtractData.title == typed.get("id"),
                                        ExtractData.upload_id == val_data.task_id).first()
    if item:
        item.value = text
        db.commit()
    else:
        inst = ExtractData(
            doc_name=f"{UPLOADS}/{file_name}",
            title=typed.get("id"),
            ru_title=typed.get("label"),
            unit=typed.get("unit", ""),
            value=text,
            upload_id=val_data.task_id,
            type=typed.get("type", "text")
        )

        db.add(inst)
        db.commit()
        db.refresh(inst)
    return data.model_dump()


def collect(db: Session, form):
    # TODO: None
    data = db.query(ExtractData).filter(ExtractData.upload_id == form.get("task_id")).all()
    file = db.query(UploadedFile).filter(UploadedFile.upload_id == form.get("task_id")).first()
    type = db.query(DocumentType).filter(DocumentType.id == file.type_id).first()

    output_data = [CollectOutput(id=i.title, label=i.ru_title, type=i.type,
                                 unit=i.unit, value=i.value,
                                 display_value=i.value).model_dump() for i in data]
    val_data = {"result_id": uuid.uuid4(), "document_type": type.title}
    val_data.update({"table": output_data})
    return val_data



def history(db: Session):
    # TODO: None
    data = db.query(ExtractData).all()
    output_data = [HistoryOutput(name=i.doc_name, value=i.value,
                                 timestamp=str(i.timestamp)).model_dump() for i in data]
    
    return {"result": output_data}


def excel(db: Session, args):
    # TODO: None
    task_id = args.get("task_id")
    data = db.query(ExtractData).filter(ExtractData.upload_id == task_id).all()
#    id = data[0].upload_id
    print(task_id)
    wb = Workbook()
    ws = wb.active
    ws.title = "Выгрузка"

    ws.append(["Параметр", "Итоговое значение"])
    for item in data:
        ws.append([item.ru_title, item.value])
    path = f"{XLS}/{task_id}.xlsx"
    wb.save(path)
    return task_id

#    return {"url": f"https://ghjk-ljbn-mnbv-jgva.ispvds.com/xls/{task_id}.xlsx"}
