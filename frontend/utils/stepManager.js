/**
 * Управление шагами пользовательского сценария.
 *
 * Работает ИСКЛЮЧИТЕЛЬНО на фронтенде.
 * Backend НЕ управляет шагами напрямую.
 *
 * Шаги визуализируются через классы `.statusbar__item--active`
 * и CSS-переменную `--active-step`.
 */

export function nextStep() {
  // Все шаги
  const statusItems = document.querySelectorAll('.statusbar__item');

  // Уже активные шаги
  const activeItems = document.querySelectorAll('.statusbar__item--active');

  // Последний активный шаг
  const lastActive = activeItems[activeItems.length - 1];

  // Индекс текущего шага
  const index = [...statusItems].indexOf(lastActive);

  // Активируем следующий шаг (если есть)
  if (statusItems[index + 1]) {
    statusItems[index + 1].classList.add('statusbar__item--active');

    // CSS-переменная используется для прогресс-линии
    document.documentElement.style.setProperty('--active-step', index + 2);
  }

  // Отладка
  const active = document.querySelectorAll('.statusbar__item--active');
  console.log('active step:', active);
  console.log('all items:', statusItems);

  if (!active) {
    console.warn('Statusbar not rendered yet!');
    return;
  }
}

export function previousStep() {
  const statusItems = document.querySelectorAll('.statusbar__item');
  const activeItems = document.querySelectorAll('.statusbar__item--active');
  const lastActive = activeItems[activeItems.length - 1];

  const index = [...statusItems].indexOf(lastActive);

  // Убираем активность с последнего шага
  if (statusItems[index]) {
    statusItems[index].classList.remove('statusbar__item--active');

    document.documentElement.style.setProperty('--active-step', index);
  }

  // Отладка
  const active = document.querySelectorAll('.statusbar__item--active');
  console.log('active step:', active);
  console.log('all items:', statusItems);

  if (!active) {
    console.warn('Statusbar not rendered yet!');
    return;
  }
}
