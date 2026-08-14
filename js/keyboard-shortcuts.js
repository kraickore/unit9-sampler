/* ============================================================
   keyboard-shortcuts.js — 1-9 trigger pads, space toggles play/stop.
   ============================================================ */
window.U9 = window.U9 || {};

U9.KeyboardShortcuts = (function () {
  function run() {
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key >= '1' && e.key <= '9') U9.Engine.playPad(parseInt(e.key, 10) - 1);
      if (e.code === 'Space') { e.preventDefault(); U9.TransportUI.togglePlay(); }
    });
  }
  return { run };
})();
