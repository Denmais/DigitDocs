export class CustomInput {
  constructor({ rootId, data = [] }) {
    this.rootEl = document.getElementById(rootId);
    this.data = data;
  }

  // Рисует поля и подключает выбор области.
  render() {
    this.rootEl.innerHTML = this.data.map((field) => this.#renderField(field)).join('');
    this.#bindActions();

    document.addEventListener('cropModeEnabled', (e) => {
      this.#highlightField(e.detail.fieldId);
    });

    document.addEventListener('cropModeCanceled', () => this.#clearHighlight());
    document.addEventListener('cropSelected', () => this.#clearHighlight());
  }

  // Кнопка справа запускает выбор области на документе.
  #bindActions() {
    this.rootEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.tariff-field__action');
      if (!btn) return;

      const field = btn.closest('.tariff-field');
      if (!field) return;

      document.dispatchEvent(new CustomEvent('fieldCropStart', {
        detail: { fieldId: field.dataset.fieldId },
      }));
    });
  }

  #highlightField(fieldId) {
    this.#clearHighlight();
    this.rootEl
      .querySelector(`.tariff-field[data-field-id="${fieldId}"]`)
      ?.classList.add('tariff-field--active');
  }

  #clearHighlight() {
    this.rootEl
      .querySelectorAll('.tariff-field--active')
      .forEach((el) => el.classList.remove('tariff-field--active'));
  }

  // Рисует одно поле из Mongo-формы.
  #renderField(field) {
    const { id, label, type, required, tooltip, unit, constraints, value } = field;

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
            ${constraints?.min != null ? `min="${constraints.min}"` : ''}
            ${constraints?.max != null ? `max="${constraints.max}"` : ''}
            ${constraints?.step != null ? `step="${constraints.step}"` : ''}
          />

          ${unit ? '<span class="tariff-field__unit"></span>' : ''}

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