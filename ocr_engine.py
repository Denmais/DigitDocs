from dataclasses import dataclass

import cv2
import numpy as np
import pytesseract
from PIL import Image


@dataclass(frozen=True)
class BBox01:
    x: float
    y: float
    width: float
    height: float


def bbox01_is_valid(bbox: BBox01) -> bool:
    return (
        bbox.x >= 0
        and bbox.y >= 0
        and bbox.width > 0
        and bbox.height > 0
        and bbox.x + bbox.width <= 1
        and bbox.y + bbox.height <= 1
    )


def preprocess_for_ocr(img: Image.Image) -> Image.Image:
    gray = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
    gray = cv2.resize(
        gray,
        None,
        fx=3,
        fy=3,
        interpolation=cv2.INTER_CUBIC,
    )

    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    background = cv2.GaussianBlur(gray, (0, 0), 25)
    norm = cv2.divide(gray, background, scale=255)
    norm = cv2.bilateralFilter(norm, 7, 50, 50)

    bw = cv2.adaptiveThreshold(
        norm,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        41,
        11,
    )

    kernel = np.ones((2, 2), np.uint8)
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel)
    return Image.fromarray(bw)


def crop_by_bbox01(img: Image.Image, bbox: BBox01) -> Image.Image:
    if not bbox01_is_valid(bbox):
        raise ValueError("bad bbox")

    width, height = img.size
    x0 = int(bbox.x * width)
    y0 = int(bbox.y * height)
    x1 = int((bbox.x + bbox.width) * width)
    y1 = int((bbox.y + bbox.height) * height)

    if x1 - x0 < 5 or y1 - y0 < 5:
        raise ValueError("bbox too small")

    return img.crop((x0, y0, x1, y1))


def ocr_pil_image(
    crop: Image.Image,
    lang: str = "rus+eng",
    psm: int = 6,
    oem: int = 3,
) -> str:
    config = f"--psm {psm} --oem {oem}"
    return pytesseract.image_to_string(crop, lang=lang, config=config)


def ocr_on_image_with_bbox01(
    img: Image.Image,
    bbox: BBox01,
    *,
    lang: str = "rus+eng",
    psm: int = 6,
    oem: int = 3,
) -> str:
    print(bbox)
    crop = crop_by_bbox01(img, bbox)
    processed_crop = preprocess_for_ocr(crop)
    return ocr_pil_image(
        processed_crop,
        lang=lang,
        psm=psm,
        oem=oem,
    )