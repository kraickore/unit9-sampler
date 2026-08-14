/* ============================================================
   sequencer-engine.js — the clock.
   Owns the 9x16 step grid and the lookahead scheduler. Depends on
   U9.PadEngine to actually trigger a pad on each active step, and
   U9.DspChain only for timing (ctx.currentTime).
   ============================================================ */
window.U9 = window.U9 || {};

U9.SequencerEngine = (function () {
  const Dsp = U9.DspChain;
  const Pad = U9.PadEngine;
  const STEPS = 16;

  const api = {};
  api.STEPS = STEPS;
  api.onStepChange = function () {};
  api.onSequencerStop = function () {};

  const grid = [];
  for (let i = 0; i < Pad.PAD_COUNT; i++) grid.push(new Array(STEPS).fill(false));

  api.toggleStep = function (pad, step) { grid[pad][step] = !grid[pad][step]; };
  api.setStep = function (pad, step, val) { grid[pad][step] = !!val; };
  api.getGrid = function () { return grid; };
  api.setGrid = function (newGrid) {
    for (let i = 0; i < Pad.PAD_COUNT; i++)
      for (let s = 0; s < STEPS; s++)
        grid[i][s] = !!(newGrid[i] && newGrid[i][s]);
  };

  let bpm = 120;
  let playing = false, looping = true, currentStep = 0, nextNoteTime = 0, timerID = null;
  const LOOKAHEAD_MS = 25.0, SCHEDULE_AHEAD_S = 0.1;

  function nextNote() {
    nextNoteTime += 60.0 / bpm / 4;
    currentStep++;
    if (currentStep >= STEPS) {
      if (looping) currentStep = 0;
      else api.stop();
    }
  }

  function scheduleStep(step, time) {
    for (let i = 0; i < Pad.PAD_COUNT; i++)
      if (grid[i][step]) Pad.playPad(i, time);
    const ctx = Dsp.ensureCtx();
    setTimeout(() => { if (playing) api.onStepChange(step); }, Math.max(0, (time - ctx.currentTime) * 1000));
  }

  function scheduler() {
    const ctx = Dsp.ensureCtx();
    // `playing` must gate this loop too, not just the outer setTimeout chain:
    // nextNote() can call api.stop() mid-loop (when a non-looping run hits
    // STEPS), which flips `playing` to false while we're still inside this
    // synchronous while-loop. Without checking it here, the loop keeps
    // scheduling extra hits at step 0 for the rest of the lookahead window,
    // and the unconditional reschedule below would then keep resurrecting
    // this function forever — the sequencer silently never actually stops.
    while (playing && nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      scheduleStep(currentStep, nextNoteTime);
      nextNote();
    }
    if (playing) timerID = setTimeout(scheduler, LOOKAHEAD_MS);
  }

  api.play = function () {
    const ctx = Dsp.ensureCtx();
    if (playing) return;
    playing = true;
    currentStep = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    scheduler();
  };
  api.stop = function () {
    playing = false;
    clearTimeout(timerID);
    currentStep = 0;
    api.onSequencerStop();
  };
  api.isPlaying = function () { return playing; };
  api.isLooping = function () { return looping; };
  api.setLooping = function (v) { looping = !!v; };
  api.getCurrentStep = function () { return currentStep; };
  api.setTempo = function (v) { bpm = Math.max(60, Math.min(200, v)); return bpm; };
  api.getTempo = function () { return bpm; };

  return api;
})();
