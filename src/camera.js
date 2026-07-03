'use strict';
// Authored camera zones — wide where the player should feel small, tight where
// the surface underfoot matters. Everything blends and damps; the only scripted
// move is the end pull-back at the fire.
G.Camera = (() => {
  const U = G.U, W = G.World;

  const ZONES = [
    { x0: -1e9, x1: 2450, zoom: 1.04, dy: -34, look: 80 },   // forest approach
    { x0: 2450, x1: 3550, zoom: 1.16, dy: -60, look: 55 },   // the log
    { x0: 3550, x1: 6450, zoom: 0.84, dy: -26, look: 115 },  // storm shore, widest
    { x0: 6450, x1: 7350, zoom: 1.20, dy: -44, look: 50 },   // overhang, intimate
    { x0: 7350, x1: 8900, zoom: 0.86, dy: -28, look: 100 },  // night shore, wide
    { x0: 8900, x1: 1e9, zoom: 1.02, dy: -36, look: 70 },    // fire approach
  ];

  const cam = { x: 120, y: 260, zoom: 1.0, shake: 0 };
  let override = null; // {zoom, dy, blend}

  function targetFor(px) {
    let zoom = 0, dy = 0, look = 0, wsum = 0;
    const m = 300;
    for (const z of ZONES) {
      const w = U.smoothstep(z.x0 - m, z.x0 + m, px) * (1 - U.smoothstep(z.x1 - m, z.x1 + m, px));
      if (w > 0) { zoom += z.zoom * w; dy += z.dy * w; look += z.look * w; wsum += w; }
    }
    if (wsum <= 0) return { zoom: 1, dy: -34, look: 80 };
    return { zoom: zoom / wsum, dy: dy / wsum, look: look / wsum };
  }

  function update(dt, P, t) {
    let tg = targetFor(P.x);
    // ground focus: smoothed terrain, but never dive down a cliff/ravine —
    // frame the surface the player is on
    const gRaw = (W.groundY(P.x - 60) + W.groundY(P.x) * 2 + W.groundY(P.x + 140)) / 4;
    let g = Math.min(gRaw, P.y + 80);
    if (P.onLog) g = P.y + 24;
    let fy = Math.min(g, P.y * 0.35 + g * 0.65) + tg.dy;
    let fx = P.x + P.facing * tg.look;
    let zt = tg.zoom;

    if (override) {
      override.blend = Math.min(1, override.blend + dt * 0.14);
      const b = U.smooth(override.blend);
      zt = U.lerp(zt, override.zoom, b);
      fy = U.lerp(fy, fy + override.dy, b);
      fx = U.lerp(fx, P.x + 30, b);
    }

    cam.x += (fx - cam.x) * Math.min(1, dt * 2.6);
    cam.y += (fy - cam.y) * Math.min(1, dt * 1.9);
    cam.zoom += (zt - cam.zoom) * Math.min(1, dt * 1.1);
    cam.shake = Math.max(0, cam.shake - dt * 3);
  }

  function endPull() { if (!override) override = { zoom: 0.55, dy: -70, blend: 0 }; }
  function reset() { override = null; }
  function kick(v) { cam.shake = Math.min(1, cam.shake + v); }

  return { cam, update, endPull, reset, kick };
})();
