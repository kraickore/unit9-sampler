/* ============================================================
   boot.js — boots the audio engine, then every UI module.

   Deliberately defensive: Engine.boot() creates the AudioContext
   and synthesizes the 9 default pad samples. If that throws for
   any reason (some webviews/mobile browsers refuse to construct
   an AudioContext before a user gesture, or Web Audio just isn't
   available), that failure must NOT stop the UI modules below
   from initializing — otherwise the whole app appears to vanish
   (empty pad grid, empty sequencer grid) even though nothing is
   really broken. Playback itself retries ensureCtx()/
   ensurePadsReady() automatically on the first real pad hit, so
   audio recovers the moment the user actually touches something.
   ============================================================ */
window.U9 = window.U9 || {};

U9.Boot = (function () {
  function safeInit(name, mod) {
    try { mod.init(); }
    catch (err) { console.error('[UNIT-9] ' + name + ' failed to initialize:', err); }
  }

  function run() {
    try {
      U9.Engine.boot();
    } catch (err) {
      console.error('[UNIT-9] Engine.boot() failed — continuing without a live AudioContext; audio will retry on first pad hit.', err);
    }

    safeInit('Paging', U9.Paging);
    safeInit('PadsUI', U9.PadsUI);
    safeInit('KnobsPanel', U9.KnobsPanel);
    safeInit('TransportUI', U9.TransportUI);
    safeInit('RecorderUI', U9.RecorderUI);
    safeInit('SequencerUI', U9.SequencerUI);
    safeInit('ProjectStorage', U9.ProjectStorage);
    safeInit('MidiLearn', U9.MidiLearn);
  }

  return { run };
})();
