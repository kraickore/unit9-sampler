/* ============================================================
   engine.js — composition root for the audio engine.
   U9.DspChain / PadEngine / SequencerEngine / RecorderEngine are each
   independently useful and independently testable. This file just
   merges their public methods into one U9.Engine facade so the UI
   layer has a single, stable thing to talk to.

   NOTE on callbacks: onPadTriggered/onStepChange/onSequencerStop are
   still owned by their real sub-module (PadEngine / SequencerEngine),
   not by this facade — main.js wires those three directly to the
   owning sub-module. Everything else is a plain function call, which
   works fine through the merge.
   ============================================================ */
window.U9 = window.U9 || {};

U9.Engine = (function () {
  const api = Object.assign({}, U9.DspChain, U9.PadEngine, U9.SequencerEngine, U9.RecorderEngine);

  api.boot = function () {
    U9.DspChain.ensureCtx();
    U9.PadEngine.ensurePadsReady();
  };

  return api;
})();
