/**
 * Statusbar
 *
 * Компонент верхней панели шагов (stepper).
 *
 * Отвечает ТОЛЬКО за отображение:
 * - текущего шага
 * - выполненных шагов
 * - информации о загруженном файле и выбранной категории
 *
 * ❗ ВАЖНО для backend:
 * - Statusbar не управляет логикой шагов
 * - он лишь читает состояние из localStorage и DOM
 * - вся логика переходов реализована во frontend (stepManager.js)
 */

import { ROOT_STATUSBAR } from '../../constants/root.js';
import { createStorageObserver } from '../../utils/storageObserver.js';

class Statusbar {
  constructor() {
    /**
     * storageObserver - обёртка над localStorage.setItem
     *
     * Позволяет подписываться на изменения localStorage,
     * как на события (без Redux / framework)
     */
    this.storageObserver = createStorageObserver();

    // Подписка на изменения данных
    this.initObserver();

    /**
     * isHidden - состояние шапки с метаданными документа
     * (используется на этапе crop / выбора данных)
     */
    this.isHidden = true;
  }

  /**
   * Подписка на ключевые события localStorage
   *
   * Backend:
   * - uploadedFile приходит после успешной загрузки /upload
   * - selectedCategory - выбранный тип документа
   */
  initObserver() {
    this.storageObserver.on('uploadedFile', () => {
      this.render();
    });

    this.storageObserver.on('selectedCategory', () => {
      this.render();
    });
  }

  /**
   * Скрывает информационную плашку
   * (используется при выборе фрагментов PDF)
   */
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

  /**
   * Основной render Statusbar
   *
   * Здесь НЕТ логики шагов -
   * только чтение текущего состояния
   */
  render() {
    /**
     * Метаданные документа
     *
     * Backend:
     * - uploadedFile - имя файла, полученное от /upload
     * - selectedCategory - title категории (для UI)
     */
    const fileName =
      localStorage.getItem('uploadedFile') || 'Ваш документ';

    const category =
      localStorage.getItem('selectedCategoryTitle') || 'Не выбрана';

    const hiddenClass = this.isHidden ? 'hidden' : '';

    /**
     * activeStep
     *
     * Хранится в localStorage и CSS-переменной
     * Обновляется через utils/stepManager.js
     *
     * Backend:
     * - шаги не приходят с сервера
     * - это чисто UI-логика
     */
    const activeStep =
      Number(localStorage.getItem('activeStep')) || 1;

    /**
     * Функция:
     * шаг считается активным, если он <= текущего
     * (все выполненные шаги подсвечены)
     */
    const isActive = (step) => step <= activeStep;

    /**
     * HTML-разметка statusbar
     *
     * statusbar--step-X:
     * - CSS-хук для изменения отступов / анимаций
     * - например, margin-top для шагов 3–5
     */
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

    // Перерисовываем statusbar целиком
    ROOT_STATUSBAR.innerHTML = html;
  }
}

/**
 * Singleton-экземпляр statusbar
 *
 * Используется во всём приложении
 */
const statusbarElement = new Statusbar();
statusbarElement.render();

export { Statusbar, statusbarElement };
