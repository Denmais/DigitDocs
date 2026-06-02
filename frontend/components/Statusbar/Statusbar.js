
import { ROOT_STATUSBAR } from '../../constants/root.js';
import { createStorageObserver } from '../../utils/storageObserver.js';

class Statusbar {
  constructor() {

    this.storageObserver = createStorageObserver();

    // Подписка на изменения данных
    this.initObserver();


    this.isHidden = true;
  }

  /**
   * Подписка на ключевые события localStorage
   *
   */
  initObserver() {
    this.storageObserver.on('uploadedFile', () => {
      this.render();
    });

    this.storageObserver.on('selectedCategory', () => {
      this.render();
    });
  }


  hide() {
    const header = document.querySelector('.data-selection__header');
    if (header) {
      this.isHidden = true;
      header.classList.add('hidden');
    }
  }

  /**
   * Показывает информационную плашку
   */
  show() {
    const header = document.querySelector('.data-selection__header');
    if (header) {
      this.isHidden = false;
      header.classList.remove('hidden');
    }
  }


  render() {
    /**
     * Метаданные документа
     *
     */
    const fileName =
      localStorage.getItem('uploadedFile') || 'Ваш документ';

    const category =
      localStorage.getItem('selectedCategoryTitle') || 'Не выбрана';

    const hiddenClass = this.isHidden ? 'hidden' : '';

 
    const activeStep =
      Number(localStorage.getItem('activeStep')) || 1;

    /**
     * Функция:
     * шаг считается активным, если он <= текущего
     * (все выполненные шаги подсвечены)
     */
    const isActive = (step) => step <= activeStep;


    const html = `
      <div class="data-selection__header ${hiddenClass}">
        <span class="data-selection__title">
          Загруженный файл: <strong>${fileName}</strong>
          <span>
            Категория: <strong>${category}</strong>
          </span>
        </span>
      </div>

      <ul class="statusbar__list statusbar--step-${activeStep}">
        <li class="statusbar__item ${isActive(1) ? 'statusbar__item--active' : ''}">
          <span class="statusbar__label">Тип документа</span>
        </li>

        <li class="statusbar__item ${isActive(2) ? 'statusbar__item--active' : ''}">
          <span class="statusbar__label">Загрузка документа</span>
        </li>

        <li class="statusbar__item ${isActive(3) ? 'statusbar__item--active' : ''}">
          <span class="statusbar__label">Обработка документа</span>
        </li>

        <li class="statusbar__item ${isActive(4) ? 'statusbar__item--active' : ''}">
          <span class="statusbar__label">Выбор данных</span>
        </li>

        <li class="statusbar__item ${isActive(5) ? 'statusbar__item--active' : ''}">
          <span class="statusbar__label">Результат</span>
        </li>
      </ul>
    `;

    ROOT_STATUSBAR.innerHTML = html;
  }
}


const statusbarElement = new Statusbar();
statusbarElement.render();

export { Statusbar, statusbarElement };
