/**
 * CustomInput
 *
 * Компонент формы "Выбор данных".
 *
 * Отвечает за:
 * - отображение списка полей, которые нужно извлечь из документа
 * - ввод / редактирование значений
 * - запуск режима crop для конкретного поля
 * - визуальную подсветку активного поля
 *
 * Backend-разработчику:
 * 👉 каждое поле соответствует одному entity/атрибуту,
 * 👉 значения этих полей в итоге отправляются в POST /api/collect
 */

export class CustomInput {
  /**
   * @param {string} rootId - id контейнера для формы
   * @param {Array} data - список полей, полученных от backend
   */
  constructor({ rootId, data = [] }) {
    this.rootEl = document.getElementById(rootId);
    this.data = data;
  }

  /**
   * render()
   *
   * Отрисовывает все поля формы на основе данных backend.
   * Также подписывается на события crop.
   */
  render() {
    /**
     * Генерация HTML всех полей
     */
    this.rootEl.innerHTML = this.data
      .map((field) => this.#renderField(field))
      .join('');

    /**
     * Навешиваем обработчики на кнопки "выбрать фрагмент"
     */
    this.#bindActions();

    /**
     * Событие: режим crop включён
     * → подсвечиваем активное поле
     */
    document.addEventListener('cropModeEnabled', (e) => {
      this.#highlightField(e.detail.fieldId);
    });

    /**
     * Событие: crop отменён (ESC)
     * → убираем подсветку
     */
    document.addEventListener('cropModeCanceled', () => {
      this.#clearHighlight();
    });

    /**
     * Событие: crop завершён
     * → убираем подсветку
     */
    document.addEventListener('cropSelected', () => {
      this.#clearHighlight();
    });
  }

  /**
   * #bindActions()
   *
   * Ловит клики по кнопке "⛶" у каждого поля.
   * Запускает режим crop для конкретного fieldId.
   */
  #bindActions() {
    this.rootEl.addEventListener('click', (e) => {
      // Ищем кнопку выбора фрагмента
      const btn = e.target.closest('.tariff-field__action');
      if (!btn) return;

      // Определяем поле, к которому относится кнопка
      const field = btn.closest('.tariff-field');
      if (!field) return;

      const fieldId = field.dataset.fieldId;

      /**
       * Глобальное событие:
       * Actionbar его перехватывает и запускает PdfCrop
       */
      document.dispatchEvent(
        new CustomEvent('fieldCropStart', {
          detail: { fieldId },
        })
      );
    });
  }

  /**
   * #highlightField()
   *
   * Подсвечивает активное поле,
   * для которого пользователь сейчас выбирает фрагмент.
   */
  #highlightField(fieldId) {
    this.#clearHighlight();

    const field = this.rootEl.querySelector(
      `.tariff-field[data-field-id="${fieldId}"]`
    );

    if (field) field.classList.add('tariff-field--active');
  }

  /**
   * #clearHighlight()
   *
   * Убирает подсветку со всех полей
   */
  #clearHighlight() {
    this.rootEl
      .querySelectorAll('.tariff-field--active')
      .forEach((el) => el.classList.remove('tariff-field--active'));
  }

  /**
   * #renderField()
   *
   * Генерирует HTML одного поля.
   *
   * @param {Object} field - описание поля от backend
   *
   * Ожидаемая структура поля:
   * {
   *   id: "tariff_kw_day",
   *   label: "Тариф (день), ₽/кВт·ч",
   *   type: "number" | "text",
   *   required: true,
   *   tooltip: "Подсказка",
   *   unit: "RUB_PER_KWH",
   *   constraints: { min, max, step },
   *   value: "4.32"
   * }
   */
  #renderField(field) {
    const {
      id,
      label,
      type,
      required,
      tooltip,
      unit,
      constraints,
      value,
    } = field;

    return `
      <div class="tariff-field" data-field-id="${id}">
        <label class="tariff-field__label">${label}</label>

        <div class="tariff-field__control">
          <input
            id="${id}"
            type="${type === 'number' ? 'number' : 'text'}"
            ${required ? 'required' : ''}
            value="${value ?? ''}"
            placeholder="${tooltip || ''}"
            ${constraints?.min ? `min="${constraints.min}"` : ''}
            ${constraints?.max ? `max="${constraints.max}"` : ''}
            ${constraints?.step ? `step="${constraints.step}"` : ''}
          />

          ${
            unit
              ? `<span class="tariff-field__unit"></span>`
              : ''
          }

          <!-- Кнопка запуска визуального выбора значения -->
          <button
            type="button"
            class="tariff-field__action"
            title="Выбрать значение на документе"
          >
            ⛶
          </button>
        </div>
      </div>
    `;
  }
}
