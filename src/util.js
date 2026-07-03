'use strict';
// Global namespace
window.G = window.G || {};

G.U = (() => {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const smoothstep = (a, b, x) => smooth((x - a) / (b - a));

  // Deterministic RNG so the forest is the same forest every run
  function mulberry(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function noiseMaker(seed) {
    const r = mulberry(seed);
    const perm = new Array(512).fill(0).map(() => r());
    return function (x) {
      const xi = Math.floor(x), xf = x - xi;
      const a = perm[((xi % 512) + 512) % 512];
      const b = perm[(((xi + 1) % 512) + 512) % 512];
      return lerp(a, b, smooth(xf));
    };
  }

  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  return { clamp, lerp, smooth, smoothstep, mulberry, noiseMaker, hex, mixc, css };
})();
