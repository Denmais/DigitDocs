
export const cropState = {
  active: false,   // включён ли режим выделения
  fieldId: null,   // поле, для которого делается crop
  page: 1,         // номер страницы PDF
};


export function startCrop(fieldId) {
  cropState.active = true;
  cropState.fieldId = fieldId;

  document.dispatchEvent(
    new CustomEvent('cropModeEnabled', {
      detail: { fieldId },
    })
  );
}


export function cancelCrop() {
  cropState.active = false;
  cropState.fieldId = null;

  document.dispatchEvent(new CustomEvent('cropModeCanceled'));
}
