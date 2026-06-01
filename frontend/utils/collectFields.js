

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
