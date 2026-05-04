/**
 * extractFieldMock
 *
 * MOCK-реализация API для извлечения значения из PDF
 * по выделенному пользователем фрагменту (crop).
 *
 * Используется ВМЕСТО:
 * POST /api/extract-field
 *
 * Backend:
 * - принимает координаты выделения
 * - выполняет OCR / ML / rule-based парсинг
 * - возвращает значение + confidence
 */

export async function extractFieldMock({
  task_id,
  field_id,
  page,
  crop,
}) {
  /**
   * task_id
   *  - идентификатор задачи обработки документа
   *
   * field_id
   *  - ID поля (tariff_kw_day, period, etc.)
   *
   * page
   *  - номер страницы PDF
   *
   * crop
   *  - координаты выделения в координатах PDF
   *  {
   *    x, y, width, height
   *  }
   */

  console.log('POST /api/extract-field', {
    task_id,
    field_id,
    page,
    crop,
  });

  // Эмуляция задержки backend
  await new Promise((r) => setTimeout(r, 1200));

  return {
    field: {
      id: field_id,

      // ⚠️ MOCK:
      // сейчас всегда возвращаем "4.32"
      // backend должен вернуть реальное распознанное значение
      value: '4.32',

      // confidence — уверенность модели (0..1)
      confidence: 0.87,
    },
  };
}
