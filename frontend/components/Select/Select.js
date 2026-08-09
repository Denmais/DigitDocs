export class CustomSelect {
  constructor({
    rootId,
    data = [],
    placeholder = 'выберите категорию',
    defaultId = null,
  }) {
    this.rootEl = document.getElementById(rootId);
    this.data = data;
    this.placeholder = placeholder;
    this.defaultId = defaultId;
  }

  // Рисует список категорий.
  render() {
    const htmlOptions = this.data
      .map(({ id, title }) => {
        const selected = this.defaultId !== null && String(id) === String(this.defaultId);
        return `<li data-value="${id}" class="${selected ? 'selected' : ''}">${title}</li>`;
      })
      .join('');

    const selectedText = this.defaultId !== null
      ? this.data.find((item) => String(item.id) === String(this.defaultId))?.title || this.placeholder
      : this.placeholder;

    this.rootEl.innerHTML = `
      <button type="button" class="select-button">
        <span class="select-current">${selectedText}</span>
        <img src="./data/images/arrow-down.svg" alt="" class="arrow">
      </button>

      <ul class="select-dropdown" hidden>
        ${htmlOptions}
      </ul>
    `;

    this.button = this.rootEl.querySelector('.select-button');
    this.dropdown = this.rootEl.querySelector('.select-dropdown');
    this.current = this.rootEl.querySelector('.select-current');

    this.init();
  }

  // Открывает список и обрабатывает выбор.
  init() {
    this.button.addEventListener('click', () => {
      this.dropdown.toggleAttribute('hidden');
      this.button.classList.toggle('open');
    });

    this.dropdown.addEventListener('click', (e) => {
      if (e.target.tagName !== 'LI') return;

      const id = String(e.target.dataset.value);
      const title = e.target.textContent.trim();

      this.current.textContent = title;
      this.dropdown.querySelectorAll('li').forEach((li) => li.classList.remove('selected'));
      e.target.classList.add('selected');

      this.dropdown.hidden = true;
      this.button.classList.remove('open');

      localStorage.setItem('selectedCategoryId', id);
      localStorage.setItem('selectedCategoryTitle', title);

      this.rootEl.dispatchEvent(new CustomEvent('selectChange', {
        detail: { id, title },
      }));
    });
  }
}