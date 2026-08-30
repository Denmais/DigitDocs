import { ROOT_ACTIONBAR } from '../../constants/root.js';
import { CustomSelect } from '../Select/Select.js';
import { UploadButton } from '../UploadButton/UploadButton.js';
import { PopUp } from '../PopUp/PopUp.js';
import { nextStep } from '../../utils/stepManager.js';
import { CustomInput } from '../Input/Input.js';
import { viewerState } from '../../services/viewerState.js';
import { startCrop } from '../../utils/cropManager.js';
import { enableCropMode, disableCropMode } from '../PdfCrop/PdfCrop.js';
import { collectFieldsFromForm } from '../../utils/collectFields.js';
import { renderResultTable } from '../ResultTable/ResultTable.js';
import { showCropTourOnce } from '../../utils/showCropTour.js';

class Actionbar {
  constructor() {
    document.addEventListener('fieldCropStart', (e) => {
      this.#handleFieldCrop(e.detail);
    });
  }

  // Первый экран: тип документа, загрузка и выбор режима.
  render() {
    ROOT_ACTIONBAR.innerHTML = `
      <form class="form">
        <div class="form__group">
          <label for="doc-type" class="form__label">Выберите тип документа:</label>
          <div class="custom-select" id="doc-type"></div>
        </div>

        <div class="form__group">
          <label class="form__label">
            Загрузите файл чека в формате <span class="form__label--accent">PDF</span>
          </label>
          <div class="upload-zone" id="uploadZone"></div>
        </div>

        <div class="form__group form__group--hidden" id="processing-btn">
          <button class="accent__btn" type="button" id="manualProcessBtn">
            <img class="accent__btn--img" src="../../data/images/processing.svg" />
            Начать ручную обработку
          </button>

          <button class="accent__btn accent__btn--outline" type="button" id="autoProcessBtn">
            <img class="accent__btn--img" src="../../data/images/processing.svg" />
            Начать автоматическую обработку
          </button>
        </div>
      </form>
    `;

    this.renderSelect();

    const uploadBtn = new UploadButton({ rootId: 'uploadZone' });
    uploadBtn.render();

    const popup = new PopUp();

    document.querySelector('#manualProcessBtn').addEventListener('click', (e) => {
      e.preventDefault();
      nextStep();
      popup.render('manual');
    });

    document.querySelector('#autoProcessBtn').addEventListener('click', (e) => {
      e.preventDefault();
      nextStep();
      popup.render('auto');
    });
  }

