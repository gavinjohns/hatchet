'use strict';
// Procedural ambience: filtered-noise wind / rain / shore / fire, thunder bursts,
// footstep ticks. Everything is synthesized — no assets, no autoplay violations
// (started on the first key press, which also dismisses the title).
G.Audio = (() => {
  let ac = null, master = null, noiseBuf = null, started = false;
  let wind, rain, water, fire;
  let crackleT = 0;

  function makeNoise() {
    const len = ac.sampleRate * 2;
    const b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function chain(freq, type, q) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type || 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.8;
    const g = ac.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(master); s.start();
    return { f, g };
  }

  function start() {
    if (started) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    started = true;
    master = ac.createGain();
    master.gain.value = 0.0;
    master.connect(ac.destination);
    noiseBuf = makeNoise();
    wind = chain(300, 'lowpass');
    rain = chain(2600, 'bandpass', 0.5);
    water = chain(850, 'bandpass', 0.9);
    fire = chain(1100, 'bandpass', 0.5);
    master.gain.linearRampToValueAtTime(0.85, ac.currentTime + 2.5);
  }

  function pop(freq, vol, dur = 0.04, type = 'bandpass') {
    if (!started) return;
    const s = ac.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = 1.8;
    const g = ac.createGain();
    const t = ac.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.1);
  }

  function update(dt, s) {
    if (!started) return;
    const t = ac.currentTime;
    const set = (n, v) => n.g.gain.setTargetAtTime(v, t, 0.3);
    set(wind, 0.05 + s.storm * 0.20 + s.gust * 0.28);
    wind.f.frequency.setTargetAtTime(230 + s.gust * 520 + s.storm * 150, t, 0.3);
    set(rain, s.rain * 0.15 * (s.sheltered ? 0.25 : 1));
    set(water, s.water * 0.055);
    set(fire, s.fire * 0.09);
    if (s.fire > 0.05) {
      crackleT -= dt;
      if (crackleT <= 0) {
        crackleT = 0.05 + Math.random() * 0.3;
        pop(600 + Math.random() * 2600, 0.05 * s.fire * (0.4 + Math.random()), 0.03);
      }
    }
  }

  function thunder() {
    if (!started) return;
    const s = ac.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 110;
    const g = ac.createGain();
    const t = ac.currentTime + 0.5 + Math.random() * 1.0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + 3);
  }

  const creak = () => pop(170, 0.22, 0.55, 'bandpass');
  const thud = () => pop(85, 0.4, 0.28, 'lowpass');
  const splash = () => pop(1400, 0.18, 0.18, 'bandpass');
  const step = (mat) => {
    if (mat === 'water') pop(1500, 0.08, 0.09);
    else if (mat === 'rock') pop(1200, 0.035, 0.025);
    else pop(850, 0.04, 0.03);
  };

  return { start, update, thunder, creak, thud, splash, step, get started() { return started; } };
})();
