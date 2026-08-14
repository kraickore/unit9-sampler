/* ============================================================
   knobs-panel.js — Low/Mid/High/Pitch/Dist/Mix knobs.
   ============================================================ */
window.U9 = window.U9 || {};

U9.KnobsPanel = (function () {
  const Engine = U9.Engine;
  let knobs = {};

  function bind(id, valId, opts, engineSetter, format) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    const instance = U9.Knob.create(el, Object.assign({}, opts, {
      onChange(v) {
        valEl.textContent = format(v);
        engineSetter(v);
      }
    }));
    // Keep min/max alongside the instance so setByName() (used by MIDI
    // Learn) can turn a normalized 0..1 controller value into this knob's
    // actual range without knowing anything about EQ dB ranges vs. percent
    // ranges — that knowledge stays right here where the knob was defined.
    return { instance, min: opts.min, max: opts.max };
  }

  function init() {
    knobs.low = bind('knobLow', 'valLow', { min: -12, max: 12, value: 0, sensitivity: 0.15 },
      Engine.setLow, v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB');
    knobs.mid = bind('knobMid', 'valMid', { min: -12, max: 12, value: 0, sensitivity: 0.15 },
      Engine.setMid, v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB');
    knobs.high = bind('knobHigh', 'valHigh', { min: -12, max: 12, value: 0, sensitivity: 0.15 },
      Engine.setHigh, v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB');
    knobs.pitch = bind('knobPitch', 'valPitch', { min: -12, max: 12, value: 0, sensitivity: 0.15 },
      Engine.setPitch, v => (v > 0 ? '+' : '') + v.toFixed(1) + ' st');
    knobs.dist = bind('knobDist', 'valDist', { min: 0, max: 100, value: 0, sensitivity: 0.8 },
      Engine.setDistAmount, v => Math.round(v) + '%');
    knobs.mix = bind('knobMix', 'valMix', { min: 0, max: 100, value: 100, sensitivity: 0.8 },
      Engine.setDistMix, v => Math.round(v) + '%');
  }

  function setAll(k) {
    if (!k) return;
    knobs.low.instance.set(k.low || 0);
    knobs.mid.instance.set(k.mid || 0);
    knobs.high.instance.set(k.high || 0);
    knobs.pitch.instance.set(k.pitch || 0);
    knobs.dist.instance.set(k.distAmount !== undefined ? k.distAmount : (k.dist || 0));
    knobs.mix.instance.set(k.distMix !== undefined ? k.distMix : (k.mix !== undefined ? k.mix : 100));
  }

  // pct is 0..1 (e.g. straight from a MIDI CC value / 127). Scales into
  // this specific knob's own min/max before setting, so a MIDI Learn
  // module (or anything else) can drive any knob without needing to know
  // its range.
  function setByName(name, pct) {
    const k = knobs[name];
    if (!k) return;
    pct = Math.max(0, Math.min(1, pct));
    k.instance.set(k.min + pct * (k.max - k.min));
  }

  return { init, setAll, setByName };
})();
