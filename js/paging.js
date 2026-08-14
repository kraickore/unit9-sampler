/* ============================================================
   paging.js — swipe/dots/arrow navigation between the two pages.
   ============================================================ */
window.U9 = window.U9 || {};

U9.Paging = (function () {
  const labels = ['1/2 · instrument', '2/2 · sequencer'];
  let page = 0;
  let pagesEl, dots, pageLabel;

  function goTo(p) {
    page = Math.max(0, Math.min(1, p));
    pagesEl.style.transform = 'translateX(' + (page === 0 ? '0%' : '-50%') + ')';
    dots.forEach((d, i) => d.classList.toggle('active', i === page));
    pageLabel.textContent = labels[page];
  }

  function init() {
    pagesEl = document.getElementById('pages');
    dots = Array.from(document.querySelectorAll('.dot'));
    pageLabel = document.getElementById('pageLabel');
    const pageport = document.getElementById('pageport');

    document.getElementById('navLeft').addEventListener('click', () => goTo(page - 1));
    document.getElementById('navRight').addEventListener('click', () => goTo(page + 1));
    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
    document.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft') goTo(page - 1);
      if (e.code === 'ArrowRight') goTo(page + 1);
    });

    let touchStartX = null, touchStartY = null;
    pageport.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
    }, { passive: true });
    pageport.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      touchStartX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) goTo(dx < 0 ? page + 1 : page - 1);
    }, { passive: true });

    goTo(0);
  }

  return { init };
})();
