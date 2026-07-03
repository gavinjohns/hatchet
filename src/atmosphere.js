'use strict';
// Weather as a pressure curve over the journey, plus every airborne particle:
// rain, mist, streaming needles on gust cues, embers, smoke, breath vapor.
// Gusts always telegraph ~1s before they push.
G.Atmos = (() => {
  const U = G.U, W = G.World;

  // storm intensity by position: calm dawn -> front builds over the shore ->
  // occluded at the overhang -> gone by night
  function stormAt(x) {
    return U.smoothstep(3550, 4400, x) * (1 - U.smoothstep(6900, 7500, x));
  }
  function nightAt(x) { return U.smoothstep(7250, 8300, x); }
  function dawnAt(x) { return 1 - U.smoothstep(1400, 3400, x); }

  // ---- gusts -----------------------------------------------------------
  const gust = { phase: 'calm', t: 0, next: 5, force: 0, cue: 0 };
  function gustZone(x) {
    if (x > 2450 && x < 3550) return 0.55;  // on the log: milder
    if (x > 3550 && x < 6600) return 1.0;   // storm shore: full
    return 0;
  }
  function updateGust(dt, px, rng) {
    const zone = gustZone(px);
    gust.t += dt;
    if (gust.phase === 'calm') {
      gust.force = 0; gust.cue = 0;
      if (zone > 0 && gust.t > gust.next) { gust.phase = 'cue'; gust.t = 0; }
    } else if (gust.phase === 'cue') {
      gust.cue = Math.min(1, gust.t / 0.3);
      gust.force = 0;
      if (gust.t > 1.0) { gust.phase = 'blow'; gust.t = 0; }
    } else {
      const env = Math.sin(Math.min(1, gust.t / 1.7) * Math.PI);
      gust.force = -env * (110 + rng() * 50) * zone; // pushes against travel
      gust.cue = env;
      if (gust.t > 1.7) { gust.phase = 'calm'; gust.t = 0; gust.next = 4 + rng() * 4; }
    }
    if (zone === 0) { gust.phase = 'calm'; gust.force = 0; gust.cue = 0; }
  }

  // ---- lightning -------------------------------------------------------
  const bolt = { flash: 0, next: 6 };
  function updateBolt(dt, storm, rng) {
    bolt.flash = Math.max(0, bolt.flash - dt * 2.2);
    if (storm > 0.7) {
      bolt.next -= dt;
      if (bolt.next <= 0) {
        bolt.flash = 1;
        bolt.next = 7 + rng() * 8;
        G.Audio.thunder();
      }
    }
  }

  // ---- particles -------------------------------------------------------
  const rng = U.mulberry(7);
  const rain = [];   // screen space
  const debris = []; // world space, gust-cue needles/leaves
  const embers = [];
  const smoke = [];
  const breath = [];
  let breathT = 0;

  function spawnDebris(px, n) {
    for (let i = 0; i < n; i++) {
      debris.push({
        x: px + 200 + rng() * 500, y: W.groundY(px) - 40 - rng() * 200,
        vx: -(220 + rng() * 200), vy: 20 + rng() * 50, life: 1.4 + rng() * 0.8,
      });
    }
  }
  function spawnAt(list, o) { list.push(o); }

  function update(dt, P, state) {
    const px = P.x;
    const storm = stormAt(px);
    updateGust(dt, px, rng);
    updateBolt(dt, storm, rng);

    // gust cue: needles stream through the frame before the push lands
    if (gust.phase === 'cue' && rng() < dt * 30) spawnDebris(px, 2);
    if (gust.phase === 'blow' && rng() < dt * 18) spawnDebris(px, 1);

    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.x += d.vx * dt; d.y += d.vy * dt + Math.sin(d.x * 0.05) * 20 * dt;
      d.life -= dt;
      if (d.life <= 0) debris.splice(i, 1);
    }

    // fire particles
    const f = W.FIRE, fg = W.groundY(f.x);
    if (state.fireLit && Math.abs(px - f.x) < 700) {
      if (rng() < dt * 26) spawnAt(embers, {
        x: f.x + (rng() - 0.5) * 8, y: fg - 6, vx: (rng() - 0.5) * 12,
        vy: -(26 + rng() * 34), life: 1.2 + rng() * 1.6, r: 0.8 + rng() * 1.2,
      });
      if (rng() < dt * 7) spawnAt(smoke, {
        x: f.x + (rng() - 0.5) * 6, y: fg - 14, vx: (rng() - 0.5) * 6 + 4,
        vy: -(12 + rng() * 10), life: 3 + rng() * 3, r: 3 + rng() * 3,
      });
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += (e.vx + Math.sin(e.y * 0.08) * 8) * dt; e.y += e.vy * dt;
      e.life -= dt; if (e.life <= 0) embers.splice(i, 1);
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 3;
      s.life -= dt; if (s.life <= 0) smoke.splice(i, 1);
    }

    // breath vapor when cold and idle-ish
    breathT -= dt;
    const coldAir = Math.max(nightAt(px), storm * 0.7, P.exposure);
    if (coldAir > 0.45 && breathT <= 0 && Math.abs(P.vx) < 60 && P.state !== 'sit') {
      breathT = 2.4 + rng() * 1.4;
      spawnAt(breath, {
        x: px + P.facing * 5, y: P.y - 32, vx: P.facing * 7, vy: -5,
        life: 1.3, r: 1.6,
      });
    }
    for (let i = breath.length - 1; i >= 0; i--) {
      const b = breath[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.r += dt * 4;
      b.life -= dt; if (b.life <= 0) breath.splice(i, 1);
    }

    return {
      storm,
      night: nightAt(px),
      dawn: dawnAt(px),
      gustForce: gust.force,
      gustCue: gust.cue,
      flash: bolt.flash,
      wind: storm * 26 + Math.abs(gust.force),
    };
  }

  // rain is screen-space; count follows storm, occlusion follows shelter
  function drawRain(ctx, w, h, storm, wind, sheltered, night) {
    const n = Math.floor(storm * 240 * (sheltered ? 0.15 : 1));
    if (n <= 0) { rain.length = 0; return; }
    while (rain.length < n) rain.push({ x: Math.random() * w, y: Math.random() * h, s: 0.6 + Math.random() * 0.6 });
    if (rain.length > n) rain.length = n;
    ctx.save();
    ctx.strokeStyle = night > 0.5 ? 'rgba(190,215,210,0.20)' : 'rgba(220,235,230,0.26)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of rain) {
      d.y += (760 * d.s) * (1 / 60);
      d.x += (-wind * 2.4 * d.s) * (1 / 60);
      if (d.y > h) { d.y = -10; d.x = Math.random() * w; }
      if (d.x < -20) d.x = w + 10;
      const dx = -wind * 0.035 * d.s, dy = 11 * d.s;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + dx, d.y + dy);
    }
    ctx.stroke();
    ctx.restore();
  }

  return { update, drawRain, debris, embers, smoke, breath, gust, bolt, stormAt, nightAt, dawnAt };
})();
