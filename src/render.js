'use strict';
// Painterly plate renderer. Planes far -> near: sky / hills / far treeline /
// fog / mid trees / fog / background water / set pieces / gameplay terrain /
// player / foreground occluders / weather / grade+grain+vignette+letterbox.
// Palette keyframes are sampled from the reference paintings: teal-sage north,
// milky warm light breaks, near-black teal shadows, one warm accent (fire).
G.Render = (() => {
  const U = G.U, W = G.World;
  const H = U.hex;

  // ------------------------------------------------------------- palettes
  const PAL = [
    { x: 0,    st: H('#a5c4cc'), sh: H('#e6e0c4'), fog: H('#cfdfdd'), far: H('#7d9a9c'), mid: H('#3f5a5c'), near: H('#22383a'), gr: H('#1b2c2a'), gl: H('#52684f'), li: H('#efe9cf') },
    { x: 1600, st: H('#7fa09b'), sh: H('#c3d5c9'), fog: H('#a9c2bb'), far: H('#5d7a75'), mid: H('#33473f'), near: H('#17251f'), gr: H('#141f1a'), gl: H('#3e5138'), li: H('#d5e4d3') },
    { x: 2700, st: H('#9fb4ac'), sh: H('#e3ddc2'), fog: H('#c6cfc2'), far: H('#6e8480'), mid: H('#3c5250'), near: H('#1e302e'), gr: H('#182624'), gl: H('#475c48'), li: H('#f0e8c8') },
    { x: 4000, st: H('#4f6a66'), sh: H('#8ba393'), fog: H('#6d8781'), far: H('#3d5a57'), mid: H('#24403c'), near: H('#101f1d'), gr: H('#0e1a18'), gl: H('#33463c'), li: H('#b9d0b4') },
    { x: 5100, st: H('#22383a'), sh: H('#476460'), fog: H('#3a5654'), far: H('#22403e'), mid: H('#142a28'), near: H('#081210'), gr: H('#071010'), gl: H('#2c4a44'), li: H('#9fb98f') },
    { x: 6700, st: H('#2c4244'), sh: H('#6d8a84'), fog: H('#4a6662'), far: H('#2b4643'), mid: H('#18302c'), near: H('#0a1614'), gr: H('#0c1412'), gl: H('#31443c'), li: H('#aec4b4') },
    { x: 7500, st: H('#16242e'), sh: H('#3e5157'), fog: H('#22343a'), far: H('#142728'), mid: H('#0d1d1c'), near: H('#071010'), gr: H('#081010'), gl: H('#22383a'), li: H('#b8d0cc') },
    { x: 8400, st: H('#0a141a'), sh: H('#1c2e33'), fog: H('#14242a'), far: H('#0e1c1c'), mid: H('#0a1616'), near: H('#050d0d'), gr: H('#060e0e'), gl: H('#1c3234'), li: H('#cfe8e2') },
    { x: 10200, st: H('#0a141a'), sh: H('#1c2e33'), fog: H('#14242a'), far: H('#0e1c1c'), mid: H('#0a1616'), near: H('#050d0d'), gr: H('#060e0e'), gl: H('#1c3234'), li: H('#cfe8e2') },
  ];
  function grade(x) {
    let a = PAL[0], b = PAL[PAL.length - 1];
    for (let i = 0; i < PAL.length - 1; i++) {
      if (x >= PAL[i].x && x <= PAL[i + 1].x) { a = PAL[i]; b = PAL[i + 1]; break; }
    }
    const t = U.smooth(U.clamp((x - a.x) / Math.max(1, b.x - a.x), 0, 1));
    const g = {};
    for (const k of ['st', 'sh', 'fog', 'far', 'mid', 'near', 'gr', 'gl', 'li']) g[k] = U.mixc(a[k], b[k], t);
    return g;
  }

  // ------------------------------------------------------- generated world art
  const hillN = U.noiseMaker(11);
  const treeN = U.noiseMaker(22);
  const edgeN = U.noiseMaker(33);

  // no trees over open water or the ravine gap
  const overGap = (x) => (x > 2540 && x < 3460) || (x > 4380 && x < 6380) || (x > 8060 && x < 9600 && false);
  function densityMid(x) {
    if (overGap(x)) return 0;
    if (x < 2550) return 0.85;
    if (x < 4300) return 0.5;
    if (x < 6350) return 0;
    if (x < 7450) return 0.1;
    return 0.42;
  }
  function densityNear(x) {
    if (overGap(x)) return 0;
    if (x < 2450) return 0.42;
    if (x < 3550) return 0.1;
    if (x < 4250) return 0.26;
    if (x < 7500) return 0.0; // shore + cliff own this stretch
    if (x < 9000) return 0.16;
    return 0.0;
  }

  function makeTrees(density, spacing, hmin, hmax, seed) {
    const r = U.mulberry(seed);
    const out = [];
    for (let x = -800; x < 10600; x += spacing * (0.6 + r() * 0.8)) {
      if (r() > density(x)) continue;
      out.push({
        x, h: hmin + r() * (hmax - hmin),
        w: 0.6 + r() * 0.5, s: Math.floor(r() * 1e6),
        snag: x > 1450 && x < 2350 && r() < 0.45,
      });
    }
    return out;
  }
  const treesFar = makeTrees(() => 1, 30, 55, 118, 5);
  const treesMid = makeTrees(densityMid, 72, 150, 300, 6);
  const treesNear = makeTrees(densityNear, 150, 380, 660, 7);

  // foreground tufts / reeds / boulders — anchored in the play plane
  const tufts = [];
  {
    const r = U.mulberry(9);
    for (let x = -600; x < 10400; x += 12 + r() * 22) {
      if (x > 6350 && x < 7450) continue; // bare rock at the overhang
      const w = W.waterAt(x);
      const gy = W.groundY(x);
      const submerged = w && gy > w.surf;
      // reeds live at water margins; nothing sprouts mid-channel
      const nearEdge = w && (Math.abs(x - w.x0) < 70 || Math.abs(x - w.x1) < 70);
      if (submerged && !nearEdge) continue;
      const shoreReed = nearEdge || (x > 8080 && x < 9440 && r() < 0.3);
      tufts.push({
        x, len: shoreReed ? 16 + r() * 22 : 4 + r() * 7,
        reed: shoreReed, ph: r() * 6.28, bend: 0.4 + r() * 0.6, a: 0.45 + r() * 0.3,
      });
    }
  }
  const boulders = [];
  {
    const r = U.mulberry(10);
    for (let x = -400; x < 10200; x += 300 + r() * 520) {
      if (W.waterAt(x)) continue;
      boulders.push({ x, w: 16 + r() * 40, h: 7 + r() * 15 });
    }
  }

  const stars = [];
  {
    const r = U.mulberry(12);
    for (let i = 0; i < 240; i++) stars.push({ x: r(), y: r() * 0.62, m: r(), tw: r() * 6.28 });
  }
  const clouds = [];
  {
    const r = U.mulberry(14);
    for (let i = 0; i < 6; i++) clouds.push({ u: r(), v: 0.08 + r() * 0.26, s: 0.5 + r(), sp: 2 + r() * 4 });
  }

  // grain + vignette plates
  let grain = null, vig = null, vigW = 0, vigH = 0;
  function makeGrain() {
    grain = document.createElement('canvas');
    grain.width = grain.height = 160;
    const c = grain.getContext('2d');
    const img = c.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.random() * 20 | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }
  function makeVig(w, h) {
    vig = document.createElement('canvas');
    vig.width = w; vig.height = h; vigW = w; vigH = h;
    const c = vig.getContext('2d');
    const g = c.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.42, w / 2, h * 0.52, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(4,10,10,0.5)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  makeGrain();

  // ----------------------------------------------------------- shape painters
  // Painterly pine: many overlapping drooping boughs, jittered, alpha-varied —
  // reads as a soft mass, not a vector triangle.
  function pine(ctx, x, y, h, wMul, seed, col, aBase = 1) {
    const r = U.mulberry(seed);
    const w = h * 0.26 * wMul;
    ctx.fillStyle = col;
    ctx.globalAlpha = aBase;
    ctx.fillRect(x - h * 0.010, y - h * 0.55, h * 0.020, h * 0.55);
    const tiers = Math.max(7, (h / 26) | 0);
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const ty = y - h * (0.16 + 0.84 * t);
      const tw = w * (1 - t * 0.86) * (0.75 + r() * 0.5);
      const th = (h / tiers) * 2.1;
      const jx = (r() - 0.5) * w * 0.22;
      ctx.globalAlpha = aBase * (0.8 + r() * 0.2);
      ctx.beginPath();
      ctx.moveTo(x + jx, ty - th * 0.7);
      ctx.quadraticCurveTo(x + jx - tw * 0.3, ty - th * 0.1, x + jx - tw, ty + th * 0.45);
      ctx.quadraticCurveTo(x + jx, ty + th * 0.05, x + jx + tw, ty + th * 0.45);
      ctx.quadraticCurveTo(x + jx + tw * 0.3, ty - th * 0.1, x + jx, ty - th * 0.7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function snag(ctx, x, y, h, seed, col) {
    const r = U.mulberry(seed);
    const lean = (r() - 0.5) * 0.5;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.04, y);
    ctx.quadraticCurveTo(x + lean * h * 0.4 - h * 0.02, y - h * 0.5, x + lean * h - h * 0.012, y - h);
    ctx.lineTo(x + lean * h + h * 0.018, y - h * 0.94);
    ctx.quadraticCurveTo(x + h * 0.02, y - h * 0.5, x + h * 0.05, y);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const t = 0.35 + r() * 0.5;
      const bx = x + lean * h * t, by = y - h * t;
      ctx.fillRect(bx, by, (r() < 0.5 ? -1 : 1) * (5 + r() * 12), 1.6);
    }
  }
  function fallenLog(ctx, x0, x1, yTop, col, colLit) {
    const hh = W.groundY((x0 + x1) / 2 - 60) - yTop; // block height
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x0 - 4, yTop + hh + 2);
    ctx.quadraticCurveTo(x0 - 6, yTop + hh / 2, x0 - 3, yTop + 2);
    ctx.lineTo(x1 - 6, yTop);
    ctx.quadraticCurveTo(x1 + 8, yTop + hh / 2, x1 + 4, yTop + hh + 2);
    ctx.closePath();
    ctx.fill();
    // end grain disc
    ctx.strokeStyle = colLit;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x1 - 1, yTop + hh / 2 + 1, 4, hh / 2 - 1, 0, 0, Math.PI * 2);
    ctx.stroke();
    // bark lines
    ctx.beginPath();
    ctx.moveTo(x0 + 8, yTop + 4); ctx.lineTo(x1 - 14, yTop + 3);
    ctx.moveTo(x0 + 12, yTop + hh - 5); ctx.lineTo(x1 - 18, yTop + hh - 6);
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // --------------------------------------------------------------- main draw
  function draw(ctx, view, P, env, st) {
    const { w, h } = view;
    const cam = view.cam;
    const g = grade(P.x);
    const night = env.night, dawn = env.dawn, storm = env.storm;
    const t = st.t;
    const zoom = cam.zoom * (Math.min(w / 960, h / 540) || 1);
    const shk = cam.shake;
    const shx = shk ? (Math.random() - 0.5) * 6 * shk : 0;
    const shy = shk ? (Math.random() - 0.5) * 4 * shk : 0;

    const layer = (p, fn) => {
      const py = 1 - (1 - p) * 0.5;
      ctx.save();
      ctx.translate(w / 2 + shx, h * 0.56 + shy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cam.x, -cam.y);
      ctx.translate(cam.x * (1 - p), cam.y * (1 - py));
      fn();
      ctx.restore();
    };

    // ---------------- sky (screen space) ----------------
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    let stC = g.st, shC = g.sh;
    if (env.flash > 0) {
      stC = U.mixc(stC, [225, 240, 235], env.flash * 0.75);
      shC = U.mixc(shC, [235, 245, 240], env.flash * 0.55);
    }
    sky.addColorStop(0, U.css(stC));
    sky.addColorStop(0.72, U.css(shC));
    sky.addColorStop(1, U.css(U.mixc(shC, g.fog, 0.7)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // day cloud veils
    const dayA = (1 - storm) * (1 - night) * 0.16;
    if (dayA > 0.01) {
      for (const c of clouds) {
        const cx = ((c.u * (w + 600) + t * c.sp) % (w + 600)) - 300;
        const cy = h * c.v;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, 0.32);
        const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.18 * c.s);
        rg.addColorStop(0, U.css(U.mixc(g.li, [255, 255, 250], 0.3), dayA));
        rg.addColorStop(1, U.css(g.li, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(-w * 0.25 * c.s, -w * 0.25 * c.s, w * 0.5 * c.s, w * 0.5 * c.s);
        ctx.restore();
      }
    }

    // dawn sun glow
    if (dawn > 0.02) {
      const gx = w * 0.62, gy = h * 0.42;
      const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.5);
      rg.addColorStop(0, U.css(H('#f2ead0'), 0.5 * dawn));
      rg.addColorStop(1, 'rgba(240,230,200,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
    // stars + moon
    if (night > 0.05) {
      ctx.save();
      ctx.globalAlpha = night;
      for (const s of stars) {
        const a = 0.25 + 0.5 * s.m + Math.sin(t * 0.7 + s.tw) * 0.12;
        ctx.fillStyle = `rgba(200,232,226,${Math.max(0, a * night)})`;
        ctx.fillRect(s.x * w, s.y * h, s.m > 0.92 ? 1.6 : 1, s.m > 0.92 ? 1.6 : 1);
      }
      const mx = w * 0.66 - (cam.x - 8400) * 0.02, my = h * 0.20;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
      mg.addColorStop(0, `rgba(215,235,230,${0.9 * night})`);
      mg.addColorStop(0.12, `rgba(205,228,224,${0.85 * night})`);
      mg.addColorStop(0.2, `rgba(180,210,206,${0.25 * night})`);
      mg.addColorStop(1, 'rgba(160,200,196,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, 90, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // storm cloud masses
    if (storm > 0.03) {
      ctx.save();
      ctx.globalAlpha = storm * 0.85;
      for (let i = 0; i < 7; i++) {
        const cx = ((i * 331 + t * (6 + i * 2)) % (w + 700)) - 350;
        const cy = h * (0.05 + (i % 3) * 0.08);
        const cr = w * (0.16 + (i % 4) * 0.05);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, 0.45);
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
        const dk = U.mixc(g.st, [8, 18, 18], 0.6);
        cg.addColorStop(0, U.css(dk, 0.6));
        cg.addColorStop(1, 'rgba(8,18,18,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(-cr, -cr, cr * 2, cr * 2);
        ctx.restore();
      }
      ctx.restore();
    }

    // ---------------- far hills ----------------
    layer(0.10, () => {
      const x0 = cam.x - w / zoom, x1 = cam.x + w / zoom;
      ctx.beginPath();
      ctx.moveTo(x0, cam.y + h);
      for (let x = x0; x <= x1; x += 40) {
        ctx.lineTo(x, 250 - hillN(x * 0.0012) * 110 - hillN(x * 0.004 + 40) * 26);
      }
      ctx.lineTo(x1, cam.y + h);
      ctx.closePath();
      ctx.fillStyle = U.css(U.mixc(g.far, g.fog, 0.62));
      ctx.fill();
    });

    // ---------------- far treeline (small, dense — a band, not giants) -----
    layer(0.28, () => {
      const col = U.css(U.mixc(g.far, g.fog, 0.42));
      const x0 = cam.x - w / zoom - 300, x1 = cam.x + w / zoom + 300;
      for (const tr of treesFar) {
        if (tr.x < x0 || tr.x > x1) continue;
        const base = 318 - treeN(tr.x * 0.002) * 50;
        pine(ctx, tr.x, base, tr.h, tr.w, tr.s, col, 0.95);
      }
    });

    fogBand(ctx, w, h, 0.50, g, 0.36 + storm * 0.2, t, 0.9);

    // ---------------- mid trees ----------------
    layer(0.55, () => {
      const col = U.css(U.mixc(g.mid, g.fog, 0.08));
      const x0 = cam.x - w / zoom - 350, x1 = cam.x + w / zoom + 350;
      for (const tr of treesMid) {
        if (tr.x < x0 || tr.x > x1) continue;
        const base = W.groundY(tr.x);
        if (base > 380) continue;
        if (tr.snag) snag(ctx, tr.x, base + 12, tr.h * 0.55, tr.s, col);
        else pine(ctx, tr.x, base + 12, tr.h, tr.w, tr.s, col);
      }
    });

    fogBand(ctx, w, h, 0.60, g, 0.24 + storm * 0.16, t + 40, 1.4);

    // ---------------- near trees (huge, dark, framing) ----------------
    layer(0.85, () => {
      const col = U.css(U.mixc(g.near, g.mid, 0.25));
      const x0 = cam.x - w / zoom - 500, x1 = cam.x + w / zoom + 500;
      for (const tr of treesNear) {
        if (tr.x < x0 || tr.x > x1) continue;
        const base = W.groundY(tr.x);
        if (base > 380) continue;
        pine(ctx, tr.x, base + 20, tr.h, tr.w, tr.s, col);
      }
    });

    // ---------------- background water planes ----------------
    layer(0.82, () => {
      for (const bw of W.BG_WATER) {
        if (cam.x < bw.x0 - 900 || cam.x > bw.x1 + 900) continue;
        const y = bw.surf;
        const grd = ctx.createLinearGradient(0, y, 0, y + 260);
        grd.addColorStop(0, U.css(U.mixc(g.sh, g.fog, 0.4), 0.95));
        grd.addColorStop(0.5, U.css(U.mixc(g.far, g.near, 0.35), 0.98));
        grd.addColorStop(1, U.css(g.near));
        ctx.fillStyle = grd;
        ctx.fillRect(bw.x0, y, bw.x1 - bw.x0, 460);
        ctx.strokeStyle = U.css(g.li, bw.kind === 'night' ? 0.10 : 0.08);
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 14; i++) {
          const ly = y + 8 + i * i * 1.6;
          const off = Math.sin(t * (0.5 + i * 0.11) + i * 2.3) * (8 + i * 2);
          ctx.beginPath();
          ctx.moveTo(Math.max(bw.x0, cam.x - 600) + off, ly);
          ctx.lineTo(Math.min(bw.x1, cam.x + 600) + off, ly);
          ctx.stroke();
        }
        if (bw.kind === 'night') {
          glint(ctx, 8620, y, 240, H('#cfe8e2'), 0.13 * night, t);
          if (st.fireLit) glint(ctx, W.FIRE.x - 30, y, 130, H('#ff9a3c'), 0.16, t * 1.7);
        }
      }
    });

    // ---------------- set pieces + terrain + player ----------------
    layer(1, () => { drawSetPieces(ctx, g, t, night, st); });
    layer(1, () => {
      drawTerrain(ctx, g, cam, w, zoom, storm, night, t);
      drawLog(ctx, g, t, env);
      drawBranch(ctx, g, st);
      if (st.fireLit) drawFire(ctx, t);
    });
    layer(1, () => {
      const wtr = W.waterAt(P.x);
      if (wtr && Math.abs(P.y - wtr.surf) < 60) {
        ctx.save();
        ctx.translate(0, 2 * wtr.surf);
        ctx.scale(1, -1);
        ctx.globalAlpha = 0.12;
        G.Player.draw(ctx, t, { body: U.css(g.near), rim: U.css(g.near), rimAlpha: 0, lightDir: 1 });
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      const nearFire = st.fireLit && Math.abs(P.x - W.FIRE.x) < 160;
      const rimC = nearFire ? H('#ffb066') : g.li;
      const body = U.mixc([8, 14, 14], [24, 30, 30], night * 0.3);
      G.Player.draw(ctx, t, {
        body: U.css(body),
        rim: U.css(rimC),
        rimAlpha: nearFire ? 0.75 : 0.4 + storm * 0.18 + night * 0.2,
        lightDir: nearFire ? (P.x < W.FIRE.x ? -1 : 1) : 1,
      });
      drawWorldParticles(ctx, g, night);
    });

    // ---------------- foreground occluders ----------------
    layer(1, () => {
      drawOverhangLip(ctx, g);
      drawForeground(ctx, g, cam, w, zoom, env, t);
    });

    // ---------------- screen-space weather + post ----------------
    G.Atmos.drawRain(ctx, w, h, storm * (st.sheltered ? 0.3 : 1), env.wind, st.sheltered, night);
    fogBand(ctx, w, h, 0.76, g, 0.10 + storm * 0.10 + dawn * 0.10, t + 90, 2.2);

    const desat = U.clamp(P.exposure * 0.55 + st.respawnFade * 0.4, 0, 0.8);
    if (desat > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = `rgba(128,128,128,${desat})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const warm = Math.max(dawn * 0.35, (st.fireLit && Math.abs(P.x - W.FIRE.x) < 500) ? 0.3 : 0);
    ctx.fillStyle = warm > storm * 0.4
      ? `rgba(255,214,160,${warm})`
      : `rgba(70,110,105,${0.25 + storm * 0.2})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    if (env.flash > 0.4) {
      ctx.fillStyle = `rgba(220,240,235,${(env.flash - 0.4) * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grain, 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    if (!vig || vigW !== w || vigH !== h) makeVig(w, h);
    ctx.drawImage(vig, 0, 0);

    if (st.respawnFade > 0) {
      ctx.fillStyle = `rgba(216,226,222,${U.clamp(st.respawnFade, 0, 1)})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (st.endFade > 0) {
      ctx.fillStyle = `rgba(4,9,10,${U.clamp(st.endFade, 0, 1)})`;
      ctx.fillRect(0, 0, w, h);
    }

    const bar = h * 0.055;
    ctx.fillStyle = '#020606';
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
  }

  // -------------------------------------------------------------- helpers
  function fogBand(ctx, w, h, yF, g, alpha, t, spd) {
    if (alpha <= 0.01) return;
    for (let i = 0; i < 3; i++) {
      const bx = ((t * 8 * spd + i * w * 0.55) % (w * 1.7)) - w * 0.35;
      const by = h * (yF - 0.05 + i * 0.04);
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(1, 0.26);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.46);
      rg.addColorStop(0, U.css(g.fog, alpha * 0.55));
      rg.addColorStop(1, U.css(g.fog, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(-w * 0.5, -w * 0.5, w, w);
      ctx.restore();
    }
  }

  function glint(ctx, x, y, len, col, alpha, t) {
    for (let i = 0; i < 12; i++) {
      const gy = y + 6 + i * (len / 12);
      const wob = Math.sin(t * 2 + i * 1.7) * (3 + i * 1.2);
      const gw = 14 + i * 2.4;
      ctx.fillStyle = U.css(col, alpha * (1 - i / 14));
      ctx.fillRect(x - gw / 2 + wob, gy, gw, 2.2);
    }
  }

  function drawTerrain(ctx, g, cam, w, zoom, storm, night, t) {
    const x0 = cam.x - w / zoom - 100, x1 = cam.x + w / zoom + 100;
    ctx.beginPath();
    ctx.moveTo(x0, W.groundY(x0));
    for (let x = x0; x <= x1; x += 8) ctx.lineTo(x, W.groundY(x));
    ctx.lineTo(x1, cam.y + 700);
    ctx.lineTo(x0, cam.y + 700);
    ctx.closePath();
    const gg = ctx.createLinearGradient(0, cam.y - 120, 0, cam.y + 360);
    gg.addColorStop(0, U.css(g.gr));
    gg.addColorStop(1, U.css(U.mixc(g.gr, [2, 5, 5], 0.7)));
    ctx.fillStyle = gg;
    ctx.fill();

    // broken rim light — brighter where wet (storm sheen, moon sheen)
    const rimC = U.mixc(g.gl, g.li, storm * 0.3 + night * 0.35);
    ctx.lineWidth = 1.6;
    for (let x = x0; x <= x1; x += 26) {
      const n = edgeN(x * 0.05);
      if (n < 0.3) continue;
      ctx.strokeStyle = U.css(rimC, 0.16 + n * 0.3);
      ctx.beginPath();
      ctx.moveTo(x, W.groundY(x));
      for (let xx = x; xx <= x + 26 && xx <= x1; xx += 7) ctx.lineTo(xx, W.groundY(xx));
      ctx.stroke();
    }

    // playable water — surface only where it lies above the ground, so the
    // fill meets the beach at the true shoreline instead of a hard column
    for (const wt of W.WATERS) {
      if (wt.x1 < x0 || wt.x0 > x1) continue;
      // find shoreline crossings
      let sx0 = wt.x0, sx1 = wt.x1;
      for (let x = wt.x0; x <= wt.x1; x += 4) { if (W.groundY(x) > wt.surf) { sx0 = x - 4; break; } }
      for (let x = wt.x1; x >= wt.x0; x -= 4) { if (W.groundY(x) > wt.surf) { sx1 = x + 4; break; } }
      if (sx1 <= sx0) continue;
      const grd = ctx.createLinearGradient(0, wt.surf, 0, wt.surf + 90);
      grd.addColorStop(0, U.css(U.mixc(g.sh, g.fog, 0.45), 0.75));
      grd.addColorStop(0.4, U.css(U.mixc(g.mid, g.near, 0.6), 0.85));
      grd.addColorStop(1, U.css(U.mixc(g.gr, [0, 0, 0], 0.4), 0.9));
      ctx.fillStyle = grd;
      const rip = (x) => wt.surf + Math.sin(x * 0.05 + t * 2.2) * (storm > 0.3 ? 1.8 : 0.7);
      ctx.beginPath();
      ctx.moveTo(sx0, wt.surf);
      for (let x = sx0; x <= sx1; x += 10) ctx.lineTo(x, rip(x));
      // close along the ground so depth follows the bowl
      for (let x = sx1; x >= sx0; x -= 10) ctx.lineTo(x, W.groundY(x) + 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = U.css(g.li, 0.20);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let x = sx0; x <= sx1; x += 10) {
        x === sx0 ? ctx.moveTo(x, rip(x)) : ctx.lineTo(x, rip(x));
      }
      ctx.stroke();
    }
  }

  function drawSetPieces(ctx, g, t, night, st) {
    // fallen debris logs in the torn clearing (the two step-up plateaus)
    const logC = U.css(U.mixc(g.near, [30, 24, 16], 0.28));
    const logL = U.css(U.mixc(g.gl, g.li, 0.3), 0.6);
    fallenLog(ctx, 1749, 1830, 272, logC, logL);
    fallenLog(ctx, 1941, 2040, 264, logC, logL);
    // the leaning trunk you stoop under
    ctx.save();
    ctx.strokeStyle = logC;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(1500, 320);
    ctx.quadraticCurveTo(1600, 252, 1730, 180);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(1640, 216); ctx.lineTo(1668, 196); ctx.stroke();
    ctx.restore();

    // giant ancient pine landmark at 2170
    const gpX = 2170, gpY = W.groundY(gpX);
    const gpC = U.css(U.mixc(g.near, g.mid, 0.22));
    ctx.fillStyle = gpC;
    ctx.beginPath();
    ctx.moveTo(gpX - 34, gpY + 6);
    ctx.quadraticCurveTo(gpX - 16, gpY - 300, gpX - 13, gpY - 900);
    ctx.lineTo(gpX + 13, gpY - 900);
    ctx.quadraticCurveTo(gpX + 18, gpY - 300, gpX + 38, gpY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = gpC;
    for (let i = 0; i < 7; i++) {
      const ly = gpY - 200 - i * 90;
      const dir = i % 2 ? 1 : -1;
      ctx.lineWidth = 8 - i * 0.7;
      ctx.beginPath();
      ctx.moveTo(gpX + dir * 10, ly);
      ctx.quadraticCurveTo(gpX + dir * 55, ly + 4, gpX + dir * (95 - i * 6), ly + 26 - i * 2);
      ctx.stroke();
    }

    // ravine walls with strata
    const wallC = U.mixc(g.near, [0, 0, 0], 0.25);
    ctx.fillStyle = U.css(wallC);
    ctx.beginPath();
    ctx.moveTo(2640, 281); ctx.lineTo(2664, 470); ctx.lineTo(2600, 470); ctx.lineTo(2586, 300); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3360, 280); ctx.lineTo(3336, 470); ctx.lineTo(3400, 470); ctx.lineTo(3414, 300); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = U.css(U.mixc(wallC, g.gl, 0.3), 0.35);
    ctx.lineWidth = 1.2;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(2600 + i * 3, 300 + i * 34); ctx.lineTo(2655 + i * 2, 305 + i * 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3345 - i * 2, 300 + i * 34); ctx.lineTo(3405 - i * 3, 305 + i * 34); ctx.stroke();
    }

    // ---- the rock overhang: a shelf you crawl under, bright lake beyond ----
    const rockBack = U.mixc(g.near, [34, 29, 22], 0.35);
    // hill face the shelf grows out of (behind the player on the approach)
    ctx.fillStyle = U.css(rockBack);
    ctx.beginPath();
    ctx.moveTo(6392, W.groundY(6392) + 8);
    ctx.lineTo(6400, -700);
    ctx.lineTo(6620, -700);
    ctx.lineTo(6636, 180);
    ctx.lineTo(6612, W.groundY(6612) + 8);
    ctx.closePath();
    ctx.fill();
    // strata on the hill face
    ctx.strokeStyle = U.css(U.mixc(rockBack, [0, 0, 0], 0.4), 0.5);
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = 200 - i * 52;
      ctx.beginPath();
      ctx.moveTo(6400, y + edgeN(i * 3) * 14);
      ctx.lineTo(6630, y + edgeN(i * 5 + 2) * 14 - 8);
      ctx.stroke();
    }
    // shelf underside behind the player (the lip in the FG pass does the rest;
    // the crawl gap itself stays open so the pale lake reads through it)
    ctx.fillStyle = U.css(U.mixc(rockBack, [0, 0, 0], 0.25));
    ctx.beginPath();
    ctx.moveTo(6580, -700);
    ctx.lineTo(7150, -700);
    ctx.lineTo(7140, 212);
    for (let x = 7080; x >= 6600; x -= 60) ctx.lineTo(x, (W.ceilingY(x) || 230) - 2 + edgeN(x * 0.03) * 5);
    ctx.lineTo(6590, 208);
    ctx.closePath();
    ctx.fill();
    // interior gloom pooled at the middle of the crawl
    ctx.save();
    ctx.translate(6860, 252);
    ctx.scale(1, 0.24);
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
    cg.addColorStop(0, 'rgba(3,6,6,0.72)');
    cg.addColorStop(1, 'rgba(3,6,6,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(-300, -300, 600, 600);
    ctx.restore();

    // end boulders
    ctx.fillStyle = U.css(U.mixc(g.near, [0, 0, 0], 0.2));
    ctx.beginPath();
    ctx.moveTo(9440, W.groundY(9440));
    ctx.quadraticCurveTo(9500, 180, 9620, 200);
    ctx.lineTo(9700, 400); ctx.lineTo(9420, 400);
    ctx.closePath();
    ctx.fill();

    // fire ring
    const fx = W.FIRE.x, fy = W.groundY(fx);
    ctx.fillStyle = U.css(U.mixc(g.near, [0, 0, 0], 0.1));
    for (let i = -3; i <= 3; i++) ctx.fillRect(fx + i * 7 - 2, fy - 3, 5, 3);
    ctx.save();
    ctx.strokeStyle = U.css(U.mixc(g.near, [30, 24, 16], 0.4));
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx - 8, fy - 4); ctx.lineTo(fx + 9, fy - 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx - 9, fy - 8); ctx.lineTo(fx + 7, fy - 4); ctx.stroke();
    ctx.restore();
  }

  function drawLog(ctx, g, t, env) {
    const L = W.LOG;
    const col = U.css(U.mixc(g.near, [30, 24, 16], 0.3));
    ctx.fillStyle = col;
    // tapered trunk: thin tip (near bank) to thick rootball (far bank)
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = U.lerp(L.x0 - 34, L.x1 + 40, i / 40);
      const y = (W.logY(U.clamp(x, L.x0, L.x1)) ?? (x < L.x0 ? L.y0 : L.y1)) + 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let i = 40; i >= 0; i--) {
      const x = U.lerp(L.x0 - 34, L.x1 + 40, i / 40);
      const y = (W.logY(U.clamp(x, L.x0, L.x1)) ?? (x < L.x0 ? L.y0 : L.y1)) + 2;
      ctx.lineTo(x, y + 7 + 11 * (i / 40));
    }
    ctx.closePath();
    ctx.fill();
    // rootball plate
    ctx.beginPath();
    ctx.ellipse(L.x1 + 46, L.y1 + 6, 16, 30, 0.25, 0, Math.PI * 2);
    ctx.fill();
    // hanging branch stubs, swaying on gust cues
    const sway = env.gustCue * 2;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const bt = 0.12 + i * 0.15;
      const x = U.lerp(L.x0, L.x1, bt);
      const y = W.logY(x) + 8 + 9 * bt;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (i % 2 ? 6 : -5), y + 10, x + (i % 2 ? 9 : -7) + sway, y + 16 + (i % 3) * 7);
      ctx.stroke();
    }
    // walked-smooth top light
    ctx.strokeStyle = U.css(g.li, 0.25);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = U.lerp(L.x0, L.x1, i / 40);
      i === 0 ? ctx.moveTo(x, W.logY(x) + 1) : ctx.lineTo(x, W.logY(x) + 1);
    }
    ctx.stroke();
  }

  function drawBranch(ctx, g, st) {
    const col = U.css(U.mixc(g.near, [26, 20, 12], 0.35));
    // the dead snag is always there — its silhouette is the foreshadowing
    ctx.fillStyle = col;
    const gy = W.groundY(W.BRANCH.x);
    ctx.beginPath();
    ctx.moveTo(W.BRANCH.x - 7, gy);
    ctx.lineTo(W.BRANCH.x - 3, gy - 290);
    ctx.lineTo(W.BRANCH.x + 4, gy - 284);
    ctx.lineTo(W.BRANCH.x + 8, gy);
    ctx.closePath();
    ctx.fill();
    const b = st.branch;
    if (b.phase === 'idle' || b.phase === 'cue') {
      // the loose limb, still attached, trembling during the cue
      const tr = b.phase === 'cue' ? Math.sin(st.t * 30) * 1.5 : 0;
      ctx.save();
      ctx.translate(W.BRANCH.x, gy - 272);
      ctx.rotate(0.5 + tr * 0.02);
      ctx.fillRect(0, -3, 46, 6);
      ctx.restore();
    }
    if (b.phase === 'falling' || b.phase === 'landed') {
      ctx.save();
      ctx.translate(W.BRANCH.x, b.y);
      ctx.rotate(b.rot || 0.2);
      ctx.fillRect(-26, -6, 52, 9);
      ctx.fillRect(-6, -14, 6, 10);
      ctx.restore();
    }
  }

  function drawFire(ctx, t) {
    const fx = W.FIRE.x, fy = W.groundY(fx) - 4;
    const flick = 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23 + 1) * 0.06;
    const rg = ctx.createRadialGradient(fx, fy - 6, 0, fx, fy - 6, 210 * flick);
    rg.addColorStop(0, 'rgba(255,168,84,0.34)');
    rg.addColorStop(0.35, 'rgba(255,140,60,0.14)');
    rg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(fx - 240, fy - 240, 480, 320);
    for (let i = 0; i < 3; i++) {
      const ph = t * (7 + i * 2.6) + i * 2;
      const hgt = (13 - i * 3) * (0.8 + Math.sin(ph) * 0.22);
      const sway = Math.sin(ph * 0.7) * (2.5 - i * 0.6);
      const cols = ['rgba(255,120,40,0.85)', 'rgba(255,170,70,0.9)', 'rgba(255,220,150,0.95)'];
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.moveTo(fx - 5 + i * 1.6, fy);
      ctx.quadraticCurveTo(fx - 4 + sway, fy - hgt * 0.6, fx + sway * 1.4, fy - hgt);
      ctx.quadraticCurveTo(fx + 4 + sway, fy - hgt * 0.6, fx + 5 - i * 1.6, fy);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawOverhangLip(ctx, g) {
    // front rock lip: irregular dark mass hanging over the crawl, open below
    ctx.fillStyle = U.css(U.mixc(g.near, [0, 0, 0], 0.5));
    ctx.beginPath();
    ctx.moveTo(6560, -700);
    ctx.lineTo(7170, -700);
    ctx.lineTo(7158, 150);
    // jagged under-edge tracks the ceiling with chunky bites
    const pts = [[7150, 208], [7086, 219], [7010, 228], [6930, 236], [6840, 233], [6750, 229], [6668, 222], [6600, 214]];
    for (const [x, y] of pts) {
      ctx.lineTo(x + 8, y - 7);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(6560, 140);
    ctx.closePath();
    ctx.fill();
    // hanging moss / drip threads
    ctx.strokeStyle = 'rgba(6,10,8,0.95)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = 6620 + i * 52;
      const y = 214 + Math.sin(i * 2.2) * 6 + 8;
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 2, y + 5 + (i % 3) * 5);
      ctx.stroke();
    }
  }

  function drawForeground(ctx, g, cam, w, zoom, env, t) {
    const x0 = cam.x - w / zoom - 200, x1 = cam.x + w / zoom + 200;
    const col = U.mixc(g.near, [0, 0, 0], 0.45);
    for (const b of boulders) {
      if (b.x < x0 || b.x > x1) continue;
      const y = W.groundY(b.x) + 3;
      ctx.fillStyle = U.css(col, 0.9);
      ctx.beginPath();
      ctx.ellipse(b.x, y, b.w, b.h, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.lineCap = 'round';
    for (const tf of tufts) {
      if (tf.x < x0 || tf.x > x1) continue;
      const gy = W.groundY(tf.x) + 1;
      const bend = (Math.sin(t * 1.6 + tf.ph) * 2 + env.wind * 0.22) * tf.bend;
      ctx.strokeStyle = U.css(col, tf.a);
      ctx.lineWidth = tf.reed ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(tf.x, gy);
      ctx.quadraticCurveTo(tf.x + bend * 0.4, gy - tf.len * 0.6, tf.x + bend, gy - tf.len);
      ctx.stroke();
      if (tf.reed) {
        ctx.beginPath();
        ctx.moveTo(tf.x + bend, gy - tf.len);
        ctx.lineTo(tf.x + bend + 2 + env.wind * 0.05, gy - tf.len - 4);
        ctx.stroke();
      }
    }
  }

  function drawWorldParticles(ctx, g, night) {
    ctx.fillStyle = U.css(U.mixc(g.mid, g.li, 0.3), 0.7);
    for (const d of G.Atmos.debris) ctx.fillRect(d.x, d.y, 4, 1.4);
    for (const e of G.Atmos.embers) {
      const a = U.clamp(e.life, 0, 1);
      ctx.fillStyle = `rgba(255,${140 + a * 80 | 0},60,${a * 0.9})`;
      ctx.fillRect(e.x, e.y, e.r, e.r);
    }
    for (const s of G.Atmos.smoke) {
      const a = U.clamp(s.life / 3, 0, 1) * 0.16;
      ctx.fillStyle = `rgba(160,170,165,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const b of G.Atmos.breath) {
      const a = U.clamp(b.life / 1.3, 0, 1) * 0.22;
      ctx.fillStyle = `rgba(210,225,220,${a})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { draw, grade };
})();
