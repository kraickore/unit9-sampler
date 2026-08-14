/* ============================================================
   project-storage.js — Save/Load Project, samples included.
   ============================================================ */
window.U9 = window.U9 || {};

U9.ProjectStorage = (function () {
  const Engine = U9.Engine;
  let statusEl;

  function audioBufferToWavBlob(buffer) {
    const numCh = buffer.numberOfChannels;
    const sr = buffer.sampleRate;
    const len = buffer.length;
    const blockAlign = numCh * 2;
    const dataSize = len * blockAlign;
    const arrBuf = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrBuf);
    function writeStr(offset, str) { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true); view.setUint32(24, sr, true);
    view.setUint32(28, sr * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true);
    writeStr(36, 'data'); view.setUint32(40, dataSize, true);
    const chData = []; for (let ch = 0; ch < numCh; ch++) chData.push(buffer.getChannelData(ch));
    let offset = 44;
    for (let i = 0; i < len; i++)
      for (let ch = 0; ch < numCh; ch++) {
        let s = Math.max(-1, Math.min(1, chData[ch][i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset, s, true);
        offset += 2;
      }
    return new Blob([view], { type: 'audio/wav' });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function save() {
    Engine.ensureCtx();
    statusEl.textContent = 'Encoding samples…';

    const padData = [];
    Engine.getAllPads().forEach((p, i) => {
      if (p && p.buffer) padData.push({ index: i, name: p.name });
    });
    for (const pd of padData) {
      const p = Engine.getPad(pd.index);
      pd.audio = await blobToBase64(audioBufferToWavBlob(p.buffer));
    }

    const presetData = [];
    for (const preset of U9.RecorderUI.getPresets()) {
      presetData.push({ name: preset.name, audio: await blobToBase64(audioBufferToWavBlob(preset.buffer)) });
    }

    const project = {
      type: 'unit9-project', version: 1,
      pads: padData,
      presets: presetData,
      knobs: Engine.getKnobState(),
      loop: Engine.isLooping(),
      tempo: Engine.getTempo(),
      sequencer: Engine.getGrid()
    };

    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'unit9-project.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    statusEl.textContent = 'Saved · ' + padData.length + ' samples, ' + presetData.length + ' loops';
  }

  async function load(file) {
    statusEl.textContent = 'Loading…';
    try {
      const project = JSON.parse(await file.text());
      if (project.type !== 'unit9-project') throw new Error('not a UNIT-9 project file');

      for (const pd of project.pads) {
        const buf = await Engine.decodeAudio(base64ToArrayBuffer(pd.audio));
        Engine.setPad(pd.index, buf, pd.name);
      }
      U9.PadsUI.renderAll();

      const presets = [];
      for (const pr of (project.presets || [])) {
        presets.push({ name: pr.name, buffer: await Engine.decodeAudio(base64ToArrayBuffer(pr.audio)) });
      }
      U9.RecorderUI.setPresets(presets);

      U9.KnobsPanel.setAll(project.knobs);
      U9.TransportUI.setVolume(project.knobs && project.knobs.volume !== undefined ? project.knobs.volume : 80);
      U9.TransportUI.setTempo(project.tempo || 120);
      U9.TransportUI.setLoop(project.loop !== undefined ? project.loop : true);

      if (project.sequencer) { Engine.setGrid(project.sequencer); U9.SequencerUI.render(); }

      statusEl.textContent = 'Loaded · ' + project.pads.length + ' samples';
    } catch (err) {
      statusEl.textContent = 'Load failed: ' + err.message;
    }
  }

  function init() {
    statusEl = document.getElementById('projStatus');
    const fileInput = document.getElementById('projFileInput');
    document.getElementById('btnSaveProj').addEventListener('click', save);
    document.getElementById('btnLoadProj').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) load(f);
      e.target.value = '';
    });
  }

  return { init };
})();
