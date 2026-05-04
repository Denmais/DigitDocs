/**
 * Корневые DOM-элементы приложения.
 *
 * Используются как точки монтирования (render targets)
 * для основных UI-блоков.
 *
 */

// Левая боковая панель (навигация, доп. инфо)
export const ROOT_SIDEBAR = document.getElementById('sidebar');

// Верхняя панель шагов (progress / stepper)
export const ROOT_STATUSBAR = document.getElementById('statusbar');

// Основная рабочая область приложения
// Именно сюда рендерятся:
// - формы
// - PDF viewer
// - crop-интерфейс
// - таблица результата
export const ROOT_ACTIONBAR = document.getElementById('action-bar');
