'use strict';
// Director + game loop. States: title -> play -> end. Owns the triggers
// (falling limb, ravine falls, cold collapse, the fire) and the soft-fail
// respawn fades. Fixed-step simulation, rAF render.
(() => {
  const U = G.U, W = G.World, P = G.Player.P;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let vw = 0, vh = 0, dpr = 1;

  function resize() {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------- input
  const inp = { left: false, right: false, down: false, jump: false, jumpPressed: false };
  let anyKey = false;
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  };
  window.addEventListener('keydown', (e) => {
    if (KEYS[e.code] !== undefined) e.preventDefault();
    anyKey = true;
    const k = KEYS[e.code];
    if (k) {
      if (k === 'jump' && !inp.jump) inp.jumpPressed = true;
      inp[k] = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYS[e.code];
    if (k) inp[k] = false;
  });
  // a click/tap also dismisses the title (and focuses the page in embeds)
  window.addEventListener('pointerdown', () => { anyKey = true; });

  // ------------------------------------------------------------- state
  const st = {
    mode: 'title', // title | play | end
    t: 0,
    respawnFade: 0, respawning: false, respawnT: 0,
    endFade: 0, endT: 0,
    sheltered: false,
    fireLit: true, // the ring waits, already burning low — someone was here before
    branch: { phase: 'idle', y: 0, rot: 0, t: 0 },
  };

  // dev spawn: ?x=5000
  const qx = parseFloat(new URLSearchParams(location.search).get('x'));
  if (!isNaN(qx)) G.Player.reset(qx); else G.Player.reset(120);

  const titleEl = document.getElementById('title');
  const endEl = document.getElementById('end');

  function beginPlay() {
    st.mode = 'play';
    titleEl.classList.add('gone');
    G.Audio.start();
  }

  function respawn() {
    if (st.respawning) return;
    st.respawning = true;
    st.respawnT = 0;
  }

  // ------------------------------------------------------------- update
  function update(dt) {
    st.t += dt;

    if (st.mode === 'title') {
      if (anyKey) beginPlay();
      anyKey = false;
      return;
    }

    const env = G.Atmos.update(dt, P, st);

    // shelter test: under a ceiling = dry
    st.sheltered = W.ceilingY(P.x) !== null;

    const nearFire = st.fireLit && Math.abs(P.x - W.FIRE.x) < 90;

    if (st.mode === 'play' && !st.respawning) {
      G.Player.update(dt, inp, {
        gustForce: P.onLog || env.storm > 0.1 ? env.gustForce : 0,
        storm: env.storm,
        sheltered: st.sheltered,
        nearFire,
      });
    }
    inp.jumpPressed = false;

    // ---- triggers ----
    // ravine fall
    if (P.y > 430 && P.x > 2620 && P.x < 3380 && !st.respawning) {
      if (P.grounded || P.y >= 448) { G.Audio.splash(); G.Camera.kick(0.3); respawn(); }
    }
    // cold collapse
    if (P.exposure >= 1 && !st.respawning) respawn();

    // falling limb
    const b = st.branch;
    if (b.phase === 'idle' && P.x > W.BRANCH.trigger) {
      b.phase = 'cue'; b.t = 0;
      G.Audio.creak();
      // needles sift down from the snag before it drops
      for (let i = 0; i < 14; i++) {
        G.Atmos.debris.push({
          x: W.BRANCH.x + (Math.random() - 0.5) * 30,
          y: W.groundY(W.BRANCH.x) - 240 - Math.random() * 60,
          vx: (Math.random() - 0.5) * 20, vy: 50 + Math.random() * 60,
          life: 2 + Math.random(),
        });
      }
    } else if (b.phase === 'cue') {
      b.t += dt;
      if (b.t > 1.15) { b.phase = 'falling'; b.y = W.groundY(W.BRANCH.x) - 280; b.vy = 0; }
    } else if (b.phase === 'falling') {
      b.vy = (b.vy || 0) + 1300 * dt;
      b.y += b.vy * dt;
      b.rot = (b.rot || 0.1) + dt * 0.6;
      const gy = W.groundY(W.BRANCH.x);
      if (Math.abs(P.x - W.BRANCH.x) < 24 && b.y > P.y - 46 && b.y < P.y + 6 && !st.respawning) {
        G.Audio.thud(); G.Camera.kick(0.5); respawn();
      }
      if (b.y >= gy - 4) {
        b.y = gy - 4; b.phase = 'landed'; b.rot = 0.08;
        G.Audio.thud(); G.Camera.kick(0.35);
        W.addBlock({ x: W.BRANCH.x - 26, w: 52, h: 12 }); // becomes a step
      }
    }

    // the fire: sit to end (down key beside it, or linger)
    if (st.mode === 'play' && nearFire && P.state !== 'sit' && P.grounded) {
      if (Math.abs(P.x - W.FIRE.x + 26) < 30 && (inp.down || P.idleT > 2.5)) {
        P.state = 'sit';
        P.facing = 1;
        P.x = W.FIRE.x - 26;
        P.y = W.groundY(P.x);
      }
    }
    if (P.state === 'sit' && st.mode === 'play') {
      G.Camera.endPull();
      if (P.sitT > 7) { st.mode = 'end'; st.endT = 0; }
    }
    if (st.mode === 'end') {
      st.endT += dt;
      st.endFade = U.smoothstep(0.5, 5, st.endT) * 0.92;
      if (st.endT > 4.5) endEl.classList.add('shown');
      if (st.endT > 6 && anyKey) { // quiet restart
        endEl.classList.remove('shown');
        st.mode = 'play'; st.endFade = 0;
        G.Camera.reset();
        G.Player.reset(120);
        P.exposure = 0;
        st.branch.phase = 'idle';
        W.blocks.length = 0;
      }
    }
    anyKey = false;

    // respawn fade cycle
    if (st.respawning) {
      st.respawnT += dt;
      if (st.respawnT < 0.55) st.respawnFade = st.respawnT / 0.55;
      else if (st.respawnT < 0.85) {
        st.respawnFade = 1;
        if (!st.didReset) {
          G.Player.reset(W.checkpoint(P.x));
          st.didReset = true;
        }
      } else if (st.respawnT < 1.7) st.respawnFade = 1 - (st.respawnT - 0.85) / 0.85;
      else { st.respawning = false; st.respawnFade = 0; st.didReset = false; }
    }

    G.Camera.update(dt, P, st.t);

    // audio mix
    const wtr = W.waterAt(P.x);
    const nearShore = (P.x > 4100 && P.x < 6500) || (P.x > 7800) || !!wtr;
    G.Audio.update(dt, {
      storm: env.storm,
      gust: Math.abs(env.gustForce) / 160,
      rain: env.storm,
      sheltered: st.sheltered,
      water: nearShore ? (wtr ? 0.9 : 0.5) : 0.1,
      fire: st.fireLit ? U.clamp(1 - Math.abs(P.x - W.FIRE.x) / 420, 0, 1) : 0,
    });

    return env;
  }

  // ------------------------------------------------------------- loop
  let last = performance.now(), acc = 0;
  let lastEnv = { storm: 0, night: 0, dawn: 1, gustForce: 0, gustCue: 0, flash: 0, wind: 0 };

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    const step = 1 / 120;
    let env;
    while (acc >= step) {
      env = update(step);
      acc -= step;
    }
    if (env) lastEnv = env;

    ctx.save();
    ctx.scale(dpr, dpr);
    G.Render.draw(ctx, { w: vw, h: vh, cam: G.Camera.cam }, P, lastEnv, st);
    ctx.restore();
  }
  requestAnimationFrame(frame);

  // debug hook for tooling/screenshots
  window.__g = {
    P, st, cam: G.Camera.cam,
    go(x) { G.Player.reset(x); G.Camera.cam.x = x; G.Camera.cam.y = W.groundY(x) - 34; },
    start() { if (st.mode === 'title') beginPlay(); },
  };
})();
