/* ============================================================
   recorder-ui.js — loop recorder + preset tray.
   ============================================================ */
window.U9 = window.U9 || {};

U9.RecorderUI = (function () {
  const Engine = U9.Engine;

  let presets = [];
  let armedPreset = null;
  let presetSeq = 0;
  let recDuration = 30;

  let recBtn, recTimer, armHint, trayEl;

  function pushPreset(buffer, name) {
    presetSeq++;
    const preset = { id: 'p' + presetSeq, name: name || ('LOOP ' + presetSeq), buffer };
    presets.push(preset);
    if (presets.length > 8) presets.shift();
    return preset;
  }

  function resolvePreset(id) { return presets.find(p => p.id === id) || null; }

  function consumeArmedPreset() {
    if (!armedPreset) return null;
    const p = armedPreset;
    armedPreset = null;
    renderTray();
    return p;
  }

  function startRec() {
    Engine.startRecording(
      recDuration,
      (buffer, err) => {
        if (err) { recTimer.textContent = err; return; }
        const preset = pushPreset(buffer, null);
        renderTray();
        recTimer.textContent = 'SAVED · ' + buffer.duration.toFixed(1) + 's';
      },
      (elapsed) => { recTimer.textContent = 'REC ' + elapsed.toFixed(1) + 's / ' + recDuration + 's'; }
    );
    recBtn.classList.add('recording');
  }

  function stopRec() {
    Engine.stopRecording();
    recBtn.classList.remove('recording');
    recTimer.textContent = 'SAVING…';
  }

  function wireChipDrag(chip, preset) {
    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-beatloop-preset', preset.id);
      e.dataTransfer.effectAllowed = 'copy';
    });

    let dragMoved = false, ghost = null, tracking = false, startX = 0, startY = 0;
    // Without this, mobile browsers treat a touch-drag on a chip as page/tray
    // scrolling (presetTray is horizontally scrollable) instead of handing
    // pointermove events to us — silently breaking drag-to-pad on touch.
    chip.style.touchAction = 'none';
    chip.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.cplay') || e.target.closest('.cdel')) return;
      dragMoved = false; tracking = true; startX = e.clientX; startY = e.clientY;
      try { chip.setPointerCapture(e.pointerId); } catch (err) {}
    });
    chip.addEventListener('pointermove', (e) => {
      if (!tracking) return;
      if (!dragMoved && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) {
        dragMoved = true;
        ghost = document.createElement('div');
        ghost.className = 'chip dragghost';
        ghost.textContent = preset.name;
        document.body.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.left = e.clientX + 'px';
        ghost.style.top = e.clientY + 'px';
        document.querySelectorAll('.pad.dragover').forEach(p => p.classList.remove('dragover'));
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const pad = under && under.closest('.pad');
        if (pad) pad.classList.add('dragover');
      }
    });
    function endDrag(e) {
      if (ghost) {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const pad = under && under.closest('.pad');
        if (pad) { U9.PadsUI.loadBuffer(parseInt(pad.dataset.i, 10), preset.buffer, preset.name); pad.classList.remove('dragover'); }
        ghost.remove(); ghost = null;
      }
      tracking = false; startX = 0; startY = 0;
    }
    chip.addEventListener('pointerup', endDrag);
    chip.addEventListener('pointercancel', endDrag);

    chip.addEventListener('click', () => {
      if (dragMoved) { dragMoved = false; return; }
      armedPreset = (armedPreset && armedPreset.id === preset.id) ? null : preset;
      renderTray();
    });
  }

  function renderTray() {
    trayEl.innerHTML = '';
    if (presets.length === 0) {
      trayEl.innerHTML = '<div class="chip" style="cursor:default;color:var(--steel);font-size:7.5px;">no loops recorded yet</div>';
      armHint.textContent = '\u00A0';
      return;
    }
    presets.forEach(preset => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (armedPreset && armedPreset.id === preset.id ? ' armed' : '');
      chip.draggable = true;
      chip.innerHTML =
        '<div class="cplay">▶</div>' +
        '<div><div class="cname">' + preset.name + '</div><div class="cdur">' + preset.buffer.duration.toFixed(1) + 's</div></div>' +
        '<div class="cdel">×</div>';
      chip.querySelector('.cplay').addEventListener('click', (e) => { e.stopPropagation(); Engine.previewBuffer(preset.buffer); });
      chip.querySelector('.cdel').addEventListener('click', (e) => {
        e.stopPropagation();
        presets = presets.filter(p => p.id !== preset.id);
        if (armedPreset && armedPreset.id === preset.id) armedPreset = null;
        renderTray();
      });
      wireChipDrag(chip, preset);
      trayEl.appendChild(chip);
    });
    armHint.textContent = armedPreset ? ('Tap a pad to load "' + armedPreset.name + '" \u00B7 tap chip again to cancel') : '\u00A0';
  }

  function init() {
    recBtn = document.getElementById('recBtn');
    recTimer = document.getElementById('recTimer');
    armHint = document.getElementById('armHint');
    trayEl = document.getElementById('presetTray');

    document.querySelectorAll('.durbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (Engine.isRecording()) return;
        document.querySelectorAll('.durbtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        recDuration = parseInt(btn.dataset.dur, 10);
      });
    });

    recBtn.addEventListener('click', () => Engine.isRecording() ? stopRec() : startRec());
    renderTray();
  }

  function getPresets() { return presets; }
  function setPresets(list) {
    presets = list.map(p => { presetSeq++; return { id: 'p' + presetSeq, name: p.name, buffer: p.buffer }; });
    armedPreset = null;
    renderTray();
  }

  return { init, resolvePreset, consumeArmedPreset, getPresets, setPresets };
})();
