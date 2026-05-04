/**
 * Сбор данных из формы перед отправкой в /api/collect
 *
 * Результат:
 * [
 *   { id: "tariff_kw_day", value: "4.32" },
 *   { id: "period", value: "12.2024" }
 * ]
 *
 * Backend ожидает этот формат БЕЗ изменений.
 */

export function collectFieldsFromForm() {
  const fields = [];

  // Каждый тариф / параметр - отдельный блок
  document.querySelectorAll('.tariff-field').forEach((field) => {
    const id = field.dataset.fieldId;
    const input = field.querySelector('input');

    if (!id || !input) return;

    const value = input.value?.trim();

    // Отправляем только заполненные значения
    if (value) {
      fields.push({ id, value });
    }
  });

  return fields;
}
