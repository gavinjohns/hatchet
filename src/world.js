'use strict';
// The whole slice is one continuous heightfield, left to right:
//   0–2450   forest approach (dawn haze, torn-clearing debris)
//   2450–3550 ravine + fallen-pine crossing
//   3550–6450 storm lakeshore (wading, gusts, falling limb)
//   6450–7350 rock overhang shelter
//   7350–9500 night shore, fire, end
G.World = (() => {
  const U = G.U;

  // Ground polyline (x, y). y grows downward. Near-vertical pairs encode steps.
  const PTS = [
    [-600, 302], [0, 300], [240, 294], [480, 300], [640, 296],
    // shallow water dip — teaches "water slows you", jumpable for the observant
    [1080, 296], [1120, 334], [1170, 334], [1210, 296],
    [1400, 292], [1520, 294],
    // torn clearing debris: knee-high log, then chest-high log (mantle)
    [1700, 296], [1748, 296], [1749, 272], [1830, 272], [1831, 296],
    [1940, 298], [1941, 264], [2040, 264], [2041, 298],
    // giant pine roots
    [2150, 290], [2170, 284], [2190, 290],
    [2380, 288], [2520, 284], [2600, 282], [2640, 281],
    // ravine (walls near-vertical; the fallen pine spans it)
    [2664, 470], [3336, 470],
    [3360, 280], [3480, 284], [3620, 290],
    // descend to the storm shore
    [3900, 300], [4200, 314], [4480, 330], [4560, 336],
    // lake bowl (wading; deepest mid-channel)
    [4700, 352], [4860, 378], [4980, 376], [5100, 348], [5240, 330],
    [5400, 324], [5560, 320], [5760, 318], [6000, 310], [6200, 302],
    // bedrock rise to the overhang
    [6420, 290], [6560, 274], [6660, 268], [6860, 266], [7060, 264],
    [7180, 268], [7320, 276],
    // night shore
    [7600, 288], [7900, 298], [8200, 306], [8600, 310], [9000, 312], [9240, 312],
    [9420, 308],
    // end boulders
    [9480, 300], [9500, 240], [10200, 240],
  ];

  // Playable water volumes {x0,x1,surf}
  const WATERS = [
    { x0: 1085, x1: 1206, surf: 326 },
    { x0: 2664, x1: 3336, surf: 452 },   // creek at the ravine floor
    { x0: 4560, x1: 5240, surf: 340 },   // storm shallows
  ];
  // Background water planes (visual only) {x0,x1,surf,kind}
  const BG_WATER = [
    { x0: 4050, x1: 7160, surf: 344, kind: 'storm' }, // runs behind the overhang crawl
    { x0: 7750, x1: 10200, surf: 318, kind: 'night' },
  ];

  // Low ceilings {pts:[[x,y]..]} — leaning trunk rehearsal, then the overhang
  const CEILS = [
    { pts: [[1560, 262], [1600, 258], [1640, 262]] },
    { pts: [[6600, 226], [6720, 236], [6840, 240], [6960, 232], [7080, 222]] },
  ];

  // The fallen pine across the ravine — ends meet the banks flush so the
  // player walks straight onto it; the span bows upward mid-crossing
  const LOG = { x0: 2596, y0: 281.5, x1: 3404, y1: 280.5, bow: 26 };

  // Dynamic obstacles (the fallen limb lands and becomes one)
  const blocks = [];

  const CHECKPOINTS = [120, 2520, 3900, 5330, 6520, 7700];
  const FIRE = { x: 9300 };
  const BRANCH = { x: 5620, trigger: 5500 };

  function polyY(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (pts[m][0] <= x) lo = m; else hi = m;
    }
    const a = pts[lo], b = pts[hi];
    return U.lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
  }

  function groundY(x) {
    let y = polyY(PTS, x);
    for (const b of blocks) {
      if (x >= b.x && x <= b.x + b.w) y = Math.min(y, polyY(PTS, x) - b.h);
    }
    return y;
  }

  function ceilingY(x) {
    let c = null;
    for (const seg of CEILS) {
      const p = seg.pts;
      if (x >= p[0][0] && x <= p[p.length - 1][0]) {
        const y = polyY(p, x);
        c = c === null ? y : Math.max(c, y);
      }
    }
    return c;
  }

  function waterAt(x) {
    for (const w of WATERS) if (x >= w.x0 && x <= w.x1) return w;
    return null;
  }

  function logY(x) {
    if (x < LOG.x0 || x > LOG.x1) return null;
    const t = (x - LOG.x0) / (LOG.x1 - LOG.x0);
    return U.lerp(LOG.y0, LOG.y1, t) - LOG.bow * Math.sin(Math.PI * t);
  }

  function checkpoint(x) {
    let c = CHECKPOINTS[0];
    for (const cp of CHECKPOINTS) if (cp <= x) c = cp;
    return c;
  }

  function addBlock(b) { blocks.push(b); }

  return {
    PTS, WATERS, BG_WATER, CEILS, LOG, FIRE, BRANCH, CHECKPOINTS,
    END_X: 9500,
    groundY, ceilingY, waterAt, logY, checkpoint, addBlock, blocks,
  };
})();
