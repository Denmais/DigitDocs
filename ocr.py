from dataclasses import dataclass
from PIL import Image
import pytesseract

class BBox01:
    x: float 
    y: float 
    width: float
    height: float


def crop_by_bbox01(img: Image.Image, b: BBox01) -> Image.Image:
    W, H = img.size
    print(W, H)
    # Перевод координат из долей страницы в пиксели
    x0 = int(b.x * W)
    y0 = int(b.y * H)
    x1 = int((b.x+b.width) * W)
    y1 = int((b.y+b.height) * H)
    # x0 = int(b.x * W)
    # x1 = int(b.y * W)
    # y0 = int(b.width * H)
    # y1 = int(b.height * H)
    print(x0, x1, y0, y1)

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

    return pytesseract.image_to_string(
        crop,
        lang=lang,
        config=config
    )


def ocr_on_image_with_bbox01(
    img: Image.Image,
    b: BBox01,
    *,
    lang: str = "rus+eng",
    psm: int = 6,
    oem: int = 3,
) -> str:

    crop = crop_by_bbox01(img, b)

    return ocr_pil_image(
        crop,
        lang=lang,
        psm=psm,
        oem=oem
    )

if __name__ == "__main__":

    img = Image.open("example_page_ocr.png").convert("RGB")

    bbox = BBox01(
        left=0.12,
        right=0.45,
        top=0.30,
        bottom=0.36
    )

    try:
        text = ocr_on_image_with_bbox01(
            img,
            bbox,
            lang="rus+eng",
            psm=6,
            oem=3
        )
        print("OCR result:")
        print(text)
    except ValueError as e:
        print("Ошибка bbox:", e)


    crop = crop_by_bbox01(img, bbox)

    text2 = ocr_pil_image(
        crop,
        lang="rus+eng",
        psm=6
    )

    print("OCR from crop:")
    print(text2)


    text3 = ocr_pil_image(
        crop,
        lang="eng",
        psm=7   # одна строка
    )

    print("OCR single line:")
    print(text3)



    bad_bbox = BBox01(left=0.5, right=0.4, top=0.1, bottom=0.2)

    if not bbox01_is_valid(bad_bbox):
        print("BBox некорректен, OCR не запускаем")


    text4 = pytesseract.image_to_string(
        crop,
        lang="rus+eng",
        config="--psm 6 --oem 3"
    )

    print("Direct pytesseract call:")
