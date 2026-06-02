import { nextStep, previousStep } from '../../utils/stepManager.js';
import { API_CONFIG } from '../../constants/api.js';

export class UploadButton {
  constructor({ rootId }) {
    /**
     * rootEl - DOM-контейнер upload-зоны
     */
    this.rootEl = document.getElementById(rootId);


    this.isFirstUpload = true;


    this.selectedCategoryId = null;
    this.selectedCategoryTitle = null;

    // Подписка на события выбора категории
    this.setupCategoryListener();

    // Если категория уже выбрана ранее - восстанавливаем
    this.checkSavedCategory();
  }


  setupCategoryListener() {
    const selectRoot = document.getElementById('doc-type');

    // событие selectChange диспатчится на #doc-type
    if (selectRoot) {
      selectRoot.addEventListener('selectChange', (e) => {
        if (e.detail?.id) {
          this.selectedCategoryId = e.detail.id;
          this.selectedCategoryTitle = e.detail.title;

          // на всякий случай сразу синхроним localStorage
          localStorage.setItem('selectedCategoryId', e.detail.id);
          localStorage.setItem('selectedCategoryTitle', e.detail.title);
        }
      });
    }
  }


  checkSavedCategory() {
    const savedId = (localStorage.getItem('selectedCategoryId') || '').trim();
    const savedTitle = (localStorage.getItem('selectedCategoryTitle') || '').trim();

    if (savedId) this.selectedCategoryId = savedId;
    if (savedTitle) this.selectedCategoryTitle = savedTitle;
  }

  /**
   * Рендер UI upload-зоны
   */
  render() {
    const html = `
      <p class="upload-zone__text">
        Перетащите файл .pdf<br>или загрузите его с компьютера
      </p>

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

    this.rootEl.innerHTML = html;

    this.text = this.rootEl.querySelector('.upload-zone__text');
    this.button = this.rootEl.querySelector('#uploadBtn');
    this.fileInput = this.rootEl.querySelector('#fileInput');

    this.processingButton = document.querySelector('#processing-btn');
    this.processingButton.classList.add('form__group--hidden');

    this.init();
  }


  init() {
    const canPickFile = () => {
      const normalize = (s) =>
        (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

      const currentTitle = this.#getCurrentSelectTitle();
      const PLACEHOLDER = 'выберите категорию';

      return normalize(currentTitle) && normalize(currentTitle) !== normalize(PLACEHOLDER);
    };

    this.button.addEventListener('click', () => {
      if (!canPickFile()) {
        alert('Сначала выберите тип документа');
        return;
      }
      this.fileInput.click();
    });

    this.rootEl.addEventListener('dragover', (e) => {
      if (!canPickFile()) return; // не даём даже “дроп-зону”
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

  async #sendFile(file) {
  try {
    this.text.innerHTML = '⏳ Отправка файла...';
    this.button.disabled = true;

    // 1) Берём текущее значение селекта из DOM (истина)
    const currentTitle = this.#getCurrentSelectTitle();

    // placeholder должен совпадать с CustomSelect
    const PLACEHOLDER = 'выберите категорию';

    // 2) Если в UI placeholder - значит реально НЕ выбрано
    if (!currentTitle || currentTitle === PLACEHOLDER) {
      // сбросим старое, чтобы больше не подтягивалось "из прошлого"
      localStorage.removeItem('selectedCategoryId');
      localStorage.removeItem('selectedCategoryTitle');
      this.selectedCategoryId = null;
      this.selectedCategoryTitle = null;

      throw new Error('Сначала выберите тип документа');
    }

    // 3) Если UI не placeholder — синхроним состояние
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
  /**
   *
   * POST /upload
   *
   */
   async #uploadToServer(file, typeTitle) {
    const formData = new FormData();
    formData.append('type_id', typeTitle);
    formData.append('file', file);

    // Логи для бэкенда
    console.log('[UPLOAD] url:', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD}`);
    console.log('[UPLOAD] type_id:', typeTitle);
    console.log('[UPLOAD] file:', { name: file.name, size: file.size, type: file.type });

    // Важно: так можно увидеть реальные пары form-data
    for (const [k, v] of formData.entries()) {
      if (v instanceof File) {
        console.log(`[UPLOAD] formData ${k}: File(name=${v.name}, size=${v.size}, type=${v.type})`);
      } else {
        console.log(`[UPLOAD] formData ${k}:`, v);
      }
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD}`, {
      method: 'POST',
      body: formData,
    });

    const text = await response.text().catch(() => '');

    console.log('[UPLOAD] status:', response.status);
    console.log('[UPLOAD] response headers:', Object.fromEntries(response.headers.entries()));
    console.log('[UPLOAD] response text:', text);

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    // если это json
    return text ? JSON.parse(text) : {};
  }


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
