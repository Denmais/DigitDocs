from dataclasses import dataclass
from PIL import Image, ImageFilter, ImageOps
import pytesseract
import cv2
from enum import Enum


def preprocess_for_ocr(img: Image.Image) -> Image.Image:
    # PIL -> OpenCV
    gray = cv2.cvtColor(
        np.array(img),
        cv2.COLOR_RGB2GRAY
    )

    gray = cv2.resize(
        gray,
        None,
        fx=3,
        fy=3,
        interpolation=cv2.INTER_CUBIC
    )

    clahe = cv2.createCLAHE(
        clipLimit=3.0,
        tileGridSize=(8, 8)
    )
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
        11
    )

    kernel = np.ones((2, 2), np.uint8)
    bw = cv2.morphologyEx(
        bw,
        cv2.MORPH_CLOSE,
        kernel
    )

    return Image.fromarray(bw)

#@dataclass(frozen=True)
class BBox01:
    x: float    # левая граница (0..1) относительно ширины изображения
    y: float   # правая граница (0..1)
    width: float     # верхняя граница (0..1) относительно высоты изображения
    height: float  # нижняя граница (0..1)



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

    # Защита от бессмысленного OCR
    # (Tesseract плохо работает на микро-областях)
    if x1 - x0 < 5 or y1 - y0 < 5:
        raise ValueError("bbox too small")

    # PIL crop: (left, top, right, bottom)
    return img.crop((x0, y0, x1, y1))



def ocr_pil_image(
    crop: Image.Image,
    lang: str = "rus+eng",
    psm: int = 6,
    oem: int = 3,
) -> str:
    # Конфигурация Tesseract
    # psm 6 = один блок текста (оптимально для ячеек таблиц)
    config = f"--psm {psm} --oem {oem}"

    # Запуск OCR
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
    # # Проверяем геометрию bbox
    # if not bbox01_is_valid(b):
    #     raise ValueError("bad bbox")

    # Кроп изображения
    crop = crop_by_bbox01(img, b)
    prcrop = preprocess_for_ocr(crop)
    # OCR кропа
    return ocr_pil_image(
        prcrop,
        lang=lang,
        psm=psm,
        oem=oem
    )



if __name__ == "__main__":

    # Загружаем hi-res изображение страницы PDF
    img = Image.open("example_page_ocr.png").convert("RGB")

    bbox = BBox01(
        left=0.12,
        right=0.45,
        top=0.30,
        bottom=0.36
    )
    # bbox = BBox01(
    #     left=0.12,
    #     right=0.45,
    #     top=0.30,
    #     bottom=0.36
    # )

    try:
        text = ocr_on_image_with_bbox01(
            img,
            bbox,
            lang="rus+eng",
            psm=6,   # один текстовый блок
            oem=3
        )
        print("OCR result:")
        print(text)
    except ValueError as e:
        print("Ошибка bbox:", e)



    # Кропаем вручную (например, если bbox уже применён где-то ещё)
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
    print(text4)
