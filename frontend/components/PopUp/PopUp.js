import { ROOT_ACTIONBAR } from '../../constants/root.js';
import { previousStep, nextStep } from '../../utils/stepManager.js';
import { API_CONFIG } from '../../constants/api.js';

export class PopUp {

  render() {

    const fileName =
      localStorage.getItem('uploadedFile').length > 30
        ? localStorage.getItem('uploadedFile').slice(0, 20) + '...'
        : localStorage.getItem('uploadedFile');


    const html = `
      <div class="popup__overlay">
        <div class="popup__window">
          <h2 class="popup__title">Обработка документа</h2>

          <div class="popup__file">
            <img src="./data/images/pdf.svg" alt="PDF" width="20" height="20">
            <span class="popup__filename">${fileName}</span>
          </div>

          <div class="popup__loader">
            <div class="line-loader"></div>
          </div>

          <button class="popup__cancel">Отмена</button>
        </div>
      </div>
    `;

    ROOT_ACTIONBAR.insertAdjacentHTML('beforeend', html);


    const cancelButton = document.querySelector('.popup__cancel');

    cancelButton.addEventListener('click', () => {
      previousStep();
      document.querySelector('.popup__overlay').remove();
      document.querySelector('.data-selection__header').classList.add('hidden');
    });

    const uploadId = localStorage.getItem('upload_id');

    this.#runProcess(uploadId);
  }

  async #runProcess(uploadId) {
    try {
      const result = await startProcessReal(uploadId);

      document.querySelector('.popup__title').textContent = 'Готово';

      setTimeout(async () => {
        document.querySelector('.popup__overlay')?.remove();

        nextStep();

        document
          .querySelector('.data-selection__header')
          ?.classList.remove('hidden');

        const { actionbarElement } = await import(
          '../Actionbar/Actionbar.js'
        );

        actionbarElement.updateToDataSelectionUI(result);
      }, 400);

    } catch (err) {
      console.error(err);

      document.querySelector('.popup__title').textContent = 'Ошибка обработки';
      alert(err.message);
    }
  }


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


  static close() {
    document.getElementById('extractPopup')?.remove();
  }
}

async function startProcessReal(uploadId) {
  console.log('⚙️ PROCESS STARTED', uploadId);

  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROCESS_STATUS}?task_id=${encodeURIComponent(uploadId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const t = await response.text().catch(() => '');
    throw new Error(`Process failed: ${response.status} ${t}`);
  }

  const data = await response.json();

  const normalized = {
    ...data,
    pages: (data.pages || []).map((p) => ({
      page: p.page,
      image_url: p.image_url || p.url, // бэк отдаёт url
    })),
  };

  localStorage.setItem('processTask', JSON.stringify(normalized));
  localStorage.setItem('task_id', normalized.task_id);

  console.log('[PROCESS] raw response:', data);
  console.log('[PROCESS] keys:', Object.keys(data || {}));
  console.log('[PROCESS] pages:', data?.pages);
  console.log('[PROCESS] fields:', data?.fields);


  return normalized;
}

