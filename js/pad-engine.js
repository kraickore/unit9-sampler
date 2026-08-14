/* ============================================================
   pad-engine.js — the sampler.
   Owns pad sample data (the 9 buffers + names) and pad playback.
   Depends on U9.DspChain for the AudioContext and per-pad gain
   modules; owns no DOM.
   ============================================================ */
window.U9 = window.U9 || {};

U9.PadEngine = (function () {
  const Dsp = U9.DspChain;
  const PAD_COUNT = Dsp.PAD_COUNT;
  const DEFAULT_PAD_NAMES = ['KICK', 'SNARE', 'HAT-CL', 'HAT-OP', 'CLAP', 'TOM-LO', 'TOM-HI', 'PERC', 'RIM'];

  const api = {};
  api.PAD_COUNT = PAD_COUNT;
  api.onPadTriggered = function () {};

  const pads = [];

  function synth(idx, ctx) {
    const sr = ctx.sampleRate;
    const dur = idx === 3 ? 0.5 : (idx === 5 || idx === 6) ? 0.35 : 0.28;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let s = 0;
      if (idx === 0) { const f = 150 * Math.exp(-t * 18) + 45; s = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9); }
      else if (idx === 1) { s = (Math.random() * 2 - 1) * 0.6 * Math.exp(-t * 14) + Math.sin(2 * Math.PI * 180 * t) * 0.4 * Math.exp(-t * 22); }
      else if (idx === 2) { s = (Math.random() * 2 - 1) * Math.exp(-t * 45); }
      else if (idx === 3) { s = (Math.random() * 2 - 1) * Math.exp(-t * 6); }
      else if (idx === 4) { s = (Math.random() * 2 - 1) * Math.exp(-((t * 1000) % 40) / 6) * Math.exp(-t * 7); }
      else if (idx === 5) { s = Math.sin(2 * Math.PI * (120 * Math.exp(-t * 6)) * t) * Math.exp(-t * 7); }
      else if (idx === 6) { s = Math.sin(2 * Math.PI * (220 * Math.exp(-t * 6)) * t) * Math.exp(-t * 7); }
      else if (idx === 7) { s = Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t * 30) + (Math.random() * 2 - 1) * 0.2 * Math.exp(-t * 30); }
      else { s = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 60); }
      d[i] = Math.max(-1, Math.min(1, s));
    }
    return buf;
  }

  api.ensurePadsReady = function () {
    const ctx = Dsp.ensureCtx();
    if (pads.length === 0) {
      for (let i = 0; i < PAD_COUNT; i++) {
        // Per-pad try/catch: one bad synth shouldn't leave the other
        // 8 pads silently empty too.
        try { pads[i] = { buffer: synth(i, ctx), name: DEFAULT_PAD_NAMES[i] }; }
        catch (err) {
          console.error('[UNIT-9] failed to synthesize default sample for pad ' + i, err);
          pads[i] = { buffer: null, name: DEFAULT_PAD_NAMES[i] };
        }
      }
    }
  };

  api.getPad = function (i) { return pads[i] || null; };
  api.setPad = function (i, buffer, name) { pads[i] = { buffer, name }; };
  api.getAllPads = function () { return pads.slice(); };

  api.decodeAudio = function (arrayBuffer) {
    const ctx = Dsp.ensureCtx();
    return new Promise((resolve, reject) => ctx.decodeAudioData(arrayBuffer, resolve, reject));
  };

  api.previewBuffer = function (buffer) {
    const ctx = Dsp.ensureCtx();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(Dsp.getLowShelfInput());
    src.start();
  };

  api.playPad = function (i, when) {
    api.ensurePadsReady();
    const ctx = Dsp.ensureCtx();
    const p = pads[i];
    if (!p || !p.buffer) return null;
    const src = ctx.createBufferSource();
    src.buffer = p.buffer;
    src.playbackRate.value = Dsp.globalPitchRate();
    src.connect(Dsp.getPadGain(i));
    src.start(when || ctx.currentTime);
    api.onPadTriggered(i, when);
    return src;
  };

  return api;
})();
