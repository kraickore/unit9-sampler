/* ============================================================
   transport-ui.js — play/stop/loop, volume + output meter, tempo.
   ============================================================ */
window.U9 = window.U9 || {};

U9.TransportUI = (function () {
  const Engine = U9.Engine;
  let btnPlay, btnStop, btnLoop, volFader, volVal, meterFill, tempoFader, tempoNum;
  let meterLevel = 0, meterData = null;

  function setVolume(v) {
    v = Engine.setVolume(v);
    volFader.value = v;
    volVal.textContent = Math.round(v);
  }

  function setTempo(v) {
    v = Engine.setTempo(v);
    tempoFader.value = v;
    tempoNum.textContent = v;
  }

  function setLoop(on) {
    Engine.setLooping(on);
    btnLoop.classList.toggle('active', on);
  }

  function tickMeter() {
    // Guard the whole body: if anything here throws (e.g. ensureCtx()
    // failing), the requestAnimationFrame(tickMeter) call at the bottom
    // would never run and the meter would silently die forever, since
    // nothing else re-arms this loop.
    try {
      const analyser = Engine.getMeterAnalyser();
      if (analyser) {
        if (!meterData) meterData = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(meterData);
        let peak = 0;
        for (let i = 0; i < meterData.length; i++) {
          const v = Math.abs(meterData[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        const target = Math.min(100, peak * 135);
        meterLevel = target > meterLevel ? target : Math.max(0, meterLevel - 2.5);
        meterFill.style.height = meterLevel + '%';
        const color = meterLevel > 90 ? '#ff2222' : meterLevel > 70 ? '#ffb000' : '#39ff14';
        meterFill.style.color = color;
        meterFill.style.background = color;
      }
    } catch (err) { /* audio not available yet; retry next frame */ }
    requestAnimationFrame(tickMeter);
  }

  function togglePlay() {
    if (Engine.isPlaying()) { Engine.stop(); } else { Engine.play(); btnPlay.classList.add('active'); }
  }

  function onStopped() { btnPlay.classList.remove('active'); }

  function init() {
    btnPlay = document.getElementById('btnPlay');
    btnStop = document.getElementById('btnStop');
    btnLoop = document.getElementById('btnLoop');
    volFader = document.getElementById('volFader');
    volVal = document.getElementById('volVal');
    meterFill = document.getElementById('meterFill');
    tempoFader = document.getElementById('tempoFader');
    tempoNum = document.getElementById('tempoNum');

    btnPlay.addEventListener('click', togglePlay);
    btnStop.addEventListener('click', () => Engine.stop());
    btnLoop.addEventListener('click', () => setLoop(!Engine.isLooping()));
    setLoop(true);

    volFader.addEventListener('input', () => setVolume(parseInt(volFader.value, 10)));
    setVolume(80);

    tempoFader.addEventListener('input', () => setTempo(parseInt(tempoFader.value, 10)));
    setTempo(120);

    requestAnimationFrame(tickMeter);
  }

  return { init, setVolume, setTempo, setLoop, onStopped, togglePlay };
})();
