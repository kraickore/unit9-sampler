/* ============================================================
   recorder-engine.js — the loop recorder.
   Captures whatever's coming out of U9.DspChain's master bus via
   MediaRecorder, for up to N seconds, and hands back a decoded
   AudioBuffer. No knowledge of pads, sequencer, or the DOM.
   ============================================================ */
window.U9 = window.U9 || {};

U9.RecorderEngine = (function () {
  const Dsp = U9.DspChain;
  const api = {};

  let recorder = null, recChunks = [], recording = false, autoStopTO = null;

  function pickMimeType() {
    const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''];
    for (const t of options)
      if (t === '' || (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t))) return t;
    return '';
  }

  api.startRecording = function (seconds, onDone, onTick) {
    let ctx;
    try { ctx = Dsp.ensureCtx(); }
    catch (err) { if (onDone) onDone(null, 'Audio isn\'t available yet — try again in a moment.'); return; }
    if (!window.MediaRecorder) { if (onDone) onDone(null, 'This browser doesn\'t support recording (MediaRecorder unavailable).'); return; }
    if (recording) return;
    const mime = pickMimeType();
    try {
      recorder = mime ? new MediaRecorder(Dsp.getRecDest().stream, { mimeType: mime }) : new MediaRecorder(Dsp.getRecDest().stream);
    } catch (err) { if (onDone) onDone(null, 'Could not start recording: ' + err.message); return; }

    recChunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recChunks.push(e.data); };
    const startTs = performance.now();
    let tickIV = null;
    if (onTick) tickIV = setInterval(() => onTick((performance.now() - startTs) / 1000), 200);

    recorder.onstop = async () => {
      if (tickIV) clearInterval(tickIV);
      try {
        const blob = new Blob(recChunks, { type: recorder.mimeType || 'audio/webm' });
        const arr = await blob.arrayBuffer();
        ctx.decodeAudioData(arr, (buf) => { if (onDone) onDone(buf, null); }, () => { if (onDone) onDone(null, 'Could not decode the recording.'); });
      } catch (err) {
        if (onDone) onDone(null, 'Recording error: ' + err.message);
      }
    };

    recorder.start();
    recording = true;
    autoStopTO = setTimeout(() => api.stopRecording(), seconds * 1000);
  };

  api.stopRecording = function () {
    if (!recording) return;
    recording = false;
    clearTimeout(autoStopTO);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };
  api.isRecording = function () { return recording; };

  return api;
})();
