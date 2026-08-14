/* ============================================================
   dsp-chain.js — the mixer.
   Owns the AudioContext and the entire signal graph: per-pad gain
   modules -> 3-band EQ -> parallel dry/wet distortion -> master
   gain -> speakers + recorder tap + meter tap.
   This is the ONLY module that creates the AudioContext. Every
   other engine module asks this one for it.
   ============================================================ */
window.U9 = window.U9 || {};

U9.DspChain = (function () {
  const PAD_COUNT = 9;
  const api = {};

  let ctx = null;
  let lowShelf, midPeak, highShelf, distNode, distDry, distWet, masterGain, recDest, meterAnalyser;
  let padGains = [];

  let globalPitchSemis = 0;
  let distMix = 100;
  let distAmount = 0;
  let volumeVal = 80;
  const knobState = { low: 0, mid: 0, high: 0 };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function makeDistortionCurve(amount) { // amount 0..100
    const k = amount * 8;
    const n = 8192;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = i * 2 / n - 1;
      curve[i] = k <= 0 ? x : (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  api.ensureCtx = function () {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();

      lowShelf = ctx.createBiquadFilter(); lowShelf.type = 'lowshelf'; lowShelf.frequency.value = 200;
      midPeak = ctx.createBiquadFilter(); midPeak.type = 'peaking'; midPeak.frequency.value = 1000; midPeak.Q.value = 0.9;
      highShelf = ctx.createBiquadFilter(); highShelf.type = 'highshelf'; highShelf.frequency.value = 4000;

      distNode = ctx.createWaveShaper(); distNode.oversample = '4x'; distNode.curve = null;
      distDry = ctx.createGain(); distDry.gain.value = 0.0;
      distWet = ctx.createGain(); distWet.gain.value = 1.0;

      masterGain = ctx.createGain(); masterGain.gain.value = volumeVal / 100;
      recDest = ctx.createMediaStreamDestination();
      meterAnalyser = ctx.createAnalyser();
      meterAnalyser.fftSize = 512;
      meterAnalyser.smoothingTimeConstant = 0;

      padGains = [];
      for (let i = 0; i < PAD_COUNT; i++) {
        const g = ctx.createGain(); g.gain.value = 1.0;
        g.connect(lowShelf);
        padGains.push(g);
      }

      lowShelf.connect(midPeak); midPeak.connect(highShelf);
      highShelf.connect(distDry); highShelf.connect(distNode); distNode.connect(distWet);
      distDry.connect(masterGain); distWet.connect(masterGain);
      masterGain.connect(ctx.destination);
      masterGain.connect(recDest);
      masterGain.connect(meterAnalyser);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  api.PAD_COUNT = PAD_COUNT;
  api.getPadGain = function (i) { api.ensureCtx(); return padGains[i]; };
  api.getLowShelfInput = function () { api.ensureCtx(); return lowShelf; };
  api.getRecDest = function () { api.ensureCtx(); return recDest; };
  api.getMeterAnalyser = function () { api.ensureCtx(); return meterAnalyser; };

  api.globalPitchRate = function () { return Math.pow(2, globalPitchSemis / 12); };

  // Every setter below touches the audio graph, which means every one
  // of them calls ensureCtx(). If the AudioContext genuinely can't be
  // constructed in this environment, ensureCtx() keeps throwing on
  // every retry — and an uncaught throw here would stop UI modules
  // like KnobsPanel/TransportUI from finishing init() (same class of
  // bug as the boot.js fix). safeSetCtx() isolates that: the knob
  // value itself is still tracked in knobState so the UI stays in
  // sync, only the live audio-graph update is skipped when audio
  // isn't available yet.
  function safeSetCtx(fn) {
    try { api.ensureCtx(); fn(); } catch (err) { /* audio unavailable; UI state above is already updated */ }
  }

  api.setLow = function (v) { v = clamp(v, -12, 12); knobState.low = v; safeSetCtx(() => lowShelf.gain.setTargetAtTime(v, ctx.currentTime, 0.01)); return v; };
  api.setMid = function (v) { v = clamp(v, -12, 12); knobState.mid = v; safeSetCtx(() => midPeak.gain.setTargetAtTime(v, ctx.currentTime, 0.01)); return v; };
  api.setHigh = function (v) { v = clamp(v, -12, 12); knobState.high = v; safeSetCtx(() => highShelf.gain.setTargetAtTime(v, ctx.currentTime, 0.01)); return v; };
  api.setPitch = function (v) { v = clamp(v, -12, 12); globalPitchSemis = v; return v; };
  api.setDistAmount = function (v) {
    v = clamp(v, 0, 100); distAmount = v;
    safeSetCtx(() => { distNode.curve = v <= 0 ? null : makeDistortionCurve(v); });
    return v;
  };
  api.setDistMix = function (v) {
    v = clamp(v, 0, 100); distMix = v;
    safeSetCtx(() => {
      const t = ctx.currentTime;
      distDry.gain.setTargetAtTime(1 - v / 100, t, 0.01);
      distWet.gain.setTargetAtTime(v / 100, t, 0.01);
    });
    return v;
  };
  api.setVolume = function (v) {
    v = clamp(v, 0, 100); volumeVal = v;
    safeSetCtx(() => masterGain.gain.setTargetAtTime(v / 100, ctx.currentTime, 0.01));
    return v;
  };
  api.getKnobState = function () {
    return { low: knobState.low, mid: knobState.mid, high: knobState.high, pitch: globalPitchSemis, distAmount, distMix, volume: volumeVal };
  };

  return api;
})();
