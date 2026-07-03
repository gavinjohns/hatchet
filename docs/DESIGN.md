# NORTHLIGHT — design package
*A cinematic side-scrolling wilderness platformer. Structurally inspired by Inside; set in a grounded northern wilderness inspired by Hatchet.*

---

## 1. Prototype format choice

**Chosen: (A+) 2.5D cinematic canvas platformer — a custom Canvas2D renderer with
pre-painted procedural plates, 6 parallax planes, depth fog, dynamic grading and
screen-space weather.**

Why not Three.js (option B): true 3D buys nothing for a side-on composition —
every reference image is a *painting*: stacked silhouette planes, atmospheric
perspective, a low horizon. Canvas2D gives direct authorial control over exactly
those qualities (gradients, fog bands, silhouette shapes, grain, grading) with
zero asset-pipeline risk and guaranteed 60fps in any browser. The renderer is
architected as *plates + planes + light*, so Higgsfield-generated plates can be
dropped in as `drawImage` layers without touching gameplay code.

---

## 2. Design thesis

**Emotional tone.** Quiet dread and quiet wonder in equal measure. The world is
indifferent, enormous, and beautiful; the player is small, cold, and capable.
Tension comes from weather and terrain, never from antagonists. Relief is a dry
place and a fire.

**Player verbs.** Walk, run, jump, mantle, stoop, balance, wade, wait, sit.
Nothing is collected, nothing is fought, nothing is crafted.

**What is Inside-like structurally.** One continuous left-to-right journey with
no cuts. No HUD, no text, no dialogue. Camera and lighting are the narrator.
Mechanics are taught by architecture: a safe rehearsal of every verb before its
dangerous test. Soft, fast, dignified failure that returns you a few metres.
Authored camera zones that reframe each beat like shots in a film.

**What makes it distinctly northern wilderness, not derivative.** Inside's
pressure is institutional; ours is *meteorological*. The antagonist is cold
water, wind, unstable timber, and nightfall. Scale contrast comes from glacial
geology and old-growth pines rather than architecture. The arc is a single day
— dawn haze → storm front → dusk → first night — and the win-state is not
escape but *shelter*: a fire on a dark shore. Failure is never gore; it is a
cold white fade, like breath misting over.

---

## 3. Vertical slice — "The First Night"

Five connected beats, one unbroken traversal, ~6–9 minutes.

| # | Beat | Visual goal | Gameplay goal | Implicit lesson | Transition |
|---|------|-------------|---------------|-----------------|------------|
| 1 | **Forest approach** (dawn) | Pale gold haze through colossal pines; the player a speck at the bottom of the frame; a giant ancient pine as landmark drawing the eye right | Walk, jump over storm-torn debris, auto-stoop under a leaning trunk, mantle a shattered log | Push into the world and the body responds: low things are ducked, waist-high things are climbed | Ground falls away — light opens ahead |
| 2 | **Fallen tree crossing** (ravine) | A bent giant pine arcs over a ravine with a creek far below; camera tightens; wind moves the canopy | Balance across the narrow trunk; a telegraphed gust mid-span; stopping (or hunkering) is safety | *Stillness is a verb.* Wind announces itself before it pushes | The far bank descends toward open water and a bruised sky |
| 3 | **Storm lakeshore** (front arrives) | Widest shot in the game: slate water, rain curtains, lightning silhouettes the far treeline | Wade the shallows against a current; time pushes between gusts; a creaking snag drops a limb — the debris cue teaches you to halt | Cold water drains you (shiver, desaturation, slowing — the body *is* the meter); listen to the forest | Shore rises into bedrock; a black overhang mouth reads as the only dry place |
| 4 | **Rock overhang shelter** (storm peak → passing) | Tight, dark, dry; rain becomes a bright curtain at the mouths; warm-dark rock vs cold outside | Stoop through the low crawl; the pace forces a pause while the storm breaks | Shelter works. Waiting is sometimes the way forward | Exit into blue dusk; the rain has stopped; stars |
| 5 | **Night lakeside resolution** | Moonlit calm water, breath vapor, one warm point of light far right: a small fire | Walk the dark beach; sit at the fire; the camera slowly pulls wide; embers rise | You made it to night. That is the whole victory | Fade to the title. End |

---

## 4. Movement & mechanics spec

Global feel targets: acceleration is deliberately soft (weight), top speed
modest, jump ~1.4× body height. The figure leans into acceleration, arms and
head follow with lag. All failure is a cold fade + respawn at the last dry
checkpoint (≤ a few metres back).

