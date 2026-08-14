/* ============================================================
   midi-learn.js — MIDI Learn for pads, knobs, and sliders.

   Uses the Web MIDI API (supported in Chrome/Edge/Opera; NOT in
   Safari or Firefox without a flag). Lets the person click
   "MIDI LEARN", click any pad, knob, or slider, then move a
   control on their connected MIDI device to bind that note/CC to
   it. Mappings persist across reloads via localStorage
   (best-effort — falls back to in-memory-only if storage isn't
   available, same defensive pattern as the rest of the app).

   Design notes:
   - This module never touches pad/knob/slider internals directly.
     It calls Engine.playPad(), KnobsPanel.setByName(), and
     TransportUI.setVolume()/setTempo() — the same public surface
     everything else in the app uses — so it can't drift out of
     sync with how those controls actually work.
   - Arming a target for learning is done via ONE delegated
     pointerdown listener on `document`, registered in the
     capturing phase. That's the only way to reliably intercept a
     click on a pad/knob/slider BEFORE that control's own listener
     fires, regardless of registration order: capturing-phase
     listeners on an ANCESTOR always run before any listener
     (capturing or bubbling) registered directly on the target
     itself. Listening on the same element wouldn't guarantee that.
   ============================================================ */
window.U9 = window.U9 || {};

