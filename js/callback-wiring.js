/* ============================================================
   callback-wiring.js — connects engine events to their UI handlers.
   Kept in its own file so "what happens on a pad hit / step change /
   sequencer stop" lives in exactly one obvious place, wired centrally
   rather than modules self-registering (which could silently
   overwrite each other's listeners as the app grows).
   ============================================================ */
window.U9 = window.U9 || {};

U9.CallbackWiring = (function () {
  function run() {
    U9.PadEngine.onPadTriggered = U9.PadsUI.flash;
    U9.SequencerEngine.onStepChange = U9.SequencerUI.paintPlayhead;
    U9.SequencerEngine.onSequencerStop = function () {
      U9.SequencerUI.clearPlayhead();
      U9.TransportUI.onStopped();
    };
  }
  return { run };
})();
