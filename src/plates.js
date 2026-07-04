'use strict';
// Painted plate registry. Backdrops are wide beat panoramas cross-faded as the
// player travels; cutouts are alpha-trimmed hero set pieces. When a plate is
// missing the renderer falls back to its procedural painting, so the game
// always runs.
G.Plates = (() => {
  const U = G.U;

  // backdrop panoramas keyed to beat ranges
  const BACKDROPS = [
    { name: 'bd_dawn', x0: -600, x1: 2450 },
    { name: 'bd_milky', x0: 2450, x1: 3550 },
    { name: 'bd_storm', x0: 3550, x1: 6450 },
    { name: 'bd_dusk', x0: 6450, x1: 7900 },
    { name: 'bd_night', x0: 7900, x1: 10400 },
  ];
  const CUTOUTS = ['giant_pine', 'log_bridge', 'overhang'];

  const imgs = {};

  // trim transparent margins so placement math uses true content bounds
  function trim(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    let data;
    try { data = g.getImageData(0, 0, c.width, c.height).data; }
    catch (e) { return c; }
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        if (data[(y * c.width + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0 || y1 <= y0) return c;
    const t = document.createElement('canvas');
    t.width = x1 - x0 + 2; t.height = y1 - y0 + 2;
    t.getContext('2d').drawImage(c, -x0, -y0);
    return t;
  }

  // Higgsfield-generated plates (see docs/DESIGN.md §6). Used when no local
  // copy exists under assets/plates/ and no inline PLATE_DATA is bundled.
  const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3FznXrOOp14m783apv4k3hlBvLe/';
  const REMOTE = {
    bd_dawn: CDN + 'hf_20260703_145957_018985dc-a692-44e9-92e4-6bc59f437e48.png',
    bd_milky: CDN + 'hf_20260704_123736_3e9783e8-d4bf-411e-b07a-68de5e188c91.png',
    bd_storm: CDN + 'hf_20260703_150005_6ead0f82-97fa-4686-9f47-d7e01d277635.png',
    bd_dusk: CDN + 'hf_20260704_123739_235a6f32-8274-4887-8140-ca2c8fa0f35d.png',
    bd_night: CDN + 'hf_20260704_123741_480fc2ee-0a24-4797-813a-92ee08f9e58e.png',
    giant_pine: CDN + 'hf_20260704_125149_48638102-f599-42a1-bbb1-fbaa236c54d5.png',
    log_bridge: CDN + 'hf_20260704_124751_99f6d1fc-bae4-4ce9-905c-b6e4d26a5369.png',
    overhang: CDN + 'hf_20260704_124754_d49712f9-a48a-4751-aef8-261db4b0fee5.png',
  };

  function add(name, src, isCut) {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => { imgs[name] = isCut ? trim(im) : im; };
    im.onerror = () => {
      // local file missing — fall back to the generation CDN
      if (REMOTE[name] && im.src !== REMOTE[name]) { im.src = REMOTE[name]; }
    };
    im.src = src;
  }

  function load() {
    const data = window.PLATE_DATA || {}; // inlined data URIs (artifact bundle)
    for (const d of BACKDROPS) add(d.name, data[d.name] || `assets/plates/${d.name}.jpg`, false);
    for (const c of CUTOUTS) add(c, data[c] || `assets/plates/${c}.png`, true);
  }

  const get = (n) => imgs[n] || null;
  const any = () => BACKDROPS.some((d) => imgs[d.name]);

  return { BACKDROPS, CUTOUTS, load, get, any };
})();
G.Plates.load();