| Mechanic | Input | Animation need | Failure state | Taught by level design |
|---|---|---|---|---|
| Walk / run | ← → (A/D). Speed builds with held direction | Procedural 2-bone leg cycle, counter arm-swing, torso lean ∝ accel, head bob | — | First 300 m is flat and safe; the landmark pine pulls you right |
| Jump | Space / ↑ / W, variable height on release | Anticipation crouch 60 ms, tuck in air, landing compression | Short falls harmless; ravine fall = fade | Debris field: first log is knee-high in a wide safe clearing |
| Mantle / climb | Automatic when pushing into a 20–60 px ledge | Grab, plant, pivot-up (0.4 s) | — | The second debris log is chest-high right after the knee-high one — same push, new outcome |
| Stoop / crouch | Automatic under low ceilings; ↓ / S manual | Compressed spine, head forward, shortened stride | Blocked (soft bonk) if gap is below crawl height | A leaning trunk at head height in beat 1 rehearses the overhang crawl of beat 4 |
| Balance (log) | ← → while on the trunk; stillness / ↓ to hunker | Arms out, micro-tilt from wobble value, careful half-speed steps | Wobble exceeds limit → slip, fall to creek, fade + respawn at bank | Camera zooms in (this surface is different); grass and needles stream sideways 1 s before each gust |
| Wade / swim | ← → in water | Raised arms as depth grows, drag lean, slowed cycle | Exposure maxes in deep water → stumble collapse, fade | Ankle-deep puddles on approach slow you *slightly* before the waist-deep crossing asks for commitment |
| Shelter / wait | Stop moving (and/or ↓) | Idle hunker, shiver decays, breath vapor | — | Under the overhang rain is occluded and audio softens — the body visibly recovers |
| Sit (end) | ↓ near the fire, or idle 2.5 s beside it | Sit, knees up, firelight flicker on the figure | — | The fire is the only warm pixel in the frame; nothing else is asked |

**The body is the HUD:** cold = shiver amplitude + local desaturation + slower
stride. Wind = particle streaks + audio one second before force. Danger = creak
+ falling needles before the limb drops. No bars, no icons, no text.

---

## 5. Art direction package

**Palette by beat** (sampled directly from the reference images — the set is
teal-sage, not blue-grey; milky warm-cream light breaks; near-black teal
shadows; one warm accent reserved for fire):
- Dawn forest (refs: misty lakeshore, giant pine): warm cream horizon `#e6e0c4` under soft teal `#a5c4cc`; sage/iron greens.
- Ravine (refs: bent-pine arch, tree bridge): milky backlight `#e3ddc2`; the fallen pine reads near-black against it.
- Storm shore (ref: wading figure): deep teal slate `#22383a` → `#476460`; light is the pale break `#9fb98f` and the lightning key.
- Overhang (ref: rain shelter): warm-dark rock against the cold exterior; interior values crushed; the lake glows through the crawl gap.
- Night lake (ref: campfire): teal-black `#0a141a`, star/moon silver `#cfe8e2`, one warm ember point `#ff9a3c`.

**Lighting language.** One key light per beat (dawn sun / storm sky / moon /
fire); light always enters from the direction of travel until the fire, which
finally lights the player's *face* side. Rim-light on the figure keeps the
silhouette readable against every value.

**Composition rules.** Horizon low (55–65 % down). Player occupies the lower
third. Every beat has one oversized natural form (landmark pine, log arch,
cliff mass, moon) placed right-of-centre to pull travel. Foreground occluders
frame, never hide, the play plane.

**Silhouette & scale rules.** Player ≈ 38 px against 1500+ px trees — never
larger than 1/9 of frame height. All near shapes read as solid black-value
masses; detail lives in the mid and far planes as *texture*, not line.

**Weather behaviour.** Weather is a pressure curve tied to progression: haze →
head-wind → rain curtains → occluded drumming → stillness. Gusts are always
telegraphed (audio + streaming particles) before they apply force.

**Camera language.** Damped follow with look-ahead in the travel direction.
Zoom per zone: wide on exposure beats (you are small), tight on precision beats
(this surface matters). Constant 2.20:1 letterbox. The only camera move not
driven by the player is the final pull-back at the fire.

**Environmental storytelling.** Storm-torn clearing (file:58) foreshadows the
front two beats before it arrives. The fallen limb you dodge becomes a log you
climb. The fire ring at the end is already built — someone survived here before
you; you are not the first, and that is the only lore the game states.

---

## 6. Higgsfield MCP asset generation plan

*The Higgsfield MCP server was not connected in this session, so the prototype
ships with procedural painterly plates. The renderer's plane system takes
`drawImage` plates directly — each asset below maps 1:1 onto an existing layer.
Run these when the MCP is available; all prompts are grounded/naturalistic per
the hard constraints.*

Shared prompt suffix for all stills: *"muted naturalistic palette, painterly
but restrained, atmospheric perspective, no people, no animals, no text, no
fantasy elements, cinematic 2.39:1, soft diffuse light"*.

