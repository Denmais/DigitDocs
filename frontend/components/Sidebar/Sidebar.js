
import { ROOT_SIDEBAR } from '../../constants/root.js';
import { HistoryPage } from '../HistoryPage/HistoryPage.js';

class Sidebar {
  constructor() {

    this.classNameActive = 'sidebar--close';

    /**
     * Открытие сайдбара при наведении курсора
     *
     */
    ROOT_SIDEBAR.addEventListener('mouseover', () => {
      ROOT_SIDEBAR.classList.remove(this.classNameActive);
    });

    /**
     * Закрытие сайдбара при уходе курсора
     */
    ROOT_SIDEBAR.addEventListener('mouseleave', () => {
      ROOT_SIDEBAR.classList.add(this.classNameActive);
    });
  }


  render() {
    const html = `
      <nav class="navbar">

          <!-- Верхняя часть сайдбара -->
          <div class="navbar__header">

              <!-- Логотип приложения -->
              <div class="navbar__logo">
                  <img
                    src="./data/images/logo.svg"
                    alt="ReceiptApp Logo"
                    class="navbar__logo-img"
                  >
              </div>

              <!-- Основное меню -->
              <ul class="navbar__list">
                  <li class="navbar__item navbar__item--active">
                      <a href="/" class="navbar__link">
                          <img
                            class="navbar__link--img"
                            src="./data/images/data-processing.svg"
                            alt="Новая обработка чека"
                          >
                          <span class="navbar__link--label">
                            Новая обработка
                          </span>
                      </a>
                  </li>

                  <li class="navbar__item">
                      <a href="#!" class="navbar__link" id="navHistory">
                          <img
                            class="navbar__link--img"
                            src="./data/images/history.svg"
                            alt="История обработок чеков"
                          >
                          <span class="navbar__link--label">
                            История обработок
                          </span>
                      </a>
                  </li>
              </ul>
          </div>

          <!-- Нижняя часть сайдбара -->
          <div class="navbar__bottom">

              <!-- Переключатель темы -->
              <button
                class="theme-toggle"
                id="themeToggle"
                title="Переключить тему"
              >
                  <img
                    src="../../data/images/moon.svg"
                    alt="theme"
                    id="themeIcon"
                    width="24"
                    height="24"
                  >
              </button>

              <!-- Иконка профиля пользователя -->
              <div class="navbar__profile">
                  <a href="#!" class="navbar__profile-link">
                      <img
                        src="./data/images/profile.svg"
                        alt="User profile"
                        class="navbar__profile-img"
                      >
                  </a>
              </div>
          </div>
      </nav>
    `;

    // Вставляем сайдбар в DOM
    ROOT_SIDEBAR.innerHTML = html;

    // Инициализация логики темы
    this.#initThemeToggle();

    this.#initNavigation();
  }


  #initThemeToggle() {
    const toggleBtn = document.getElementById('themeToggle');
    const icon = document.getElementById('themeIcon');

    /**
     * Читаем сохранённую тему
     * (по умолчанию - light)
     */
    const savedTheme = localStorage.getItem('theme') || 'light';

    // Применяем тему к <html>
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Меняем иконку
    icon.src =
      savedTheme === 'dark'
        ? './data/images/sun.svg'
        : './data/images/moon.svg';

    /**
     * Обработчик клика по кнопке темы
     */
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';

      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);

      icon.src =
        next === 'dark'
          ? './data/images/sun.svg'
          : './data/images/moon.svg';
    });
  }

  #initNavigation() {
    const historyLink = document.getElementById('navHistory');

    historyLink.addEventListener('click', (e) => {
      e.preventDefault();

      // Убираем active у всех
      document.querySelectorAll('.navbar__item')
        .forEach(item => item.classList.remove('navbar__item--active'));

      // Ставим active текущему
      historyLink.closest('.navbar__item')
        .classList.add('navbar__item--active');

      // Рендерим страницу истории
      const page = new HistoryPage({ rootId: 'action-bar' });
      page.render();
    });
  }
}


const sidebarElement = new Sidebar();
sidebarElement.render();

export { Sidebar, sidebarElement };
