/* ============================================================
   knob.js — one reusable rotary-knob widget.
   ============================================================ */
window.U9 = window.U9 || {};

U9.Knob = {
  create(el, opts) {
    const min = opts.min, max = opts.max;
    const sensitivity = opts.sensitivity || 0.15;
    const initial = opts.value !== undefined ? opts.value : min;
    let value = initial;
    let dragging = false, startY = 0, startVal = 0;

    function clamp(v) { return Math.max(min, Math.min(max, v)); }

    function render() {
      const pct = (value - min) / (max - min);
      el.style.setProperty('--rot', (pct * 180 - 90) + 'deg');
      if (opts.onChange) opts.onChange(value);
    }

    function set(v) { value = clamp(v); render(); }

    el.addEventListener('pointerdown', (e) => {
      dragging = true; startY = e.clientY; startVal = value;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      set(startVal + (startY - e.clientY) * sensitivity);
    });
    el.addEventListener('pointerup', () => { dragging = false; });
    el.addEventListener('pointercancel', () => { dragging = false; });
    el.addEventListener('dblclick', () => set(initial));

    set(value);
    return { set, get: () => value };
  }
};
