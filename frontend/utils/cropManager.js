
export const cropState = {
  active: false,
  fieldId: null,
  page: 1,
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
