export function createStorageObserver() {
  const originalSetItem = localStorage.setItem;
  const callbacks = {};

  localStorage.setItem = function (key, value) {
    originalSetItem.call(this, key, value);

    if (callbacks[key]) {
      callbacks[key].forEach((callback) => callback(value));
    }

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
