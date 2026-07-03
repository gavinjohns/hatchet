# HATCHET — the first night

A cinematic side-scrolling wilderness platformer prototype. One unbroken
left-to-right journey through a northern landscape — dawn forest, a fallen-pine
crossing, a storm-lashed lakeshore, a rock overhang, and a fire on a dark
beach. No HUD, no text, no combat, no crafting. The world teaches through
light, framing, sound, and the body of the figure itself.

Structurally inspired by *Inside*; set in a grounded wilderness inspired by
*Hatchet*.

## Run it

Any static server from the repo root:

```
python3 -m http.server 8000
# then open http://localhost:8000/
```

(Opening `index.html` directly from disk also works — there are no module
imports and no external assets.)

**Controls:** arrow keys / WASD. That's all — climbing, stooping, and sitting
are contextual. Sound starts with your first key press.

Dev shortcut: `?x=5000` in the URL spawns at that world position
(beats: 120 forest · 2600 log · 4600 storm shallows · 6800 overhang · 9200 fire).

## What to notice

- **Stillness is a verb.** On the fallen pine, needles stream and the wind
  rises about a second before a gust hits. Stop (or hold ↓ to hunker) and it
  passes. The same cue language warns you before the dead limb drops on the
  shore.
- **The body is the HUD.** Cold water drains color from the world and puts a
  shiver in the figure's stride. Shelter and fire bring it back.
- **Failure is soft.** A fall or a collapse is a cold white fade and a few
  metres lost, never a menu.

## Layout

```
index.html          shell: canvas + title/end cards only
src/util.js         math, seeded RNG, color
src/audio.js        procedural ambience (wind/rain/shore/fire/thunder)
src/world.js        the heightfield, water, ceilings, log, triggers
src/player.js       physics + fully procedural character animation
src/camera.js       authored camera zones, damped follow, end pull-back
src/atmosphere.js   storm curve, gust scheduler, lightning, particles
src/render.js       painterly plate renderer: parallax planes, fog, grading
docs/DESIGN.md      design thesis, slice plan, mechanics spec, art direction,
                    and the Higgsfield MCP asset-generation plan
```

All art is procedurally painted at runtime (no image assets). The renderer's
plane system is built so generated plates (see `docs/DESIGN.md` §6) can replace
the procedural layers via `drawImage` without touching gameplay code.
