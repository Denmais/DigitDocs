export function nextStep() {
  // Все шаги
  const statusItems = document.querySelectorAll('.statusbar__item');

  const activeItems = document.querySelectorAll('.statusbar__item--active');

  const lastActive = activeItems[activeItems.length - 1];

  const index = [...statusItems].indexOf(lastActive);

  if (statusItems[index + 1]) {
    statusItems[index + 1].classList.add('statusbar__item--active');

    document.documentElement.style.setProperty('--active-step', index + 2);
  }

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

  if (statusItems[index]) {
    statusItems[index].classList.remove('statusbar__item--active');

    document.documentElement.style.setProperty('--active-step', index);
  }

  const active = document.querySelectorAll('.statusbar__item--active');
  console.log('active step:', active);
  console.log('all items:', statusItems);

  if (!active) {
    console.warn('Statusbar not rendered yet!');
    return;
  }
}
