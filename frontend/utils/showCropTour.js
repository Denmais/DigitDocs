const TOUR_KEY = 'crop_tour_seen_v1';

export function showCropTourOnce() {
  if (localStorage.getItem(TOUR_KEY) === '1') return;

  const btn = document.querySelector('.tariff-field__action');
  if (!btn) return;

  localStorage.setItem(TOUR_KEY, '1');

  btn.classList.add('tour-pulse');

  const dim = document.createElement('div');
  dim.className = 'tour-dim';

  const spot = document.createElement('div');
  spot.className = 'tour-spotlight';

  const pop = document.createElement('div');
  pop.className = 'tour-pop';
  pop.innerHTML = `
    <div class="tour-pop__title">Как заполнить поле?</div>
    <div class="tour-pop__text">
      Нажми на кнопку <b>⛶</b> справа от поля — откроется режим кадрирования.
      Выдели нужный фрагмент на PDF, и значение подставится автоматически.
    </div>
    <div class="tour-pop__actions">
      <button class="tour-btn tour-btn--ghost" data-tour-skip>Пропустить</button>
      <button class="tour-btn tour-btn--primary" data-tour-ok>Понял</button>
    </div>
  `;

  document.body.appendChild(dim);
  document.body.appendChild(spot);
  document.body.appendChild(pop);

  const place = () => {
    const r = btn.getBoundingClientRect();
    const pad = 6;
    const sx = window.scrollX;
    const sy = window.scrollY;

    spot.style.left = `${r.left + sx - pad}px`;
    spot.style.top = `${r.top + sy - pad}px`;
    spot.style.width = `${r.width + pad * 2}px`;
    spot.style.height = `${r.height + pad * 2}px`;

    const margin = 12;
    let left = r.right + sx + margin;
    let top = r.top + sy - 6;

    if (left + pop.offsetWidth > window.innerWidth) {
        left = Math.max(10, r.left + sx - pop.offsetWidth - margin);
    }
    if (top + pop.offsetHeight > window.innerHeight) {
        top = r.bottom + sy + margin;
    }

    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    };

    requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        setTimeout(place, 200);
    });
});


    (async () => {
    await document.fonts?.ready;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    setTimeout(place, 200);
    })();

  const cleanup = () => {
    btn.classList.remove('tour-pulse');
    dim.remove();
    spot.remove();
    pop.remove();
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') cleanup();
  };

  dim.addEventListener('click', cleanup);
  pop.querySelector('[data-tour-ok]')?.addEventListener('click', cleanup);
  pop.querySelector('[data-tour-skip]')?.addEventListener('click', cleanup);
  document.addEventListener('keydown', onKey);
}
