'use strict';
// The figure: physics + a fully procedural skeleton so animation always matches
// the simulation. The body is the HUD — cold shows as shiver + slowing, wind as
// force, wobble as tilt. No bars, no icons.
G.Player = (() => {
  const U = G.U, W = G.World;

  const STAND = 38, CROUCH = 22;
  const GRAV = 1450, JUMP_V = -430;

  const P = {
    x: 120, y: 300, vx: 0, vy: 0, facing: 1,
    grounded: true, onLog: false, crouch: false, crouchT: 0,
    wobble: 0, exposure: 0, shiver: 0, depth: 0,
    phase: 0, lean: 0, idleT: 0, sitT: 0, airT: 0,
    coyote: 0, jbuf: 0, prevStep: 0, slip: false,
    state: 'move', // move | mantle | sit
    mantleT: 0, mantleFrom: null, mantleTo: null,
  };

  function reset(x) {
    P.x = x; P.y = W.groundY(x);
    P.vx = 0; P.vy = 0;
    P.grounded = true; P.onLog = false; P.slip = false;
    P.state = 'move'; P.wobble = 0; P.sitT = 0; P.mantleT = 0;
    P.exposure *= 0.5;
  }

  function startMantle(nx, ny) {
    P.state = 'mantle'; P.mantleT = 0;
    P.mantleFrom = { x: P.x, y: P.y };
    P.mantleTo = { x: nx + P.facing * 10, y: ny };
    P.vx = 0; P.vy = 0;
    G.Audio.step('rock');
  }

  function update(dt, inp, env) {
    // env: {gustForce, storm, sheltered, nearFire}
    if (P.state === 'sit') { P.sitT += dt; P.vx = 0; cold(dt, env, 0); return; }

    if (P.state === 'mantle') {
      P.mantleT += dt / 0.38;
      if (P.mantleT >= 1) {
        P.state = 'move';
        P.x = P.mantleTo.x; P.y = P.mantleTo.y;
        P.grounded = true;
      } else {
        const t = U.smooth(P.mantleT);
        P.x = U.lerp(P.mantleFrom.x, P.mantleTo.x, t);
        P.y = U.lerp(P.mantleFrom.y, P.mantleTo.y, Math.min(1, t * 1.35));
      }
      P.phase += dt * 5;
      cold(dt, env, 0);
      return;
    }

    const ax = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (ax !== 0) { P.facing = ax; P.idleT = 0; } else P.idleT += dt;

    // water depth at the feet
    const w = W.waterAt(P.x);
    P.depth = (w && P.y > w.surf) ? P.y - w.surf : 0;

    // headroom: low ceilings force a stoop; a crawl-height gap blocks entry
    const ceil = W.ceilingY(P.x);
    const headroom = ceil === null ? 999 : P.y - ceil;
    const forced = headroom < STAND + 3;
    P.crouch = forced || (!!inp.down && (P.grounded || P.onLog));
    P.crouchT += ((P.crouch ? 1 : 0) - P.crouchT) * Math.min(1, dt * 10);

    // movement envelope — the world's pressure lands here
    let maxV = 185, acc = 480;
    if (P.onLog) { maxV = 78; acc = 190; }
    if (P.crouch) { maxV = Math.min(maxV, 70); acc = Math.min(acc, 260); }
    if (P.depth > 0) { const m = 1 / (1 + P.depth * 0.035); maxV *= m; acc *= m; }
    maxV *= 1 - 0.4 * P.exposure;

    if (P.grounded || P.onLog) {
      if (ax !== 0) P.vx += ax * acc * dt;
      else {
        const f = 900 * dt;
        P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f;
      }
    } else {
      P.vx += ax * 260 * dt;
    }
    P.vx += env.gustForce * dt;
    if ((P.grounded || P.onLog) && Math.abs(P.vx) > maxV) P.vx = Math.sign(P.vx) * maxV;
    P.vx = U.clamp(P.vx, -230, 230);

    P.lean += ((P.vx / 230) * 0.16 - P.lean) * Math.min(1, dt * 6);

    // jump (buffered + coyote); the log is a no-jump surface — balance instead
    P.jbuf = inp.jumpPressed ? 0.12 : Math.max(0, P.jbuf - dt);
    P.coyote = (P.grounded && !P.onLog) ? 0.12 : Math.max(0, P.coyote - dt);
    if (P.jbuf > 0 && P.coyote > 0 && !P.crouch) {
      P.vy = JUMP_V * (P.depth > 8 ? 0.7 : 1);
      P.grounded = false; P.coyote = 0; P.jbuf = 0;
      G.Audio.step(P.depth > 4 ? 'water' : 'dirt');
    }
    if (!P.grounded && !P.onLog && P.vy < 0 && !inp.jump) P.vy *= Math.pow(0.02, dt); // jump cut

    // horizontal move with step / mantle / wall logic
    let nx = P.x + P.vx * dt;
    if ((P.grounded || P.onLog) && !P.onLog) {
      const gy1 = W.groundY(nx);
      const rise = P.y - gy1;
      if (rise > 14) {
        if (rise <= 58 && ax !== 0 && headroom > STAND) { startMantle(nx, gy1); return; }
        nx = P.x; P.vx = 0;
      }
    }
    const ceilA = W.ceilingY(nx);
    if (ceilA !== null && W.groundY(nx) - ceilA < CROUCH + 3) { nx = P.x; P.vx = 0; }
    P.x = nx;

    // vertical / surfaces
    if (P.onLog) {
      const ly = W.logY(P.x);
      if (ly === null) {
        // stepped off an end — back onto the bank or into the air
        P.onLog = false;
        const gy = W.groundY(P.x);
        if (gy - P.y < 16) { P.grounded = true; P.y = gy; }
      } else {
        P.y = ly;
        // calm careful walking is sustainable; gusts are the test — stop or hunker
        const gustN = Math.abs(env.gustForce) / 140;
        P.wobble += (Math.abs(P.vx) / 78 * 0.10 + gustN * 0.85 + 0.02) * dt * (P.crouch ? 0.22 : 1);
        const rec = Math.abs(P.vx) < 6 ? (P.crouch ? 2.4 : 1.2) : 0.25;
        P.wobble = Math.max(0, P.wobble - rec * dt);
        if (P.wobble > 1) { P.onLog = false; P.slip = true; P.vy = 50; }
      }
    } else if (P.grounded) {
      const ly = W.logY(P.x);
      if (ly !== null && Math.abs(ly - P.y) < 10) {
        P.onLog = true; P.grounded = false; P.y = ly; // stepped onto the trunk
      } else {
        const gy = W.groundY(P.x);
        if (gy - P.y > 8) { P.grounded = false; P.airT = 0; }
        else P.y = gy;
      }
    }

    if (!P.grounded && !P.onLog) {
      P.vy += GRAV * dt;
      const py = P.y;
      P.y += P.vy * dt;
      P.airT += dt;
      const ly = W.logY(P.x);
      if (!P.slip && ly !== null && P.vy > 0 && py <= ly + 2 && P.y >= ly) {
        P.onLog = true; P.vy = 0; P.y = ly; P.wobble += 0.4;
        G.Audio.step('rock');
      } else {
        const gy = W.groundY(P.x);
        if (P.y >= gy && P.vy > 0) {
          const impact = P.vy;
          P.y = gy; P.vy = 0; P.grounded = true; P.slip = false;
          if (impact > 220) G.Audio.step(W.waterAt(P.x) ? 'water' : 'dirt');
        }
      }
    }

    // footfalls
    P.phase += Math.abs(P.vx) * dt * 0.055;
    const s = Math.sin(P.phase);
    if ((P.grounded || P.onLog) && Math.abs(P.vx) > 25 && Math.sign(s) !== Math.sign(P.prevStep) && P.prevStep !== 0) {
      G.Audio.step(P.depth > 4 ? 'water' : (P.x > 6300 && P.x < 7400 ? 'rock' : 'dirt'));
    }
    P.prevStep = s;

    cold(dt, env, P.depth);
  }

  function cold(dt, env, depth) {
    let d = 0;
    if (depth > 4) d += 0.025 + depth * 0.0025;
    else if (env.storm > 0.4 && !env.sheltered) d += 0.014 * env.storm;
    else d -= 0.06;
    if (env.sheltered) d -= 0.06;
    if (env.nearFire) d -= 0.35;
    P.exposure = U.clamp(P.exposure + d * dt, 0, 1);
    P.shiver = P.exposure * 1.7 * (env.nearFire ? 0.25 : 1);
  }

  // ------------------------------------------------------------------ drawing
  // Local space: feet at (0,0), up is -y, facing baked in via scale.
  function pose(t) {
    const spd = Math.abs(P.vx), run = U.clamp(spd / 185, 0, 1);
    const ph = P.phase;
    const cr = P.crouchT;
    const wade = U.clamp(P.depth / 30, 0, 1);
    const strokes = []; // arrays of [x,y] polylines
    let head, tilt = P.lean * P.facing;

    const jit = () => (Math.random() - 0.5) * P.shiver;

    if (P.state === 'sit') {
      const s = Math.min(1, P.sitT * 2);
      strokes.push([[-2, 0], [3, -8], [1, -14 + Math.sin(t * 1.2) * 0.5]]); // back
      strokes.push([[1, -14], [6, -9], [5, -1]]); // arm to knees
      strokes.push([[-2, 0], [6, -7], [7, 0]]);   // legs folded
      head = [2.2, -18 + Math.sin(t * 1.2) * 0.5];
      return { strokes, head, tilt: 0.05 * s };
    }

    const hipY = -(16 - 6 * cr) - (P.grounded || P.onLog ? 0 : 2);
    const shY = hipY - (13 - 5 * cr);

    if (P.state === 'mantle') {
      const m = U.smooth(P.mantleT);
      strokes.push([[0, hipY], [3, shY - 2]]);
      strokes.push([[3, shY - 2], [8 - m * 4, shY - 8 + m * 4], [10 - m * 6, shY - 4 + m * 6]]); // reaching arm
      strokes.push([[3, shY - 2], [-2, shY + 5], [-4, shY + 9]]);
      strokes.push([[0, hipY], [4, hipY + 7 - m * 5], [2, hipY + 13 - m * 9]]);
      strokes.push([[0, hipY], [-3, hipY + 8 - m * 3], [-5, hipY + 14 - m * 6]]);
      head = [4.5, shY - 6];
      return { strokes, head, tilt: 0.18 };
    }

    if (!P.grounded && !P.onLog) {
      // airborne: tuck rising, extend falling
      const fall = U.clamp(P.vy / 500, -1, 1);
      strokes.push([[0, hipY], [1.5, shY]]);
      strokes.push([[0, hipY], [5, hipY + 6], [3 + fall * 3, hipY + 12]]);
      strokes.push([[0, hipY], [-3, hipY + 5], [-5 - fall * 2, hipY + 10]]);
      strokes.push([[1.5, shY], [6, shY + 3 - fall * 4], [8, shY - 1 - fall * 4]]);
      strokes.push([[1.5, shY], [-4, shY + 4], [-6, shY + 1]]);
      head = [2.8, shY - 5];
      return { strokes, head, tilt: tilt + fall * 0.1 };
    }

    // grounded/log gait
    const stride = U.lerp(2.5, 8, run) * (P.onLog ? 0.5 : 1);
    const lift = U.lerp(1.5, 4.5, run);
    const f1x = Math.sin(ph) * stride, f1y = -Math.max(0, Math.cos(ph)) * lift;
    const f2x = Math.sin(ph + Math.PI) * stride, f2y = -Math.max(0, Math.cos(ph + Math.PI)) * lift;
    const kneeF = 3 + run * 2;
    strokes.push([[0, hipY], [f1x * 0.5 + kneeF * 0.5, hipY * 0.45 + f1y * 0.5], [f1x, f1y + jit()]]);
    strokes.push([[0, hipY], [f2x * 0.5 + kneeF * 0.5, hipY * 0.45 + f2y * 0.5], [f2x, f2y + jit()]]);
    strokes.push([[0, hipY + jit()], [1.2 + cr * 2.5, shY + jit()]]); // spine

    if (P.onLog) {
      const wb = Math.sin(t * 9) * P.wobble * 3;
      tilt = P.wobble * 0.28 * Math.sin(t * 7) + P.lean * P.facing * 0.5;
      strokes.push([[1.2, shY], [9, shY - 2 + wb], [13, shY - 1 + wb]]);   // arms out
      strokes.push([[1.2, shY], [-8, shY - 2 - wb], [-12, shY - 1 - wb]]);
      head = [2 + cr * 2, shY - (6 - cr * 2)];
    } else if (wade > 0.25) {
      strokes.push([[1.2, shY], [7, shY - 3 - wade * 3], [11, shY - 2 - wade * 4]]); // arms lifted clear
      strokes.push([[1.2, shY], [-5, shY - 2 - wade * 3], [-9, shY - 1 - wade * 4]]);
      head = [3 + wade * 1.5, shY - 6];
      tilt += wade * 0.12;
    } else {
      const sw = Math.sin(ph + Math.PI) * 3.5 * run;
      const idleBr = Math.sin(t * 1.4) * 0.5;
      strokes.push([[1.2, shY], [3 + sw * 0.6, shY + 5], [2.5 + sw, shY + 9 + jit()]]);
      strokes.push([[1.2, shY], [-1 - sw * 0.6, shY + 5], [-0.5 - sw, shY + 9 + jit()]]);
      head = [2 + cr * 3, shY - (6 - cr * 2.5) + idleBr + jit() * 0.6];
    }
    return { strokes, head, tilt };
  }

  function draw(ctx, t, opts) {
    const { strokes, head, tilt } = pose(t);
    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.rotate(tilt || 0);
    ctx.scale(P.facing, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // rim pass (offset toward the light), then body
    const passes = [
      { dx: -1.1 * P.facing * (opts.lightDir || 1), col: opts.rim, alpha: opts.rimAlpha, w: 3.4 },
      { dx: 0, col: opts.body, alpha: 1, w: 3.0 },
    ];
    for (const ps of passes) {
      ctx.globalAlpha = ps.alpha;
      ctx.strokeStyle = ps.col;
      ctx.fillStyle = ps.col;
      ctx.lineWidth = ps.w;
      for (const s of strokes) {
        ctx.beginPath();
        ctx.moveTo(s[0][0] + ps.dx, s[0][1]);
        for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0] + ps.dx, s[i][1]);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(head[0] + ps.dx, head[1], 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  return { P, update, draw, reset, STAND };
})();
