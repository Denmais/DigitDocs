/**
 * collectMock
 *
 * MOCK-реализация финального шага сбора данных.
 *
 * Используется ВМЕСТО реального backend-эндпоинта:
 * POST /api/collect
 *
 * Нужен для:
 * - отладки UI
 * - демонстрации полного user-flow
 * - разработки без backend
 *
 * ⚠️ Backend:
 * Этот файл будет УДАЛЁН после подключения реального API.
 */

export function collectMock({ task_id, fields }) {
  /**
   * task_id
   *  - идентификатор задачи обработки документа
   *  - приходит с backend после /process
   *
   * fields
   *  - массив значений, которые пользователь подтвердил / выделил
   *  [
   *    { id: "tariff_kw_day", value: "4.32" },
   *    { id: "period", value: "12.2024" }
   *  ]
   */

  return Promise.resolve({
    /**
     * result_id
     *  - итоговый идентификатор результата
     *  - используется далее для публикации (BI, экспорт и т.п.)
     */
    result_id: 'mock_result',

    /**
     * table
     *  - финальная таблица для UI
     *  - backend в реальности должен вернуть
     *    уже нормализованные значения
     */
    table: fields.map(f => ({
      id: f.id,

      // ⚠️ MOCK:
      // сейчас label = id
      // backend должен вернуть ЧЕЛОВЕЧЕСКИЕ названия
      label: f.id,

      value: f.value,

      // display_value — строка для отображения (форматирование)
      display_value: f.value,

      // valid — результат валидации backend
      valid: true,
    })),
  });
}
