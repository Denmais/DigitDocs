
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

    document.addEventListener('fieldCropStart', (e) =>
      this.#handleFieldCrop(e.detail)
    );
  }


  render() {
    document.body.classList.remove('page-history');
    
    const html = `
        <form class="form">
            <div class="form__group">
                <label for="doc-type" class="form__label">Выберите тип документа:</label>
                <div class="custom-select" id="doc-type"></div>
            </div>
            <div class="form__group">
                <label class="form__label">Загрузите файл чека в формате <span class="form__label--accent">PDF</span></label>
                <div class="upload-zone" id="uploadZone"></div>
            </div>
            <div class="form__group form__group--hidden" id="processing-btn">
                <button class="accent__btn" type="button" id="processBtn">
                    <img class="accent__btn--img" src="../../data/images/processing.svg" />
                    Начать обработку
                </button>
            </div>
        </form>
    `;

    ROOT_ACTIONBAR.innerHTML = html;

    this.renderSelect();

    const uploadBtn = new UploadButton({ rootId: 'uploadZone' });
    uploadBtn.render();

    const popup = new PopUp();
    const popupButton = document.querySelector('#processBtn');
    popupButton.addEventListener('click', (e) => {
      nextStep(); 
      e.preventDefault();
      popup.render();
    });
  }


  async renderSelect() {
    const res = await fetch('/api/document-types');
    const types = await res.json();

    const data = types.map(t => ({
      id: t.id,
      title: t.title,
    }));

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



  async #handleFieldCrop({ fieldId }) {
    const { cancelCrop } = await import('../../utils/cropManager.js');
    cancelCrop();

    startCrop(fieldId);

    const { cropState } = await import('../../utils/cropManager.js');
    cropState.page = viewerState.pageIndex;

    enableCropMode();
  }




  updateToDataSelectionUI(processData) {
    ROOT_ACTIONBAR.classList.remove('actions');
    localStorage.setItem('processResult', JSON.stringify(processData));

    viewerState.pages = processData.pages;
    viewerState.pageIndex = 0;
    viewerState.zoom = 1;


    const newHtml = `
      <div class="data-selection">
        <div class="data-selection__layout">

          <div class="data-selection__form">
            <div class="tariffs-block" id="categories"></div>
            <button class="accent__btn data-selection__submit">
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
                <button class="viewer__reset" title="Сброс масштаба">
                  ⤾
                </button>
              </div>

              <div class="viewer__canvas">
                <div class="viewer__page-wrapper">
                  <img class="viewer__page" />
                </div>
              </div>
            </div>

            <div class="viewer__sidebar">
              ${processData.pages.map(
                (p, i) => `
                  <div class="viewer__thumb" data-index="${i}">
                    <img src="${p.image_url}">
                  </div>
                `
              ).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    ROOT_ACTIONBAR.innerHTML = newHtml;

    this.#renderTariffSelects(processData.fields);

    this.#renderTariffSelects(processData.fields);
    showCropTourOnce();


    document.addEventListener('cropSelected', async (e) => {
      const { fieldId, page, crop } = e.detail;

      console.log('[CROP]', {
        page,
        zoom: viewerState.zoom,
        crop,
        img: {
          naturalW: document.querySelector('.viewer__page')?.naturalWidth,
          naturalH: document.querySelector('.viewer__page')?.naturalHeight,
        }
      });


      PopUp.showProcessing();

      const r = await fetch('/api/extract-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: JSON.parse(localStorage.getItem('processResult')).task_id,
          field_id: fieldId,
          page,
          crop,
        }),
      });

      let res;
      const text = await r.text();
      try {
        res = JSON.parse(text);
      } catch (e) {
        console.error('[extract-field] not JSON:', text);
        throw e;
      }

      if (!r.ok) {
        console.error('[extract-field] HTTP error', r.status, res);
        alert(`extract-field error: ${r.status}`);
        return;
      }

      console.log('[extract-field] response:', res);

      PopUp.close();

      function sanitizeForInput(value, inputType) {
        if (value == null) return '';
        let v = String(value).trim();

        if (inputType === 'number') {
          v = v.replace(/[^\d.,\s-]/g, '');
          v = v.replace(/\s+/g, '');
          if (v.includes(',') && !v.includes('.')) v = v.replace(',', '.');

          v = v.replace(/(?!^)-/g, '');

          const firstDot = v.indexOf('.');
          if (firstDot !== -1) {
            v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
          }
          if (v.startsWith('.')) v = '0' + v;
          if (v.startsWith('-.')) v = v.replace('-.', '-0.');

          v = v.replace(/\.$/, '');

          if (!/^[-]?\d+(\.\d+)?$/.test(v)) return '';
        }

        return v;
      }

      const input = document.getElementById(fieldId);
      if (input) {
        const raw = res.value ?? res.field?.value ?? '';
        input.value = sanitizeForInput(raw, input.type);
        input.classList.add('filled');
      }
    });


    const submitBtn = document.querySelector('.data-selection__submit');

    submitBtn.addEventListener('click', async () => {
      const fields = collectFieldsFromForm();

      if (!fields.length) {
        alert('Заполните данные');
        return;
      }

      PopUp.showProcessing();

      const res = await fetch('/api/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: JSON.parse(localStorage.getItem('processResult')).task_id,
          fields,
        }),
      }).then(r => r.json());

      console.log('=== /api/collect response ===', res);

      PopUp.close();
      this.#showResultTable(res);
    });

    this.#initViewer();
  }


  async #renderTariffSelects(fields) {
    const input = new CustomInput({
      rootId: 'categories',
      data: fields,
      placeholder: 'Выберите фрагмент',
    });

    input.render();
  }


  #initViewer() {
    const canvas = document.querySelector('.viewer__canvas');
    const mainImg = document.querySelector('.viewer__page');
    const zoomLabel = document.querySelector('.viewer__zoom');
    const wrapper = document.querySelector('.viewer__page-wrapper');

    if (!canvas || !mainImg || !zoomLabel || !wrapper) return;

    // --- state ---
    viewerState.zoom = 1;
    viewerState.baseScale = 1;

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

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
      const canvasH = canvas.clientHeight || 1;
      const imgH = mainImg.naturalHeight || 1;
      viewerState.baseScale = canvasH / imgH;
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

    document.querySelectorAll('.viewer__thumb').forEach((thumb) => {
      thumb.addEventListener('click', async () => {
        const { cancelCrop } = await import('../../utils/cropManager.js');
        disableCropMode();
        cancelCrop();
        viewerState.pageIndex = Number(thumb.dataset.index);

        document.querySelectorAll('.viewer__thumb')
          .forEach((t) => t.classList.remove('active'));
        thumb.classList.add('active');

        viewerState.zoom = 1;
        renderPage();
      });
    });

    document.querySelector('[data-zoom="in"]').onclick = () => {
      viewerState.zoom = clamp(viewerState.zoom + 0.1, viewerState.minZoom || 0.2, viewerState.maxZoom || 5);
      applyTransform();
    };

    document.querySelector('[data-zoom="out"]').onclick = () => {
      viewerState.zoom = clamp(viewerState.zoom - 0.1, viewerState.minZoom || 0.2, viewerState.maxZoom || 5);
      applyTransform();
    };

    document.querySelector('.viewer__reset').onclick = resetView;

    canvas.addEventListener(
      'wheel',
      (e) => {
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
        canvas.scrollTop  = offsetY * newScale - (e.clientY - rect.top);
      },
      { passive: false }
    );

    window.addEventListener('resize', () => {
      recalcBaseScaleFitHeight();
      applyTransform();
    });
  }



  #showResultTable(result) {
    nextStep();

    ROOT_ACTIONBAR.innerHTML = `
      <div class="result-wrapper"></div>
    `;

    const wrapper = document.querySelector('.result-wrapper');
    renderResultTable(wrapper, result);
  }


  #downloadCSV(table) {
    const rows = [
      ['Параметр', 'Значение'],
      ...table.map(r => [r.label, r.display_value ?? r.value]),
    ];

    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'result.csv';
    link.click();
  }


  async #publishToBI(resultId) {
    PopUp.showProcessing();

    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result_id: resultId, target: 'bi' }),
    }).then(r => r.json());

    PopUp.close();

    if (res.url) window.open(res.url, '_blank');
  }
}

export const actionbarElement = new Actionbar();
actionbarElement.render();
