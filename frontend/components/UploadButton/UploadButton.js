import { nextStep, previousStep } from '../../utils/stepManager.js';
import { API_CONFIG } from '../../constants/api.js';

export class UploadButton {
  constructor({ rootId }) {
    this.rootEl = document.getElementById(rootId);
    this.isFirstUpload = true;
    this.selectedCategoryId = null;
    this.selectedCategoryTitle = null;

    this.setupCategoryListener();
    this.checkSavedCategory();
  }

  // Слушает выбор категории.
  setupCategoryListener() {
    const selectRoot = document.getElementById('doc-type');

    if (selectRoot) {
      selectRoot.addEventListener('selectChange', (e) => {
        if (!e.detail?.id) return;

        this.selectedCategoryId = e.detail.id;
        this.selectedCategoryTitle = e.detail.title;

        localStorage.setItem('selectedCategoryId', e.detail.id);
        localStorage.setItem('selectedCategoryTitle', e.detail.title);
      });
    }
  }

  // Восстанавливает выбранную категорию из localStorage.
  checkSavedCategory() {
    const savedId = (localStorage.getItem('selectedCategoryId') || '').trim();
    const savedTitle = (localStorage.getItem('selectedCategoryTitle') || '').trim();

    if (savedId) this.selectedCategoryId = savedId;
    if (savedTitle) this.selectedCategoryTitle = savedTitle;
  }

  // Рисует область загрузки.
  render() {
    this.rootEl.innerHTML = `
      <div class="upload-zone__text">
        Перетащите файл .pdf или загрузите его с компьютера
      </div>

      <input
        class="upload-zone__input"
        type="file"
        accept=".pdf"
        id="fileInput"
        hidden
      >

      <button type="button" class="upload-zone__btn" id="uploadBtn">
        <img src="./data/images/download.svg" width="16" height="16">
        Загрузить
      </button>
    `;

    this.text = this.rootEl.querySelector('.upload-zone__text');
    this.button = this.rootEl.querySelector('#uploadBtn');
    this.fileInput = this.rootEl.querySelector('#fileInput');
    this.processingButton = document.querySelector('#processing-btn');
    this.processingButton.classList.add('form__group--hidden');

    this.init();
  }

  // Подключает кнопку загрузки и drag-and-drop.
  init() {
    const canPickFile = () => {
      const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const currentTitle = this.#getCurrentSelectTitle();
      const placeholder = 'выберите категорию';

      return normalize(currentTitle) && normalize(currentTitle) !== normalize(placeholder);
    };

    this.button.addEventListener('click', () => {
      if (!canPickFile()) {
        alert('Сначала выберите тип документа');
        return;
      }

      this.fileInput.click();
    });

    this.rootEl.addEventListener('dragover', (e) => {
      if (!canPickFile()) return;
      e.preventDefault();
      this.rootEl.classList.add('dragover');
    });

    this.rootEl.addEventListener('dragleave', () => {
      this.rootEl.classList.remove('dragover');
    });

    this.rootEl.addEventListener('drop', (e) => {
      if (!canPickFile()) {
        alert('Сначала выберите тип документа');
        return;
      }

      e.preventDefault();
      this.rootEl.classList.remove('dragover');

      const file = e.dataTransfer.files[0];
      if (file) this.#handleFile(file);
    });

    this.fileInput.addEventListener('change', () => {
      if (!canPickFile()) {
        alert('Сначала выберите тип документа');
        this.fileInput.value = '';
        return;
      }

      const file = this.fileInput.files[0];
      if (file) this.#handleFile(file);
    });
  }

  // Загружает выбранный файл.
  async #handleFile(file) {
    this.#updateUI(file);

    if (this.isFirstUpload) {
      await this.#sendFile(file);
      nextStep();
      this.isFirstUpload = false;
    } else {
      previousStep();
      await this.#sendFile(file);
      nextStep();
    }
  }

  // Проверяет PDF и отправляет его на backend.
  async #sendFile(file) {
    try {
      this.text.innerHTML = '⏳ Отправка файла...';
      this.button.disabled = true;

      const currentTitle = this.#getCurrentSelectTitle();
      const placeholder = 'выберите категорию';

      if (!currentTitle || currentTitle === placeholder) {
        localStorage.removeItem('selectedCategoryId');
        localStorage.removeItem('selectedCategoryTitle');
        this.selectedCategoryId = null;
        this.selectedCategoryTitle = null;
        throw new Error('Сначала выберите тип документа');
      }

      this.selectedCategoryTitle = currentTitle;

      if (file.type !== 'application/pdf') {
        throw new Error('Поддерживается только PDF');
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('Файл больше 10MB');
      }

      const uploadResponse = await this.#uploadToServer(file, this.selectedCategoryTitle);

      this.processingButton.classList.remove('form__group--hidden');

      localStorage.setItem('upload_id', uploadResponse.upload_id);
      localStorage.setItem('uploadedFile', uploadResponse.filename);
      localStorage.setItem('uploadedFileMeta', JSON.stringify(uploadResponse));

      this.text.innerHTML = `
        ✅ Файл загружен:<br>
        <strong>${uploadResponse.filename}</strong><br>
        <small>Категория: ${uploadResponse.document_type.title}</small>
      `;
    } catch (err) {
      alert(err.message);
    } finally {
      this.button.disabled = false;
    }
  }

  // Отправляет multipart/form-data на /api/upload.
  async #uploadToServer(file, typeTitle) {
    const formData = new FormData();
    formData.append('type_id', typeTitle);
    formData.append('file', file);

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD}`, {
      method: 'POST',
      body: formData,
    });

    const text = await response.text().catch(() => '');

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    return text ? JSON.parse(text) : {};
  }

  // Меняет текст и кнопку после выбора файла.
  #updateUI(file) {
    const name = file.name.length > 30 ? file.name.slice(0, 27) + '...' : file.name;

    this.text.innerHTML = `
      Загружен файл:<br>
      <strong>${name}</strong>
    `;

    this.button.innerHTML = `
      <img src="./data/images/download.svg" width="16" height="16">
      Загрузить другой файл
    `;

    this.rootEl.classList.add('uploaded');
  }

  #getCurrentSelectTitle() {
    const selectRoot = document.getElementById('doc-type');
    const currentEl = selectRoot?.querySelector('.select-current');
    return (currentEl?.textContent || '').trim();
  }
}