  // Загружает типы документов и рисует select.
  async renderSelect() {
    const response = await fetch('/api/document-types');

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Не удалось получить типы документов: ${response.status} ${text}`);
    }

    const types = await response.json();
    const data = types.map((item) => ({ id: item.id, title: item.title }));

    const select = new CustomSelect({
      rootId: 'doc-type',
      data,
      placeholder: 'Выберите категорию',
      defaultId: null,
    });

    select.render();

    document.getElementById('doc-type').addEventListener('selectChange', (e) => {
      localStorage.setItem('selectedCategoryTitle', (e.detail.title || '').trim());
      localStorage.setItem('selectedCategoryId', String(e.detail.id || '').trim());
    });
  }

  // Включает выбор области для нужного поля.
  async #handleFieldCrop({ fieldId }) {
    const { cancelCrop, cropState } = await import('../../utils/cropManager.js');

    cancelCrop();
    startCrop(fieldId);
    cropState.page = viewerState.pageIndex;
    enableCropMode();
  }

  // Ручной режим: поля слева, документ справа.
  updateToDataSelectionUI(processData) {
    ROOT_ACTIONBAR.classList.remove('actions');
    localStorage.setItem('processResult', JSON.stringify(processData));

    viewerState.pages = processData.pages;
    viewerState.pageIndex = 0;
    viewerState.zoom = 1;

    ROOT_ACTIONBAR.innerHTML = `
      <div class="data-selection">
        <div class="data-selection__layout">
          <div class="data-selection__form">
            <div class="tariffs-block" id="categories"></div>
            <button class="accent__btn data-selection__submit" type="button">
              Сформировать таблицу
            </button>
          </div>

          <div class="data-selection__viewer">
            <div class="viewer__main">
              <div class="viewer__controls">
                <button data-zoom="out">−</button>
                <span class="viewer__zoom">100%</span>
                <button data-zoom="in">+</button>
                <p>|</p>
                <button class="viewer__reset" title="Сброс масштаба">⤾</button>
              </div>

              <div class="viewer__canvas">
                <div class="viewer__page-wrapper">
                  <img class="viewer__page" />
                </div>
              </div>
            </div>

            <div class="viewer__sidebar">
              ${processData.pages.map((page, index) => `
                <div class="viewer__thumb" data-index="${index}">
                  <img src="${page.image_url}">
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.#renderTariffSelects(processData.fields);
    showCropTourOnce();

    document.addEventListener('cropSelected', async (e) => {
      const { fieldId, page, crop } = e.detail;

      console.log('[CROP]', {
        fieldId,
        page,
        zoom: viewerState.zoom,
        crop,
      });

      PopUp.showProcessing();

      try {
        const processResult = JSON.parse(localStorage.getItem('processResult'));

        const response = await fetch('/api/extract-field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: processResult.task_id,
            field_id: fieldId,
            page,
            crop,
          }),
        });

        const text = await response.text();
        let result = null;

        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(`Backend вернул не JSON: ${text}`);
        }

        if (!response.ok) {
          const detail = result?.detail || result?.error || text;
          throw new Error(`extract-field: ${response.status} ${detail}`);
        }

        console.log('[extract-field] response:', result);

        const input = document.getElementById(fieldId);
        if (input) {
          const raw = result.value ?? result.field?.value ?? '';
          input.value = sanitizeForInput(raw, input.type);
          input.classList.add('filled');
        }
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : String(err));
      } finally {
        PopUp.close();
      }
    });

    const submitBtn = document.querySelector('.data-selection__submit');

    submitBtn.addEventListener('click', async () => {
      const fields = collectFieldsFromForm();

      if (!fields.length) {
        alert('Заполните данные');
        return;
      }

      PopUp.showProcessing('Формирование результата...');

      try {
        const processResult = JSON.parse(localStorage.getItem('processResult'));

        const response = await fetch('/api/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: processResult.task_id,
            fields,
          }),
        });

        const text = await response.text();
        let result = {};

        if (text) {
          try {
            result = JSON.parse(text);
          } catch {
            throw new Error(`Backend вернул не JSON: ${text}`);
          }
        }

        if (!response.ok) {
          throw new Error(
            result?.detail || result?.error || text || 'Ошибка формирования результата'
          );
        }

        console.log('=== /api/collect response ===', result);
        this.showResultTable(result);
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : String(err));
      } finally {
        PopUp.close();
      }
    });

    this.#initViewer();
  }

  // Рисует поля из Mongo-формы.
  async #renderTariffSelects(fields) {
    const input = new CustomInput({
      rootId: 'categories',
      data: fields,
      placeholder: 'Выберите фрагмент',
    });

    input.render();
  }

  // Переключение страниц и масштаб документа.
  #initViewer() {
    const canvas = document.querySelector('.viewer__canvas');
    const mainImg = document.querySelector('.viewer__page');
    const zoomLabel = document.querySelector('.viewer__zoom');
    const wrapper = document.querySelector('.viewer__page-wrapper');

    if (!canvas || !mainImg || !zoomLabel || !wrapper) return;

    viewerState.zoom = 1;
    viewerState.baseScale = 1;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const applyOverflow = () => {
      canvas.style.overflow = viewerState.zoom > 1 ? 'auto' : 'hidden';

      if (viewerState.zoom <= 1) {
        canvas.scrollTop = 0;
        canvas.scrollLeft = 0;
      }
    };

    const applyTransform = () => {
      const scale = viewerState.baseScale * viewerState.zoom;
      wrapper.style.transform = `scale(${scale})`;
      zoomLabel.textContent = Math.round(viewerState.zoom * 100) + '%';
      applyOverflow();
    };

    const recalcBaseScaleFitHeight = () => {
      const canvasHeight = canvas.clientHeight || 1;
      const imageHeight = mainImg.naturalHeight || 1;
      viewerState.baseScale = canvasHeight / imageHeight;
    };

    const renderPage = () => {
      const page = viewerState.pages[viewerState.pageIndex];
      if (!page) return;

      mainImg.onload = () => {
        recalcBaseScaleFitHeight();
        applyTransform();
      };

      mainImg.src = page.image_url;
    };

    const resetView = () => {
      viewerState.zoom = 1;
      applyTransform();
    };

    renderPage();

    const thumbs = document.querySelectorAll('.viewer__thumb');
    if (thumbs.length > 0) thumbs[0].classList.add('active');

    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', async () => {
        const { cancelCrop } = await import('../../utils/cropManager.js');

        disableCropMode();
        cancelCrop();

        viewerState.pageIndex = Number(thumb.dataset.index);

        thumbs.forEach((item) => item.classList.remove('active'));
        thumb.classList.add('active');

        viewerState.zoom = 1;
        renderPage();
      });
    });

    document.querySelector('[data-zoom="in"]').onclick = () => {
      viewerState.zoom = clamp(
        viewerState.zoom + 0.1,
        viewerState.minZoom || 0.2,
        viewerState.maxZoom || 5
      );
      applyTransform();
    };

    document.querySelector('[data-zoom="out"]').onclick = () => {
      viewerState.zoom = clamp(
        viewerState.zoom - 0.1,
        viewerState.minZoom || 0.2,
        viewerState.maxZoom || 5
      );
      applyTransform();
    };

    document.querySelector('.viewer__reset').onclick = resetView;

    canvas.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;

      e.preventDefault();

      const prevZoom = viewerState.zoom;
      const prevScale = viewerState.baseScale * prevZoom;

      const nextZoom = clamp(
        e.deltaY < 0 ? prevZoom + 0.1 : prevZoom - 0.1,
        viewerState.minZoom || 0.2,
        viewerState.maxZoom || 5
      );

      if (nextZoom === prevZoom) return;

      viewerState.zoom = nextZoom;

      const rect = canvas.getBoundingClientRect();
      const offsetX = (e.clientX - rect.left + canvas.scrollLeft) / prevScale;
      const offsetY = (e.clientY - rect.top + canvas.scrollTop) / prevScale;

      applyTransform();

      const newScale = viewerState.baseScale * viewerState.zoom;
      canvas.scrollLeft = offsetX * newScale - (e.clientX - rect.left);
      canvas.scrollTop = offsetY * newScale - (e.clientY - rect.top);
    }, { passive: false });

    window.addEventListener('resize', () => {
      recalcBaseScaleFitHeight();
      applyTransform();
    });
  }

  // Показывает итоговую таблицу.
  showResultTable(result) {
    nextStep();
    ROOT_ACTIONBAR.innerHTML = '<div class="result-wrapper"></div>';

    const wrapper = document.querySelector('.result-wrapper');
    renderResultTable(wrapper, result);
  }
}

// Приводит OCR-значение к формату input.
function sanitizeForInput(value, inputType) {
  if (value == null) return '';

  let result = String(value).trim();
  if (inputType !== 'number') return result;

  result = result.replace(/[^\d.,\s-]/g, '');
  result = result.replace(/\s+/g, '');

  if (result.includes(',') && !result.includes('.')) {
    result = result.replace(',', '.');
  }

  result = result.replace(/(?!^)-/g, '');

  const firstDot = result.indexOf('.');
  if (firstDot !== -1) {
    result = result.slice(0, firstDot + 1) + result.slice(firstDot + 1).replace(/\./g, '');
  }

  if (result.startsWith('.')) result = '0' + result;
  if (result.startsWith('-.')) result = result.replace('-.', '-0.');

  result = result.replace(/\.$/, '');

  if (!/^[-]?\d+(\.\d+)?$/.test(result)) return '';
  return result;
}

export const actionbarElement = new Actionbar();
actionbarElement.render();