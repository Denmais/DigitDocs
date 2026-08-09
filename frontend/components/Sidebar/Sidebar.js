import { ROOT_SIDEBAR } from '../../constants/root.js';

class Sidebar {
  constructor() {
    this.classNameActive = 'sidebar--close';

    ROOT_SIDEBAR.addEventListener('mouseover', () => {
      ROOT_SIDEBAR.classList.remove(this.classNameActive);
    });

    ROOT_SIDEBAR.addEventListener('mouseleave', () => {
      ROOT_SIDEBAR.classList.add(this.classNameActive);
    });
  }

  // Рисует боковое меню.
  render() {
    ROOT_SIDEBAR.innerHTML = `
      <div class="navbar__header">
        <div class="navbar__logo">
          <img src="./data/images/logo.svg" alt="ReceiptApp Logo" class="navbar__logo-img">
        </div>

        <ul class="navbar__list">
          <li class="navbar__item navbar__item--active">
            <a href="/" class="navbar__link">
              <img
                class="navbar__link--img"
                src="./data/images/data-processing.svg"
                alt="Новая обработка"
              >
              <span class="navbar__link--label">Новая обработка</span>
            </a>
          </li>
        </ul>
      </div>

      <div class="navbar__bottom">
        <button class="theme-toggle" id="themeToggle" title="Переключить тему">
          <img
            src="./data/images/moon.svg"
            alt="theme"
            id="themeIcon"
            width="24"
            height="24"
          >
        </button>

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
    `;

    this.#initThemeToggle();
  }

  // Переключает светлую и тёмную тему.
  #initThemeToggle() {
    const toggleButton = document.getElementById('themeToggle');
    const icon = document.getElementById('themeIcon');
    const savedTheme = localStorage.getItem('theme') || 'light';

    document.documentElement.setAttribute('data-theme', savedTheme);
    icon.src = savedTheme === 'dark'
      ? './data/images/sun.svg'
      : './data/images/moon.svg';

    toggleButton.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';

      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);

      icon.src = next === 'dark'
        ? './data/images/sun.svg'
        : './data/images/moon.svg';
    });
  }
}

const sidebarElement = new Sidebar();
sidebarElement.render();

export { Sidebar, sidebarElement };