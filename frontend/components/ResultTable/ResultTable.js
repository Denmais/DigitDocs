import { API_CONFIG } from '../../constants/api.js';


// Проверяет, есть ли данные с нескольких страниц.
function hasSeveralPages(rows) {
  const pages = new Set(
    rows
      .map((row) => row?.page)
      .filter((page) => Number.isInteger(page))
  );

  return pages.size > 1;
}


// Экранирует текст перед вставкой в HTML.
function escapeHtml(value) {
  if (value == null) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// Рисует итоговую таблицу.
export function renderResultTable(container, data) {
  const rows = data.table || [];
  const showPage = hasSeveralPages(rows);

  container.innerHTML = `
    <div class="result__card">
      <table class="result__table">
        <thead>
          <tr>
            ${showPage ? '<th>СТРАНИЦА</th>' : ''}
            <th>ПАРАМЕТР</th>
            <th>ИТОГОВОЕ ЗНАЧЕНИЕ</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map((row) => `
            <tr>
              ${showPage ? `<td>${Number(row.page) + 1}</td>` : ''}
              <td>${escapeHtml(row.label ?? '')}</td>
              <td>${escapeHtml(row.display_value ?? row.value ?? '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${rows.length === 0 ? `
        <div class="result__empty">
          Нет распознанных данных
        </div>
      ` : ''}

      <div class="result__actions">
        <button
          id="downloadXlsx"
          type="button"
          class="accent__btn accent__btn--wide"
        >
          Скачать XLSX
        </button>

        <button
          id="publishBI"
          type="button"
          class="accent__btn accent__btn--outline"
        >
          Опубликовать в BI
        </button>
      </div>
    </div>
  `;

  const xlsxButton = container.querySelector('#downloadXlsx');
  const biButton = container.querySelector('#publishBI');

  if (xlsxButton) {
    xlsxButton.onclick = () => downloadXlsx(xlsxButton);
  }

  if (biButton) {
    biButton.onclick = () => publishToBI(biButton);
  }
}


// Скачивает XLSX.
async function downloadXlsx(button) {
  try {
    const taskId = localStorage.getItem('task_id');

    if (!taskId) {
      throw new Error('task_id не найден в localStorage');
    }

    button.disabled = true;
    button.textContent = 'Формирование...';

    const params = new URLSearchParams({
      task_id: taskId,
    });

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.EXCEL}?${params.toString()}`
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || 'Ошибка скачивания');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `result_${taskId}.xlsx`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);

    alert(
      err instanceof Error
        ? err.message
        : 'Не удалось скачать файл'
    );
  } finally {
    button.disabled = false;
    button.textContent = 'Скачать XLSX';
  }
}


// Создаёт BI-витрину и открывает dashboard Superset.
async function publishToBI(button) {
  const taskId = localStorage.getItem('task_id');

  if (!taskId) {
    alert('task_id не найден в localStorage');
    return;
  }

  // Открываем вкладку сразу, иначе браузер может заблокировать popup после await.
  const dashboardWindow = window.open('', '_blank');

  try {
    button.disabled = true;
    button.textContent = 'Публикация...';

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BI_PUBLISH}`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          task_id: taskId,
        }),
      }
    );

    const text = await response.text().catch(() => '');

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
        result?.detail ||
        result?.error ||
        text ||
        'Не удалось опубликовать данные в BI'
      );
    }

    if (!result.dashboard_url) {
      throw new Error(
        'Backend не вернул dashboard_url'
      );
    }

    if (dashboardWindow) {
      dashboardWindow.location.href = result.dashboard_url;
    } else {
      window.location.href = result.dashboard_url;
    }
  } catch (err) {
    if (dashboardWindow) {
      dashboardWindow.close();
    }

    console.error(err);

    alert(
      err instanceof Error
        ? err.message
        : 'Не удалось опубликовать данные в BI'
    );
  } finally {
    button.disabled = false;
    button.textContent = 'Опубликовать в BI';
  }
}