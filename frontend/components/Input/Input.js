export class CustomInput {

  constructor({ rootId, data = [] }) {
    this.rootEl = document.getElementById(rootId);
    this.data = data;
  }


  render() {

    this.rootEl.innerHTML = this.data
      .map((field) => this.#renderField(field))
      .join('');

    this.#bindActions();

    document.addEventListener('cropModeEnabled', (e) => {
      this.#highlightField(e.detail.fieldId);
    });

 
    document.addEventListener('cropModeCanceled', () => {
      this.#clearHighlight();
    });


    document.addEventListener('cropSelected', () => {
      this.#clearHighlight();
    });
  }


  #bindActions() {
    this.rootEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.tariff-field__action');
      if (!btn) return;

      const field = btn.closest('.tariff-field');
      if (!field) return;

      const fieldId = field.dataset.fieldId;

      document.dispatchEvent(
        new CustomEvent('fieldCropStart', {
          detail: { fieldId },
        })
      );
    });
  }


  #highlightField(fieldId) {
    this.#clearHighlight();

    const field = this.rootEl.querySelector(
      `.tariff-field[data-field-id="${fieldId}"]`
    );

    if (field) field.classList.add('tariff-field--active');
  }

  #clearHighlight() {
    this.rootEl
      .querySelectorAll('.tariff-field--active')
      .forEach((el) => el.classList.remove('tariff-field--active'));
  }


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
