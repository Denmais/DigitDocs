import { ROOT_ACTIONBAR } from '../../constants/root.js';
import { API_CONFIG } from '../../constants/api.js';

export class HistoryPage {
  constructor({ rootId }) {
    this.rootEl = document.getElementById(rootId);
    this.statusElem = document.getElementById('statusbar');
    this.isAllExpanded = false; // Состояние для глобальной кнопки
  }

  async render() {
    document.body.classList.add('page-history');
    
    if (this.statusElem) {
      const steps = this.statusElem.querySelector('.statusbar__list');
      const fileInfo = this.statusElem.querySelector('.data-selection__header');
      if (steps) steps.style.display = 'none';
      if (fileInfo) fileInfo.style.display = 'none';

      let historyHeader = this.statusElem.querySelector('.history__header');
      if (!historyHeader) {
        historyHeader = document.createElement('div');
        historyHeader.className = 'history__header';
        // Добавляем заголовок и кнопку управления всеми таблицами
        historyHeader.innerHTML = `
          <div class="history__header-left">
            <img src="./data/images/history.svg" class="history__header-icon">
            <h1>История обработок</h1>
          </div>
          <button class="history__expand-all" id="expandAllBtn">
            Развернуть все
          </button>
        `;
        this.statusElem.appendChild(historyHeader);
        this.attachGlobalToggle();
      } else {
        historyHeader.style.display = 'flex';
      }
    }

    ROOT_ACTIONBAR.className = 'history-mode'; 
    ROOT_ACTIONBAR.innerHTML = `
      <div class="history">
        <div class="history__list" id="historyList">
          <div class="history__loading">Загрузка...</div>
        </div>
      </div>
    `;

    await this.loadHistory();
  }

  attachGlobalToggle() {
    const btn = document.getElementById('expandAllBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      this.isAllExpanded = !this.isAllExpanded;
      const cards = this.rootEl.querySelectorAll('.history-card');
      
      cards.forEach(card => {
        const table = card.querySelector('.history-card__table');
        const toggleBtn = card.querySelector('.history-card__toggle');
        const text = toggleBtn.querySelector('.toggle-text');

        if (this.isAllExpanded) {
          table.classList.add('visible');
          toggleBtn.classList.add('active');
          text.innerText = 'Свернуть таблицу';
        } else {
          table.classList.remove('visible');
          toggleBtn.classList.remove('active');
          text.innerText = 'Развернуть таблицу';
        }
      });

      btn.innerText = this.isAllExpanded ? 'Свернуть все' : 'Развернуть все';
      btn.classList.toggle('active', this.isAllExpanded);
    });
  }

  async loadHistory() {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/history`);
      const data = await response.json();
      const normalized = this.normalizeHistory(data.result);
      this.renderList(normalized);
    } catch (e) {
      const list = this.rootEl.querySelector('#historyList');
      if (list) list.innerHTML = `<div class="history__error">Ошибка загрузки данных</div>`;
    }
  }

  renderList(items) {
    const container = this.rootEl.querySelector('#historyList');
    if (!items || !items.length) {
      container.innerHTML = `<div class="history__empty">Нет данных</div>`;
      return;
    }

    // Возвращаем иконки, дату и КНОПКУ ПЕРЕКЛЮЧАТЕЛЬ в шаблон
    container.innerHTML = items.map(item => `
      <div class="history-card">
        <div class="history-card__top">
          <div class="history-card__file">
             <img src="./data/images/document.svg" style="width: 18px; filter: contrast(0.5);">
             ${item.filename}
          </div>
          <div class="history-card__date">
             <img src="./data/images/calendar.svg" style="width: 18px; filter: contrast(0.5);">
             ${item.created_at}
          </div>
        </div>

        <div class="history-card__table">
          <div class="history-card__table-inner">
            <table class="history-table">
              <thead>
                <tr>
                  <th>Параметр</th>
                  <th>Итоговое значение</th>
                </tr>
              </thead>
              <tbody>
                ${item.result.map(r => `
                  <tr>
                    <td>${r.label}</td>
                    <td>${r.value}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="history-card__toggle">
          <svg width="14" height="8" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L7 7L13 1" stroke="#00AC86" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="toggle-text">Развернуть таблицу</span>
        </div>
      </div>
    `).join('');

    this.attachToggle();
  }

  attachToggle() {
    this.rootEl.querySelectorAll('.history-card__toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.history-card');
        const table = card.querySelector('.history-card__table');
        const text = btn.querySelector('.toggle-text');
        
        const isNowVisible = table.classList.toggle('visible');
        btn.classList.toggle('active', isNowVisible);
        
        text.innerText = isNowVisible ? 'Свернуть таблицу' : 'Развернуть таблицу';
      });
    });
  }

  normalizeHistory(items) {
    if (!items || !items.length) return [];
    
    const grouped = {};
    
    items.forEach(item => {
      const filename = item.name.split('/').pop();
      
      // Предполагаем, что формат даты "DD.MM.YYYY HH:mm:ss" или ISO.
      // Чтобы сгруппировать по минутам, убираем секунды из ключа.
      // Если формат "12.05.2024 14:30:05", ключ станет "12.05.2024 14:30"
      const timeWithoutSeconds = item.timestamp.substring(0, 16); 
      
      // Ключ теперь учитывает путь (имя файла) и время до минут
      const key = `${item.name}_${timeWithoutSeconds}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          id: key,
          filename: filename,
          full_path: item.name,
          created_at: timeWithoutSeconds, // Отображаем время без секунд
          result: []
        };
      }
      
      // Добавляем параметр в общую таблицу
      grouped[key].result.push({
        label: item.field_name || `Параметр ${grouped[key].result.length + 1}`,
        value: item.value
      });
    });

    // Возвращаем массив, отсортированный по времени (от новых к старым)
    return Object.values(grouped).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}