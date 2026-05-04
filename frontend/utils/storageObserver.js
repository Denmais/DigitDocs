/**
 * Observer над localStorage.
 *
 * Позволяет реагировать на изменения данных
 * без Redux / EventBus / Framework.
 *
 * Используется для:
 * - обновления statusbar
 * - обновления заголовков
 * - синхронизации UI между компонентами
 *
 * Backend: значения в localStorage часто
 * основаны на данных, полученных от API.
 */

export function createStorageObserver() {
  const originalSetItem = localStorage.setItem;
  const callbacks = {};

  // Переопределяем localStorage.setItem
  localStorage.setItem = function (key, value) {
    originalSetItem.call(this, key, value);

    // Коллбэки для конкретного ключа
    if (callbacks[key]) {
      callbacks[key].forEach((callback) => callback(value));
    }

    // Глобальные коллбэки
    if (callbacks['*']) {
      callbacks['*'].forEach((callback) => callback(key, value));
    }
  };

  return {
    // Подписка на ключ
    on(key, callback) {
      if (!callbacks[key]) {
        callbacks[key] = [];
      }
      callbacks[key].push(callback);
    },

    // Отписка
    off(key, callback) {
      if (callbacks[key]) {
        const index = callbacks[key].indexOf(callback);
        if (index > -1) {
          callbacks[key].splice(index, 1);
        }
      }
    },
  };
}
