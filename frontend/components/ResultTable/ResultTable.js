

console.log('ResultTable loaded');

function escapeTsvCell(value) {
  if (value == null) return '';
  let s = String(value);

  // normalize line breaks
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // tabs break columns in TSV -> replace
  s = s.replace(/\t/g, ' ');

  // quote if needed
  if (s.includes('"') || s.includes('\n')) {
    s = `"${s.replace(/"/g, '""')}"`;
  }

  return s;
}

function buildTsvString(tableRows) {
  // "sep=\t" helps Excel understand separator when it imports weirdly
  const header = ['Параметр', 'Значение'];

  const lines = [
    'sep=\t',
    header.map(escapeTsvCell).join('\t'),
    ...(tableRows || []).map((row) => {
      const label = row?.label ?? '';
      const value = row?.display_value ?? row?.value ?? '';
      return [label, value].map(escapeTsvCell).join('\t');
    }),
  ];

  return lines.join('\r\n'); // Excel likes CRLF
}

function encodeUtf16LEWithBom(str) {
  // IMPORTANT: UTF-16LE BOM = FF FE
  const out = new Uint8Array(2 + str.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;

  for (let i = 0; i < str.length; i++) {
    const codeUnit = str.charCodeAt(i);
    out[2 + i * 2] = codeUnit & 0xff;
    out[2 + i * 2 + 1] = (codeUnit >> 8) & 0xff;
  }

  return out;
}

function downloadExcelFile({ filename, contentUtf16leBytes }) {
  const blob = new Blob([contentUtf16leBytes], {
    type: 'text/tab-separated-values;charset=utf-16le',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  // revoke after click
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * renderResultTable
 */
export function renderResultTable(container, data) {
  console.log('renderResultTable called', data);

  container.innerHTML = `
    <div class="result">
      <div class="result__card">
        <table class="result__table">
          <thead>
            <tr>
              <th>ПАРАМЕТР</th>
              <th>ИТОГОВОЕ ЗНАЧЕНИЕ</th>
            </tr>
          </thead>
          <tbody>
            ${(data.table || []).map(row => `
              <tr class="${row.valid ? '' : 'row--invalid'}">
                <td>${row.label}</td>
                <td>${row.display_value ?? row.value}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="result__actions">
        <button 
          id="downloadXlsx" 
          type="button"
          class="accent__btn accent__btn--wide">
          Скачать XLSX
        </button>

        <button id="publishBI" disabled class="accent__btn accent__btn--outline">
          Опубликовать в BI
        </button>
      </div>
    </div>
  `;

  const btn = container.querySelector('#downloadXlsx');

  if (btn) {
    btn.onclick = async () => {
      try {
        // Берём task_id из localStorage
        const taskId = localStorage.getItem('task_id');
        if (!taskId) throw new Error('task_id не найден в localStorage');

        console.log('CLICK XLSX', taskId);

        btn.disabled = true;
        btn.textContent = 'Формирование...';

        const params = new URLSearchParams({ task_id: taskId });

        const response = await fetch(`/api/excel?${params.toString()}`, {
          method: 'GET'
        });

        if (!response.ok) {
          throw new Error('Ошибка скачивания');
        }

        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `result_${taskId}.xlsx`;

        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);

      } catch (err) {
        console.error(err);
        alert('Не удалось скачать файл');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Скачать XLSX';
      }
    };
  }
}
