import { ROOT_ACTIONBAR } from '../../constants/root.js';
import { previousStep, nextStep } from '../../utils/stepManager.js';
import { API_CONFIG } from '../../constants/api.js';

export class PopUp {
  // Показывает окно обработки.
  render(mode = 'manual') {
    const uploadedFile = localStorage.getItem('uploadedFile') || 'Документ.pdf';
    const fileName = uploadedFile.length > 30
      ? uploadedFile.slice(0, 20) + '...'
      : uploadedFile;

    const title = mode === 'auto'
      ? 'Автоматическая обработка документа'
      : 'Ручная обработка документа';

    const html = `
      <div class="popup__overlay">
        <div class="popup__window">
          <h2 class="popup__title">${title}</h2>

          <div class="popup__file">
            <img src="./data/images/pdf.svg" alt="PDF" width="20" height="20">
            <span class="popup__filename">${fileName}</span>
          </div>

          <div class="popup__loader">
            <div class="line-loader"></div>
          </div>

          <div
            class="popup__error"
            id="processError"
            style="display:none; white-space:pre-wrap; max-height:260px; overflow:auto;"
          ></div>

          <button class="popup__cancel">Отмена</button>
        </div>
      </div>
    `;

    ROOT_ACTIONBAR.insertAdjacentHTML('beforeend', html);

    const cancelButton = document.querySelector('.popup__cancel');
    cancelButton.addEventListener('click', () => {
      previousStep();
      document.querySelector('.popup__overlay')?.remove();
      document.querySelector('.data-selection__header')?.classList.add('hidden');
    });

    const uploadId = localStorage.getItem('upload_id');
    this.#runProcess(uploadId, mode);
  }

