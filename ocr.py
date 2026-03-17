from dataclasses import dataclass
from PIL import Image
import pytesseract


# -------------------------------
# Нормализованный bbox в долях страницы (0..1)
# -------------------------------
# Используется для:
# - независимости от DPI
# - одинаковой геометрии для preview и hi-res изображений
# - сериализации/передачи между фронтом и бэком
#@dataclass(frozen=True)
class BBox01:
    x: float    # левая граница (0..1) относительно ширины изображения
    y: float   # правая граница (0..1)
    width: float     # верхняя граница (0..1) относительно высоты изображения
    height: float  # нижняя граница (0..1)


# -------------------------------
# Проверка корректности bbox
# -------------------------------
# Гарантирует:
# - все координаты в диапазоне [0,1]
# - bbox имеет положительную площадь
# - bbox корректен геометрически
# def bbox01_is_valid(b: BBox01) -> bool:
#     return (
#         0 <= b.left < b.right <= 1 and
#         0 <= b.top < b.bottom <= 1
#     )


# -------------------------------
# Кроп изображения по нормализованному bbox
# -------------------------------
# Вход:
# - img: PIL.Image (обычно hi-res страница PDF)
# - b: bbox в процентах (0..1)
#
# Выход:
# - PIL.Image с вырезанным фрагментом
#
# Здесь происходит:
# - перевод процентов → пиксели
# - защита от слишком маленьких областей
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


# -------------------------------
# OCR одного кропа (PIL.Image)
# -------------------------------
# Это "чистая" OCR-функция:
# - не знает, откуда картинка
# - не знает, таблица это или нет
# - просто читает текст
#
# Параметры:
# - lang: языковые модели Tesseract
# - psm: режим сегментации страницы
# - oem: OCR-движок (3 = авто)
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


# -------------------------------
# Полный пайплайн OCR по bbox01
# -------------------------------
# Вход:
# - img: PIL.Image (hi-res страница)
# - b: BBox01 (нормализованный bbox)
#
# Это "склеивающая" функция:
# - валидирует bbox
# - кропает изображение
# - запускает OCR
#
# Вся логика OCR сосредоточена тут
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

    # OCR кропа
    return ocr_pil_image(
        crop,
        lang=lang,
        psm=psm,
        oem=oem
    )

# ============================================================
# Примеры использования модуля OCR (для понимания и тестов)
# ============================================================

if __name__ == "__main__":
    # --------------------------------------------
    # Пример 1: OCR по bbox (основной сценарий)
    # --------------------------------------------

    # Загружаем hi-res изображение страницы PDF
    img = Image.open("example_page_ocr.png").convert("RGB")

    # Нормализованный bbox (например, ячейка таблицы)
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


    # --------------------------------------------
    # Пример 2: OCR по уже вырезанному кропу
    # --------------------------------------------

    # Кропаем вручную (например, если bbox уже применён где-то ещё)
    crop = crop_by_bbox01(img, bbox)

    text2 = ocr_pil_image(
        crop,
        lang="rus+eng",
        psm=6
    )

    print("OCR from crop:")
    print(text2)


    # --------------------------------------------
    # Пример 3: OCR одной строки / значения
    # --------------------------------------------

    # Для одиночных значений (числа, код, ИНН и т.п.)
    text3 = ocr_pil_image(
        crop,
        lang="eng",
        psm=7   # одна строка
    )

    print("OCR single line:")
    print(text3)


    # --------------------------------------------
    # Пример 4: Проверка bbox без OCR
    # --------------------------------------------

    bad_bbox = BBox01(left=0.5, right=0.4, top=0.1, bottom=0.2)

    if not bbox01_is_valid(bad_bbox):
        print("BBox некорректен, OCR не запускаем")


    # --------------------------------------------
    # Пример 5: Минимальный “чистый” вызов OCR
    # --------------------------------------------

    # Когда геометрия уже обработана где-то выше
    text4 = pytesseract.image_to_string(
        crop,
        lang="rus+eng",
        config="--psm 6 --oem 3"
    )

    print("Direct pytesseract call:")
