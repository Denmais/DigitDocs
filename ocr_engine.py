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


def crop_by_bbox01(
    img: Image.Image,
    bbox: BBox01,
) -> Image.Image:
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


def preprocess_for_ocr(
    img: Image.Image,
) -> Image.Image:
    """Подготовка без удаления мелких точек."""
    gray = cv2.cvtColor(
        np.array(img.convert("RGB")),
        cv2.COLOR_RGB2GRAY,
    )

    # Сильно увеличиваем маленький crop.
    gray = cv2.resize(
        gray,
        None,
        fx=4,
        fy=4,
        interpolation=cv2.INTER_CUBIC,
    )

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8),
    )

    gray = clahe.apply(gray)

    # Нормализация неравномерного фона.
    background = cv2.GaussianBlur(
        gray,
        (0, 0),
        21,
    )

    normalized = cv2.divide(
        gray,
        background,
        scale=255,
    )

    # Otsu обычно лучше сохраняет точки,
    # чем aggressive adaptive threshold.
    _, bw = cv2.threshold(
        normalized,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )

    # Tesseract не любит текст вплотную к границам.
    bw = cv2.copyMakeBorder(
        bw,
        20,
        20,
        20,
        20,
        cv2.BORDER_CONSTANT,
        value=255,
    )

    return Image.fromarray(bw)


def ocr_pil_image(
    crop: Image.Image,
    lang: str = "rus+eng",
    psm: int = 7,
    oem: int = 3,
) -> str:
    processed = preprocess_for_ocr(crop)

    config = (
        f"--psm {psm} "
        f"--oem {oem} "
        "-c preserve_interword_spaces=1"
    )

    return pytesseract.image_to_string(
        processed,
        lang=lang,
        config=config,
    ).strip()


def ocr_numeric_image(
    crop: Image.Image,
    psm: int = 7,
) -> str:
    """OCR для чисел, сумм и дат."""
    processed = preprocess_for_ocr(crop)

    config = (
        f"--psm {psm} "
        "--oem 3 "
        "-c tessedit_char_whitelist=0123456789.,- "
        "-c load_system_dawg=0 "
        "-c load_freq_dawg=0 "
        "-c preserve_interword_spaces=1"
    )

    return pytesseract.image_to_string(
        processed,
        # Для одних цифр русский словарь не нужен.
        lang="eng",
        config=config,
    ).strip()


def ocr_on_image_with_bbox01(
    img: Image.Image,
    bbox: BBox01,
    *,
    lang: str = "rus+eng",
    psm: int = 7,
    oem: int = 3,
    numeric: bool = False,
) -> str:
    crop = crop_by_bbox01(
        img,
        bbox,
    )

    if numeric:
        return ocr_numeric_image(
            crop,
            psm=psm,
        )

    return ocr_pil_image(
        crop,
        lang=lang,
        psm=psm,
        oem=oem,
    )