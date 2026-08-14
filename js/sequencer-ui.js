/* ============================================================
   sequencer-ui.js — the 9x16 step grid.
   ============================================================ */
window.U9 = window.U9 || {};

U9.SequencerUI = (function () {
  const Engine = U9.Engine;
  let seqGridEl, stepIndicator;

  function render() {
    const grid = Engine.getGrid();
    seqGridEl.innerHTML = '';
    for (let i = 0; i < Engine.PAD_COUNT; i++) {
      const row = document.createElement('div'); row.className = 'seq-row';
      const rlbl = document.createElement('div'); rlbl.className = 'rlbl'; rlbl.textContent = (i + 1);
      row.appendChild(rlbl);
      for (let s = 0; s < Engine.STEPS; s++) {
        const cell = document.createElement('div');
        cell.className = 'step' + (s % 4 === 0 ? ' beat' : '') + (grid[i][s] ? ' on' : '');
        cell.dataset.pad = i; cell.dataset.step = s;
        cell.addEventListener('click', () => {
          Engine.toggleStep(i, s);
          cell.classList.toggle('on');
        });
        row.appendChild(cell);
      }
      seqGridEl.appendChild(row);
    }
  }

  function paintPlayhead(step) {
    document.querySelectorAll('.step').forEach(c => c.classList.remove('playhead'));
    document.querySelectorAll('.step[data-step="' + step + '"]').forEach(c => c.classList.add('playhead'));
    stepIndicator.textContent = (step + 1) + ' / ' + Engine.STEPS;
  }

  function clearPlayhead() {
    document.querySelectorAll('.step').forEach(c => c.classList.remove('playhead'));
    stepIndicator.textContent = '– / ' + Engine.STEPS;
  }

  function init() {
    seqGridEl = document.getElementById('seqGrid');
    stepIndicator = document.getElementById('stepIndicator');
    render();
  }

  return { init, render, paintPlayhead, clearPlayhead };
})();
