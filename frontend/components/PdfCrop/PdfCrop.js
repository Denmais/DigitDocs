

import { cropState, cancelCrop } from '../../utils/cropManager.js';
import { viewerState } from '../../services/viewerState.js';


let overlay;   // Полупрозрачный overlay поверх PDF
let rect;      // Прямоугольник выделения
let startX = 0;
let startY = 0;
let wrapper;   // Обёртка страницы PDF (учитывает zoom)
let isActive = false;


export function enableCropMode() {
  const canvas = document.querySelector('.viewer__canvas');
  if (!canvas) return;

  // если режим уже был включён — убираем старый overlay и слушатели
  cleanup();

  wrapper = canvas.querySelector('.viewer__page-wrapper');
  if (!wrapper) return;

  canvas.style.cursor = 'crosshair';

  overlay = document.createElement('div');
  overlay.className = 'crop-overlay';
  overlay.innerHTML = `
    <div class="crop-overlay__hint">
      Выберите нужный фрагмент
      <p>Нажмите ESC, чтобы выйти из режима кадрирования</p>
    </div>
  `;

  rect = document.createElement('div');
  rect.className = 'crop-rect';
  overlay.appendChild(rect);
  wrapper.appendChild(overlay);

  wrapper.addEventListener('mousedown', onMouseDown);
  document.addEventListener('keydown', onKeyDown);

  // (опционально) чтобы другие части UI знали что crop активен
  // cropState.active = true;
}


function onKeyDown(e) {
  if (e.key === 'Escape') {
    cleanup();
    cancelCrop();
  }
}


function onMouseDown(e) {
  e.preventDefault();
  const rectWrapper = wrapper.getBoundingClientRect();
  const scale = getRenderScale();

  startX = (e.clientX - rectWrapper.left) / scale;
  startY = (e.clientY - rectWrapper.top) / scale;

  rect.style.display = 'block';
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}


function onMouseMove(e) {
  const rectWrapper = wrapper.getBoundingClientRect();
  const scale = getRenderScale();

  const currentX = (e.clientX - rectWrapper.left) / scale;
  const currentY = (e.clientY - rectWrapper.top) / scale;

  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  Object.assign(rect.style, {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
  });
}


function onMouseUp() {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);

  // crop в координатах wrapper (DOM, "как рисовали")
  const domCrop = {
    x: rect.offsetLeft,
    y: rect.offsetTop,
    width: rect.offsetWidth,
    height: rect.offsetHeight,
  };

  // защита от клика без выделения
  if (domCrop.width < 3 || domCrop.height < 3) {
    cleanup();
    cancelCrop();
    return;
  }

  // переводим DOM → координаты реального изображения
  const { crop01, cropPx } = domCropToImageCrop(domCrop);

  document.dispatchEvent(
    new CustomEvent('cropSelected', {
      detail: {
        fieldId: cropState.fieldId,
        page: cropState.page,
        // выбери что отправлять:
        crop: crop01,   // 0..1
        // crop: cropPx, // пиксели PNG
      },
    })
  );

  cleanup();
}

// DOM → IMAGE crop (и в px, и в 0..1)
function domCropToImageCrop(domCrop) {
  const img = document.querySelector('.viewer__page');
  if (!img) return { crop01: domCrop, cropPx: domCrop };

  const scale = getRenderScale();

  const rectImg = img.getBoundingClientRect();
  const displayedW = rectImg.width / scale;
  const displayedH = rectImg.height / scale;

  const naturalW = img.naturalWidth || displayedW;
  const naturalH = img.naturalHeight || displayedH;

  const scaleX = naturalW / displayedW;
  const scaleY = naturalH / displayedH;

  const cropPx = {
    x: domCrop.x * scaleX,
    y: domCrop.y * scaleY,
    width: domCrop.width * scaleX,
    height: domCrop.height * scaleY,
  };

  const crop01 = {
    x: cropPx.x / naturalW,
    y: cropPx.y / naturalH,
    width: cropPx.width / naturalW,
    height: cropPx.height / naturalH,
  };

  return { crop01, cropPx };
}

function getRenderScale() {
  return (viewerState.baseScale || 1) * (viewerState.zoom || 1);
}


function cleanup() {
  // снять глобальные слушатели, если они висели
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('keydown', onKeyDown);

  // снять mousedown с предыдущего wrapper
  if (wrapper) wrapper.removeEventListener('mousedown', onMouseDown);

  // убрать overlay
  if (overlay) overlay.remove();

  overlay = null;
  rect = null;
  wrapper = null;

  const canvas = document.querySelector('.viewer__canvas');
  if (canvas) canvas.style.cursor = 'default';
}

export function disableCropMode() {
  cleanup();
}