  // Выбирает ручной или автоматический режим.
  async #runProcess(uploadId, mode) {
    try {
      if (!uploadId) {
        throw new Error('upload_id не найден. Загрузите документ заново.');
      }

      if (mode === 'auto') {
        await this.#runAutoProcess(uploadId);
        return;
      }

      await this.#runManualProcess(uploadId);
    } catch (err) {
      console.error(err);
      this.#showError(err instanceof Error ? err.message : String(err));
    }
  }

  // Запускает ручной режим.
  async #runManualProcess(uploadId) {
    const result = await startManualProcess(uploadId);

    const title = document.querySelector('.popup__title');
    if (title) title.textContent = 'Готово';

    document.querySelector('.popup__overlay')?.remove();

    // После обработки переходим к ручному выбору полей.
    nextStep();
    document.querySelector('.data-selection__header')?.classList.remove('hidden');

    const { actionbarElement } = await import('../Actionbar/Actionbar.js');
    actionbarElement.updateToDataSelectionUI(result);
  }

  // Запускает автоматический OCR.
  async #runAutoProcess(uploadId) {
    const autoResult = await startAutoProcess(uploadId);

    localStorage.setItem('autoProcessResult', JSON.stringify(autoResult));

    if (!autoResult.pages_processed) {
      throw new Error(buildAutoProblemMessage(autoResult));
    }

    const result = await collectResult(uploadId);

    // В результат попадают только успешно обработанные страницы.
    const processedPages = new Set(
      (autoResult.pages || [])
        .filter((page) => page.status === 'processed')
        .map((page) => page.page)
    );

    result.table = (result.table || []).filter(
      (row) => row.page == null || processedPages.has(row.page)
    );

    const hasProblems =
      autoResult.pages_validation_failed > 0 ||
      autoResult.pages_processing_failed > 0;

    const title = document.querySelector('.popup__title');
    if (title) {
      title.textContent = hasProblems ? 'Готово с замечаниями' : 'Готово';
    }

    document.querySelector('.popup__overlay')?.remove();

    // nextStep здесь не нужен: showResultTable делает его сам.
    const { actionbarElement } = await import('../Actionbar/Actionbar.js');
    actionbarElement.showResultTable(result);

    if (hasProblems) {
      const warning = buildAutoProblemMessage(autoResult);
      setTimeout(() => alert(warning), 0);
    }
  }

  // Показывает ошибку внутри popup.
  #showError(message) {
    const title = document.querySelector('.popup__title');
    const loader = document.querySelector('.popup__loader');
    const errorBox = document.getElementById('processError');
    const cancelButton = document.querySelector('.popup__cancel');

    if (title) title.textContent = 'Ошибка обработки';
    if (loader) loader.style.display = 'none';

    if (errorBox) {
      errorBox.textContent = message;
      errorBox.style.display = 'block';
    }

    if (cancelButton) cancelButton.textContent = 'Закрыть';
  }

  // Показывает маленькое окно во время OCR.
  static showProcessing(text = 'Обработка фрагмента...') {
    const html = `
      <div class="popup__overlay" id="extractPopup">
        <div class="popup__window">
          <h3>${text}</h3>
          <div class="popup__progress">
            <div class="popup__progress-bar" style="width: 100%"></div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  // Закрывает окно OCR.
  static close() {
    document.getElementById('extractPopup')?.remove();
  }
}

// Запускает ручную обработку.
async function startManualProcess(uploadId) {
  console.log('[PROCESS MANUAL] started', uploadId);

  const endpoint = API_CONFIG?.ENDPOINTS?.PROCESS_STATUS || '/api/process/status';
  const url = `${API_CONFIG.BASE_URL}${endpoint}?task_id=${encodeURIComponent(uploadId)}`;

  const response = await fetch(url);
  const data = await readResponse(response, 'Ручная обработка');

  const normalized = {
    ...data,
    pages: (data.pages || []).map((page) => ({
      page: page.page,
      image_url: page.image_url || page.url,
    })),
  };

  localStorage.setItem('processTask', JSON.stringify(normalized));
  localStorage.setItem('task_id', normalized.task_id);

  return normalized;
}

// Запускает автоматический OCR.
async function startAutoProcess(uploadId) {
  console.log('[PROCESS AUTO] started', uploadId);

  const endpoint = API_CONFIG?.ENDPOINTS?.AUTO_PROCESS || '/api/process/auto';
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: uploadId }),
  });

  const data = await readResponse(response, 'Автоматическая обработка');
  localStorage.setItem('task_id', data.task_id || uploadId);

  return data;
}

// Собирает данные после автоматической обработки.
async function collectResult(uploadId) {
  const endpoint = API_CONFIG?.ENDPOINTS?.COLLECT || '/api/collect';
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: uploadId }),
  });

  return readResponse(response, 'Формирование результата');
}

// Читает JSON и превращает HTTP-ошибку в Error.
async function readResponse(response, operation) {
  const text = await response.text().catch(() => '');
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const detail = data?.detail || data?.error || text || 'Неизвестная ошибка';
    throw new Error(`${operation}: ${detail}`);
  }

  return data || {};
}

// Собирает сообщение по страницам, которые не обработались автоматически.
function buildAutoProblemMessage(result) {
  const issues = (result.pages || []).filter((page) => page.status !== 'processed');
  const lines = [
    `Обработано страниц: ${result.pages_processed || 0} из ${result.pages_total || 0}.`,
  ];

  for (const page of issues.slice(0, 10)) {
    const pageNumber = Number(page.page) + 1;

    if (page.status === 'validation_failed') {
      lines.push(`Страница ${pageNumber}: документ не прошёл проверку шаблона.`);

      for (const check of page.validation || []) {
        if (check.valid) continue;

        const score = Math.round((Number(check.score) || 0) * 100);
        lines.push(
          `  ${check.id || 'validation'}: ожидалось «${check.expected || ''}», ` +
          `распознано «${check.recognized || ''}» (${score}%).`
        );
      }

      continue;
    }

    if (page.status === 'processing_failed') {
      lines.push(
        `Страница ${pageNumber}: ошибка обработки — ${page.error || 'причина не указана'}.`
      );
    }
  }

  if (issues.length > 10) {
    lines.push(`И ещё проблемных страниц: ${issues.length - 10}.`);
  }

  return lines.join('\n');
}