U9.MidiLearn = (function () {
  const STORAGE_KEY = 'unit9-midi-map-v1';
  const KNOB_ID_TO_NAME = { knobLow: 'low', knobMid: 'mid', knobHigh: 'high', knobPitch: 'pitch', knobDist: 'dist', knobMix: 'mix' };
  const KNOB_LABELS = { knobLow: 'Low EQ', knobMid: 'Mid EQ', knobHigh: 'High EQ', knobPitch: 'Pitch', knobDist: 'Distortion', knobMix: 'Dist Mix' };

  const api = {};

  let available = false;
  let learnModeOn = false;
  let pendingKey = null;
  let midiAccess = null;

  let mappings = {};   // targetKey -> "kind:channel:number"
  let bySignature = {}; // signature -> targetKey (kept in sync with mappings)
  let targets = {};    // targetKey -> { label, apply(value0to127) }

  let btnLearn, btnClear, statusEl;

  // ---------------- persistence ----------------
  function loadMappings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      mappings = raw ? (JSON.parse(raw) || {}) : {};
    } catch (err) { mappings = {}; }
    bySignature = {};
    Object.keys(mappings).forEach((key) => { bySignature[mappings[key]] = key; });
  }
  function saveMappings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings)); }
    catch (err) { /* storage unavailable (private mode, quota, etc.) — mappings stay in-memory only */ }
  }
  function setMapping(targetKey, signature) {
    const prevKeyForThisSignature = bySignature[signature];
    if (prevKeyForThisSignature && prevKeyForThisSignature !== targetKey) delete mappings[prevKeyForThisSignature];
    const prevSignatureForThisTarget = mappings[targetKey];
    if (prevSignatureForThisTarget) delete bySignature[prevSignatureForThisTarget];
    mappings[targetKey] = signature;
    bySignature[signature] = targetKey;
    saveMappings();
    refreshMappedHighlights();
  }
  function clearAllMappings() {
    mappings = {}; bySignature = {};
    saveMappings();
    refreshMappedHighlights();
  }

  // ---------------- target registry ----------------
  function buildTargets() {
    targets = {};
    Object.keys(KNOB_LABELS).forEach((id) => {
      targets[id] = {
        label: KNOB_LABELS[id],
        apply(v) { U9.KnobsPanel.setByName(KNOB_ID_TO_NAME[id], v / 127); }
      };
    });
    for (let i = 0; i < U9.Engine.PAD_COUNT; i++) {
      targets['pad' + i] = { label: 'Pad ' + (i + 1), apply() { U9.Engine.playPad(i); } };
    }
    targets.volFader = { label: 'Volume', apply(v) { U9.TransportUI.setVolume(Math.round((v / 127) * 100)); } };
    targets.tempoFader = { label: 'Tempo', apply(v) { U9.TransportUI.setTempo(Math.round(60 + (v / 127) * 140)); } };
  }

  function getTargetElement(targetKey) {
    if (targetKey.indexOf('pad') === 0) {
      return document.querySelector('.pad[data-i="' + targetKey.slice(3) + '"] .pad-body');
    }
    return document.getElementById(targetKey);
  }

  // ---------------- UI feedback ----------------
  function setStatus(text) { if (statusEl) statusEl.textContent = text; }

  function describeSignature(sig) {
    const parts = sig.split(':');
    const kind = parts[0], ch = parts[1], num = parts[2];
    return (kind === 'note' ? 'Note ' : 'CC ') + num + ' (ch ' + (parseInt(ch, 10) + 1) + ')';
  }

  function toggleArmableHighlight(on) {
    Object.keys(targets).forEach((key) => {
      const el = getTargetElement(key);
      if (el) el.classList.toggle('midi-armable', on);
    });
  }

  function refreshMappedHighlights() {
    Object.keys(targets).forEach((key) => {
      const el = getTargetElement(key);
      if (el) el.classList.toggle('midi-mapped', !!mappings[key]);
    });
  }

  function clearPendingHighlight() {
    if (pendingKey) {
      const el = getTargetElement(pendingKey);
      if (el) el.classList.remove('midi-pending');
    }
  }

  // ---------------- learn workflow ----------------
  function armTarget(key) {
    clearPendingHighlight();
    pendingKey = key;
    if (key) {
      const el = getTargetElement(key);
      if (el) el.classList.add('midi-pending');
      setStatus('Move a control on your MIDI device to map "' + targets[key].label + '" \u2026 (click it again to cancel)');
    } else if (learnModeOn) {
      setStatus(available ? 'MIDI LEARN on \u2014 click a pad, knob, or slider to map it.' : 'MIDI LEARN on, but Web MIDI isn\'t supported in this browser.');
    }
  }

  function setLearnMode(on) {
    learnModeOn = on;
    btnLearn.classList.toggle('active', on);
    toggleArmableHighlight(on);
    armTarget(null);
    if (!on) setStatus('\u00A0');
  }

  function onCapturePointerDown(e) {
    if (!learnModeOn) return;

    let targetKey = null;
    const padBody = e.target.closest && e.target.closest('.pad-body');
    if (padBody) {
      const padEl = padBody.closest('.pad');
      if (padEl) targetKey = 'pad' + padEl.dataset.i;
    }
    if (!targetKey) {
      const knobEl = e.target.closest && e.target.closest('.knob');
      if (knobEl && targets[knobEl.id]) targetKey = knobEl.id;
    }
    if (!targetKey) {
      const rangeEl = e.target.closest && e.target.closest('input[type=range]');
      if (rangeEl && targets[rangeEl.id]) targetKey = rangeEl.id;
    }

    // Not a learnable control (e.g. transport buttons, LOAD SAMPLE, record
    // button) — let it through untouched so the rest of the UI keeps
    // working normally even while MIDI LEARN is on.
    if (!targetKey) return;

    e.preventDefault();
    e.stopPropagation();
    armTarget(targetKey === pendingKey ? null : targetKey);
  }

  // ---------------- Web MIDI plumbing ----------------
  function parseMessage(data) {
    const statusByte = data[0] & 0xF0;
    const channel = data[0] & 0x0F;
    if (statusByte === 0x90 && data[2] > 0) return { kind: 'note', channel, number: data[1], value: data[2] };
    if (statusByte === 0xB0) return { kind: 'cc', channel, number: data[1], value: data[2] };
    return null; // ignore note-off, velocity-0 note-on, pitch bend, aftertouch, etc. for v1
  }

  function handleMessage(e) {
    const msg = parseMessage(e.data);
    if (!msg) return;
    const sig = msg.kind + ':' + msg.channel + ':' + msg.number;

    if (learnModeOn && pendingKey) {
      const label = targets[pendingKey].label;
      setMapping(pendingKey, sig);
      clearPendingHighlight();
      pendingKey = null;
      setStatus('Mapped "' + label + '" to ' + describeSignature(sig) + '. Click another control, or toggle MIDI LEARN off when done.');
      return;
    }

    const targetKey = bySignature[sig];
    if (targetKey && targets[targetKey]) targets[targetKey].apply(msg.value);
  }

  function attachInputs() {
    if (!midiAccess) return;
    midiAccess.inputs.forEach((input) => { input.onmidimessage = handleMessage; });
    setStatus(learnModeOn
      ? (pendingKey ? statusEl.textContent : 'MIDI LEARN on \u2014 click a pad, knob, or slider to map it.')
      : 'MIDI ready \u2014 ' + Array.from(midiAccess.inputs.values()).length + ' device(s) connected.');
  }

  // ---------------- init ----------------
  function init() {
    btnLearn = document.getElementById('btnMidiLearn');
    btnClear = document.getElementById('btnMidiClear');
    statusEl = document.getElementById('midiStatus');

    buildTargets();
    loadMappings();
    refreshMappedHighlights();

    btnLearn.addEventListener('click', () => setLearnMode(!learnModeOn));
    btnClear.addEventListener('click', () => {
      if (learnModeOn) setLearnMode(false);
      clearAllMappings();
      setStatus('MIDI map cleared.');
    });
    document.addEventListener('pointerdown', onCapturePointerDown, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && learnModeOn) setLearnMode(false); });

    if (!navigator.requestMIDIAccess) {
      available = false;
      btnLearn.disabled = true;
      setStatus('Web MIDI isn\'t supported in this browser (try Chrome, Edge, or Opera).');
      return;
    }

    navigator.requestMIDIAccess({ sysex: false }).then((access) => {
      midiAccess = access;
      available = true;
      attachInputs();
      midiAccess.onstatechange = attachInputs;
    }).catch(() => {
      available = false;
      setStatus('MIDI access was blocked or unavailable.');
    });
  }

  api.init = init;
  return api;
})();
