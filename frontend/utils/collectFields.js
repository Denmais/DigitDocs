

export function collectFieldsFromForm() {
  const fields = [];

  document.querySelectorAll('.tariff-field').forEach((field) => {
    const id = field.dataset.fieldId;
    const input = field.querySelector('input');

    if (!id || !input) return;

    const value = input.value?.trim();

    if (value) {
      fields.push({ id, value });
    }
  });

  return fields;
}
