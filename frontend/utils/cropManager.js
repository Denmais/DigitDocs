/**
 * Глобальное состояние режима кадрирования (crop).
 *
 * Backend получает координаты crop,
 * рассчитанные на фронтенде.
 */

// Текущее состояние crop
export const cropState = {
  active: false,   // включён ли режим выделения
  fieldId: null,   // поле, для которого делается crop
  page: 1,         // номер страницы PDF
};

/**
 * Включение режима кадрирования
 * @param {string} fieldId - ID поля (из backend fields[])
 */
export function startCrop(fieldId) {
  cropState.active = true;
  cropState.fieldId = fieldId;

  // Событие для PdfCrop компонента
  document.dispatchEvent(
    new CustomEvent('cropModeEnabled', {
      detail: { fieldId },
    })
  );
}

/**
 * Отмена режима кадрирования (ESC)
 */
export function cancelCrop() {
  cropState.active = false;
  cropState.fieldId = null;

  document.dispatchEvent(new CustomEvent('cropModeCanceled'));
}
