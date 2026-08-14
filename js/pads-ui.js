/* ============================================================
   pads-ui.js — the 3x3 pad grid.
   ============================================================ */
window.U9 = window.U9 || {};

U9.PadsUI = (function () {
  const Engine = U9.Engine;
  let padsEl = null;

  function flash(i, when) {
    const el = document.querySelector('.pad[data-i="' + i + '"]');
    if (!el) return;
    const ctxNow = Engine.ensureCtx().currentTime;
    const delay = when ? Math.max(0, (when - ctxNow) * 1000) : 0;
    setTimeout(() => {
      el.classList.add('hit');
      setTimeout(() => el.classList.remove('hit'), 90);
    }, delay);
  }

  function updateLabel(i) {
    const lbl = document.querySelector('.pad[data-i="' + i + '"] .lbl');
    const pad = Engine.getPad(i);
    if (lbl) lbl.textContent = pad && pad.name ? pad.name : '—';
  }

  async function loadFile(i, file) {
    if (!file) return;
    if (file.type && !file.type.startsWith('audio')) { alert('That doesn\'t look like an audio file.'); return; }
    try {
      const buf = await Engine.decodeAudio(await file.arrayBuffer());
      Engine.setPad(i, buf, file.name.replace(/\.[^/.]+$/, '').slice(0, 14).toUpperCase());
      updateLabel(i);
    } catch (err) {
      alert('Could not decode that audio file.');
    }
  }

  function loadBuffer(i, buffer, name) {
    Engine.setPad(i, buffer, name);
    updateLabel(i);
    flash(i);
  }

  function wirePad(el, i) {
    const body = el.querySelector('.pad-body');
    const upBtn = el.querySelector('.up');
    const fileInput = el.querySelector('input[type=file]');
    body.style.touchAction = 'none';

    let bend = null;
    body.addEventListener('pointerdown', (e) => {
      const armed = U9.RecorderUI && U9.RecorderUI.consumeArmedPreset();
      if (armed) { loadBuffer(i, armed.buffer, armed.name); return; }
      const src = Engine.playPad(i);
      if (src) bend = { source: src, startY: e.clientY };
      try { body.setPointerCapture(e.pointerId); } catch (err) {}
    });
    body.addEventListener('pointermove', (e) => {
      if (!bend) return;
      const dy = bend.startY - e.clientY;
      const semis = Math.max(-12, Math.min(12, dy * 0.15));
      const rate = Math.pow(2, semis / 12) * Engine.globalPitchRate();
      try { bend.source.playbackRate.setTargetAtTime(rate, Engine.ensureCtx().currentTime, 0.02); } catch (err) {}
    });
    function releaseBend() {
      if (!bend) return;
      try { bend.source.playbackRate.setTargetAtTime(Engine.globalPitchRate(), Engine.ensureCtx().currentTime, 0.06); } catch (err) {}
      bend = null;
    }
    body.addEventListener('pointerup', releaseBend);
    body.addEventListener('pointercancel', releaseBend);

    upBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files[0]; if (f) loadFile(i, f);
      e.target.value = '';
    });

    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('dragover');
      const presetId = e.dataTransfer.getData('application/x-beatloop-preset');
      if (presetId && U9.RecorderUI) {
        const preset = U9.RecorderUI.resolvePreset(presetId);
        if (preset) { loadBuffer(i, preset.buffer, preset.name); return; }
      }
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(i, f);
    });
  }

  function renderAll() {
    padsEl.innerHTML = '';
    for (let i = 0; i < Engine.PAD_COUNT; i++) {
      const pad = Engine.getPad(i);
      const el = document.createElement('div');
      el.className = 'pad'; el.dataset.i = i;
      el.innerHTML =
        '<div class="pad-body"><div class="num">' + (i + 1) + '</div><div class="lbl">' + (pad ? pad.name : '—') + '</div></div>' +
        '<div class="up">⤒ LOAD SAMPLE</div>' +
        '<input type="file" accept="audio/*">';
      wirePad(el, i);
      padsEl.appendChild(el);
    }
  }

  function init() {
    padsEl = document.getElementById('pads');
    renderAll();
  }

  return { init, renderAll, updateLabel, loadBuffer, flash };
})();
