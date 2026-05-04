/**
 * viewerState
 *
 * Глобальное состояние PDF-вьюера.
 *
 * Используется несколькими компонентами:
 * - Actionbar
 * - PdfCrop
 * - Viewer controls (zoom, scroll)
 *
 * Backend к этому файлу НЕ ПРИВЯЗАН.
 * Это ЧИСТО frontend-состояние.
 */

export const viewerState = {
  pages: [],
  pageIndex: 0,

  zoom: 1,        // пользовательский zoom
  baseScale: 1,   // авто-подгон по высоте
  renderScale: 1, // zoom * baseScale

  minZoom: 0.5,
  maxZoom: 3,
};