| Asset | Purpose / plane | Framing | Type | Prompt core (ref) | Integration |
|---|---|---|---|---|---|
| `plate_sky_dawn` | Beat 1 sky plane | horizonless upper 2/3 | still 4096×1024 | pale gold dawn haze over a cold grey-blue northern sky, thin cloud veils (file:56) | replaces gradient sky, tiled with grade tint |
| `plate_hills_far` | far plane, all beats | ridge silhouette strip | still, alpha | distant fog-washed spruce ridgeline across a wilderness lake, single value mass (file:55/56) | far parallax plane p=0.10 |
| `plate_treeline_mid` | mid plane beats 1–2 | full-height pine band | still, alpha | dense old-growth pine silhouettes in layered mist, northern boreal forest (file:57) | mid plane p=0.45, fog-mixed |
| `plate_giant_pine` | landmark set piece | full-height single tree | still, alpha | one enormous ancient white pine towering out of frame, gnarled storm-broken crown (file:57) | near plane at x≈1850 |
| `plate_log_arch` | traversal set piece | wide hero object | still, alpha | colossal bent fallen pine spanning a rocky ravine like a natural bridge, broken branch stubs (file:59/60) | replaces procedural log art; collision unchanged |
| `plate_storm_shore` | beat 3 backdrop | panoramic shore | still 4096×1024 | windswept storm-dark lakeshore, rain curtains dragging across slate water, bowed grasses (file:61) | mid+far planes over 3800–6400 |
| `plate_cliff_overhang` | beat 4 set piece | rock mass w/ mouth | still, alpha ×2 (back wall / front lip) | granite overhang forming a dry hollow above the waterline, wet stone, moss seams (file:54) | back wall behind player, lip in FG occluder plane |
| `plate_night_lake` | beat 5 backdrop | panoramic calm water | still 4096×1024 | moonlit northern lake at night, glass-calm water, black spruce shore, cold starfield (file:62/55) | far+mid planes over 7600–9600 |
| `loop_storm_sky` | beat 3 sky motion | seamless loop | motion 6 s loop | slow churning slate storm front over a wilderness lake, rain veils, no lightning baked in | video texture on sky plane; lightning stays dynamic |
| `overlay_mist` | fog bands, all beats | tileable wisp sheet | still ×3, alpha | soft horizontal mist wisps, neutral grey, wispy edges | inter-plane fog bands, additive drift |
| `overlay_rain` | beat 3 weather | streak sheet | still ×2, alpha | fine diagonal rain streaks on black, subtle, photographic | multiplied over screen; procedural rain remains for parallax |
| `sheet_figure_silhouette` | character concept | 8-pose sheet | still concept | slight lone figure in a worn jacket, silhouette study: walk, stoop, balance arms-out, wade, sit; grounded, non-stylized | reference for procedural animator tuning (runtime figure stays procedural for physics fidelity) |
| `plate_fg_debris` | foreground occluders | strip, alpha | still | storm-torn foreground: shattered pine trunks, root plates, dark grasses, near-black values (file:58) | FG plane p=1.3 |
| `plate_fire_camp` | end set piece | small hero object | still, alpha | small stone fire ring with low flame on a pebble lakeshore at night, warm ember light (file:62) | drawn under dynamic fire light; embers stay procedural |

---

## 7. Technical implementation plan

- **Stack:** zero-dependency Canvas2D + WebAudio. Plain script files, no build
  step; runs from any static server or `file://`.
- **Loop:** fixed 120 Hz simulation with accumulator; render per rAF.
- **World:** single 9.6 k-unit heightfield polyline (steps encoded as
  near-vertical segments), plus ceiling polylines (stoop trunk, overhang), one
  log platform (parametric bow curve), water volumes, checkpoints, triggers.
- **Player:** state machine (ground / air / log-balance / mantle / sit) with a
  fully procedural skeletal figure — poses are functions of speed, lean,
  wobble, depth, exposure — so animation always matches physics.
- **Camera:** authored zone list (zoom / y-bias / look-ahead) blended by x,
  spring-damped, plus the scripted end pull-back.
- **Render:** planes far→near: sky → hills → far trees → fog band → mid trees
  → fog band → near set pieces → gameplay (terrain, water w/ reflections,
  hazards) → player → foreground occluders → weather → grade (saturation
  composite for cold), vignette, grain, letterbox.
- **Weather/atmosphere module:** storm intensity curve over x, gust scheduler
  with pre-cues, lightning, particle pools (rain / mist / leaves / embers /
  smoke / breath).
- **Audio:** procedurally synthesized ambience (filtered noise: wind, rain,
  shore, fire crackle, thunder; footstep ticks by material). Starts on first
  key press (autoplay policy) — which is also the title dismissal.
- **Failure:** cold-white fade, respawn at nearest dry checkpoint, exposure
  halved (a memory of the mistake, not a punishment).

---

## 9. Self-critique log (applied before final)

1. **Readability of the play plane in storm values** — raised the wet-ground
   rim light and gave the figure a persistent cold rim so the silhouette never
   dissolves into the slate mid-plane.
2. **Beat 3 felt like weather *decoration*, not weather *pressure*** — gusts
   now apply real force with a 1 s particle/audio pre-cue, and the deep-water
   current requires moving in the lulls; the limb-fall telegraph was lengthened
   so first-time readers halt from the *sound*, not from dying.
3. **Scale contrast** — widened the storm-shore and night camera zones and
   pushed the landmark pine and cliff mass further above the frame line so the
   figure stays under 1/9 frame height at every exposure beat.
