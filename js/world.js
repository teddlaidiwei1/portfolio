/* world.js: the tinyworld planet that stays on screen for the whole page (Builder W, v3).
   The contract below is the same text as portfolio/briefs/world-api.md.

# world.js API, contract v3 (Builder W, 21 Nov 2026)

`window.WORLD` exists as soon as `js/world.js` has run (it is a `defer` script). Every call is safe at any time:
before the 3D is ready, after a WebGL failure (`world:failed`), and with reduced motion. Calls made before the
planet is built are remembered and applied when it is.

## Changes
Additions only (nothing renamed or removed since the first version):
- `setStage` takes an optional `snap: true` to jump the stage without the spring (use it on a layout change you
  do not want animated). Without it the stage rectangle is sprung (about 0.3 s, no overshoot).
- `ctx.you.offset(dx, dy, dz, rx, rz)`: an extra displacement (scene units) and tilt for YOU on top of `place`,
  for floats, flings and knock-backs. `ctx.you.offset(0, 0, 0, 0, 0)` clears it.
- `ctx.you.scale(body, head)` (added by the lead, 21 Nov): YOU's body and head size while in your place
  (`1, 1` = normal; `0.72, 1.18` = a 13-year-old). Call it every frame you want it; it resets when the place is left.
- `ctx.you.play('Float', {loop: true})` holds the airborne frame of the jump (a floating pose).
- `ctx.base`: the site folder URL (for `ctx.base + 'video/...'` or `'img/...'`).
- `obj.userData.clickable = 'name'` (any truthy value) on a group gives a pointer cursor when the visitor hovers it.
- `mesh.userData.noBounds = true` leaves a mesh out of `WORLD.bounds()` (water sheets, invisible hit boxes).
- `world:scene` `left` carries the stop that was left.
- CALM PASS (W3, 21 Nov 2026), replacing the round 3 street-level camera. Only the stops the page lists in
  `window.WORLD_SCENES` load a scene and dive (the page lists `['tinyworld', 'films']` and passes `dive: 0` for every
  other stop, which then shows the whole planet rolled to its small landmark). Inside a dived place the camera
  settles on ONE framing and stays there: it moves only while the dive is scrolled in or out, and gently during a
  what-if the visitor pressed. No shot travel, no idle loop, no handheld drift, no roll (level horizon).
- The settled framing is a MID-DISTANCE view, worked out by W from the stage: the look point is the place's centre
  (at about a third of its tallest column's height), the camera's up is the place's own up, the camera stands 12 to
  20 degrees above the ground looking slightly down, lens 30 to 38 degrees. W then picks the distance and a lens
  shift so that every column of the place (anything more than 0.3 above the curved ground, including instanced
  things placed by your first `update`) sits inside the stage, 5% clear of each side, its top 11% below the stage
  top and 5% above its bottom, YOU at most 16% of the stage height; and, on a stage beside the text, so that the
  planet's curve leaves through the stage's bottom edge rather than its inner edge (the place is nudged toward the
  outer side, then the camera backs off, until it does). The result is cached per stage size, so it never changes by
  itself. On narrow side stages this makes YOU smaller than 10% of the stage height (see the W3 report).
- `scene.shots`: only shot 0 is read, and only for its heading: the line from `look` to `pos` gives the azimuth and
  (clamped to 12..20 degrees) the height angle; `fov` is clamped to 30..38 (default 34). Optional `you: [x, z]` is
  YOU's spot on arrival for the framing (default: where `ctx.you.place` put him at build). Every other shot and the
  `p`, `compose`, `maxShift` fields are ignored (still accepted, nothing breaks). With no shots: a three-quarter
  heading toward YOU's side.
- `site:beat` `{stop, p}` and `setScene({beat})` no longer move the camera. A scene can read the value as `ctx.beat`
  (0..1, 0 when it is not the dived stop) for its own beats.
- W calls your `update(t, 0, ctx)` once right after `build` (with `ctx.dive` 0, not arrived), before it measures
  the place, so instanced things you place in `update` count for the framing. Keep that first call side-effect free
  apart from placing things.
- Through the dive the camera turns, closes in (log scale) and changes lens in one eased move, and the place's own
  spot glides on the stage in a straight line from where it sits on the globe to where the settled framing puts it
  (no dip, no overshoot, the same on every pass, reversible). Your group grows from 0 to full between dive 0.12 and
  0.62 (critically damped, no overshoot); the landmark stand-in sinks once dive passes 0.3, so the two overlap.
- The framing is recomputed (continuously, by bisection) whenever the stage changes size, so a stage that grows
  while the dive runs (the page's text-first layout) changes the picture smoothly, never in a jump. The camera
  keeps the place it dived into until the dive has eased all the way out (below 0.002) before it takes the next
  stop's place, so a roll to the next dived stop never swaps framings half way. The planet's idle bob stops once a
  dive is under way, so a part-dived view (a hash jump lands at about 0.5) holds perfectly still.
- A place's shaders are compiled when it is built (a section early, `compileAsync` where the browser has it) and
  it is drawn once into a 1 px corner on the next frame, so its first frame in the dive does not stall.
- Once arrived, the planet's body under the place steps back toward the field colour (30% on light fields, 55% on
  dark ones), so the place is the brightest thing in the picture. The drawn area still runs on past the stage to any
  window edge the stage nearly touches. `WORLD.bounds()` stays clipped to the stage.
- What-ifs run in three stages over about 6 s and then put themselves back: stage 1 at 0 s, 2 at 1.8 s, 3 at 3.6 s,
  reset at 5.8 s (reduced motion: straight to stage 3, held, reset at 4 s). `ctx.whatIfStage` (0..3) and
  `ctx.whatIfT` (seconds) tell your scene where it is; your `whatIf(null)` is called on reset. Window event
  `world:whatif` `{mode, stage}` fires at each stage and with `{mode: null, stage: 0}` on reset; `window.SFX.play`
  is called with the mode name at stage 1 (`pop` for lava/clones), `whoosh`/`thud` at stages 2 and 3, `reset` at
  the end. The camera reacts gently (calm pass: gravity a slow lift, typhoon a sway of a few px and a slight lean,
  stop an eased look east, no whip), eased in and out, and is back on exactly the settled framing once the what-if
  has put itself back (also when the page cuts it short); scenes do not move it.
  Planet pokes use the same clock (about 6 s each now, not 2.6 s).
- `WORLD.endCard(p)` (0..1): the footer's end card. The planet backs off and all seven places stand on its rim at
  once, YOU on top waves once when p passes 0.6. Reverses cleanly. Until the page has called it once, p is worked
  out from how far `#foot` has come into the window while Contact is the stop.
- `ctx.you.attach(obj, 'handR' | 'handL' | 'head')`: parents `obj` (built in scene units) to that bone of YOU;
  returns a function that detaches it. Everything attached is dropped when your scene is disposed.
- `ctx.you.play(clip, {loop: true, speed})`: `speed` (0.25..3) now applies to looping clips too (Walk, Run...).
- Press and hold: a press in an arrived place no longer freezes the world if your scene has `holds: true` or your
  `onPointer` returns true for the `down` event. `move` events now reach `onPointer` during a press (mouse and
  touch) as well as on hover, with `x, y, hit` like the other types.
- `ctx.stage`: the current stage rectangle `{x, y, w, h}` in CSS px (kept up to date every frame).
- Depth (round 3): the key light sits about 55 degrees to the side of the camera and follows its heading loosely;
  fill is low at street level. On `high`, scene meshes cast and receive real cast shade automatically (one 2048 depth map around
  the arrived place); set `mesh.userData.cast = false` to stop one casting. Transparent meshes only receive.
  On `low` there is no depth map: call `ctx.contact(obj, radius)` to put a flat ground patch under a person, car,
  tree or prop (a multiply patch: a darker tone of whatever it lies on; shown on low only, returns the mesh), or
  use `ctx.contactMat` for your own instanced patches.
- Distance fade: far things mix toward the exact field colour of the place, up to 60% about 18 units beyond the
  look point (MeshStandard/Lambert/Phong materials, patched automatically; a material with its own
  `onBeforeCompile` is left alone). Never add your own fog.
- Separation: `ctx.field` is your place's field colour (hex); `ctx.separate(color, ratio)` returns `color` moved
  darker (light fields) or lighter (dark fields) until it stands at least `ratio`:1 (default 1.5) in luminance from
  the field. Use it for big landmark surfaces.
- Foreground: `userData.foreground = true` on a group still leaves it out of `WORLD.bounds()`, but with the calm
  mid-distance framing nothing stands near the camera; the two dived places use no foreground props.
- Zoomed-out size: the disc is min(0.63 x the stage height, 0.8 x the stage width), because YOU with raised arms
  on top of the planet must also fit inside the stage. So for a disc of about 0.33 of a 1060 px window (350 px) the
  page gives a stage about 555 px tall, or about 440 px wide.
- `ctx.person({shirt, pants, skin, hair, belt, pose})` (calm pass): another person made from YOU's own model,
  baked once into a still pose (`'idle'`, `'walk'` or `'sit'`, the sit pose sitting on the ground like YOU's
  SitDown), shared geometry, one material per colour. Returns a Group in scene units (1.8 tall, feet at 0, front
  +Z like YOU) to plant yourself, or null if YOU's model did not load. Never give anyone YOU's yellow shirt.
- `ctx.project(x, y, z)`: a point of your scene to CSS px on the page as drawn this frame, `{x, y, visible}`.
- `ctx.beat`: the page's `site:beat` p for your stop (0..1).
- Test hooks, not part of the contract (may change): `WORLD._rawBounds()`, `WORLD._hitTest(x, y)`,
  `WORLD._guyRect()`, `WORLD._poke()`, `WORLD._stats` (also `tris`, `calls`, `geos`, `texs`), `WORLD._comp()`
  (the settled framing: `frame.D`, `el`, `az`, `fov`, `youF`), `WORLD._cam`, `WORLD._placePx(stop)`,
  `WORLD._snapDive(v)`, `WORLD._lmRect(stop)` (a landmark's box on the page, plus `parts`: each mesh's own box).
- FIX R4 (F-world, 21 Nov 2026), additions only:
  - Optional scene hook `pause(on, ctx)`: `WORLD.pause()` calls it with `true` and `WORLD.resume()` with
    `false` on every built scene. films.js uses it to pause the drive-in's own video under the page's full ad player
    (the next frame after `resume` plays it again if the place is still arrived). The page must call `WORLD.pause()`
    when it opens the full player and `WORLD.resume()` when it closes it.
  - Scene files load when the visitor is one section away counted in the PAGE's order (its `[data-stop]` sections:
    hero, ads, films, tinyworld, ...), so `tinyworld.js` is no longer fetched at the hero; disposal at two away, same
    order. Without `[data-stop]` sections (test harnesses) the planet's order below is used.
  - When the stage relocates (its centre jumps by over a quarter of its size between frames, e.g. the hero place
    to the companion place in one wheel notch), the picture settles straight on the new stage and the planet fades in
    there over about 0.35 s (canvas opacity), instead of sliding into the new stage from the edge nearest the old
    one (that landed it about 500 px away in one frame). It is never drawn outside the newest stage: a glide across the
    gap would cross the HUD readouts that sit between the hero place and the companion place on wide screens. Smaller
    changes keep the stage spring. Test hook `WORLD._reloc()` = `{count, fade}`.
  - The companion landmarks (ads, workflow, bwgu, about, contact) are one bigger silhouette each (billboard with ad
    bars, conveyor through three machines, film camera with reels on a tripod and a clapper, finish arch, letterbox),
    about 0.67 to 0.83 of the disc's height, standing 0.6 to 0.94 rad round the rim from YOU at his depth,
    straightened 70% toward upright; they shrink on the end card so the card is as before. tinyworld and films keep
    their landmarks and spot.
    On a narrow companion stage (1440x900, 1280x720) a companion landmark would reach past the stage's left edge,
    so while one is up the planet slides right inside its stage (eased with the landmark's rise, never past its own
    room on the right; 0 at 2000x1060 and on the tall and phone bands) instead of being drawn smaller.
  - Still detail (owner, 21 Nov: "a bit less detailed now"; nothing added moves by itself): the sea steps lighter
    in two tones next to the shore; on the face of the planet the camera always sees (never near its outline) there
    are small tree clusters, small houses along short roads, a few boats and small islands (instanced, 9 draw
    calls, a lighter set on low; kept off YOU's lane, the landmark spots and the ground the two dived places
    cover; they sink into the planet as a dive begins, and boats hide on lava). Each companion landmark is a small
    set: the silhouette plus three to five props (bench, lamp, bushes; crates and parcels; director's chair, light,
    cable; cones and a water table; parcels and a pot plant), merged into one mesh per material. tinyworld.js has
    a still, pale skyline behind MBS and the reel screen and still promenade dressing (a lamp post, planters, blank
    signs, two moored boats); films.js has a fence behind the lot, trees along the back edge, lane arrows, a ticket
    hut, two more parked cars (not on low) and more counter items. Clouds were already at three depths.
  - Phones (max-width 768 px): the low tier renders at the device pixel ratio up to 2 (it keeps its lighter geometry
    and no depth map); high is capped at 2 everywhere. Low on wider screens stays at 1.
  - Scene notes: films.js seats YOU and the other watchers on blankets on the ground beside their cars (no bonnet
    seats: seen from behind their heads came through the roofs); tinyworld.js's default HUD reading is `3` /
    `platforms: TikTok, Instagram, YouTube` (the fight readings are unchanged).
- W4 (22 Nov 2026, "the 3D guides the eye"), additions only:
  - YOU looks at the work. On the zoomed-out planet, whenever it stands on a stop, YOU turns his body (about 1 rad)
    and his head (about 0.4 rad more) toward the text beside the stage, and pitches his head toward it. Worked out
    from the stage's place in the window: wide windows (width at least 900 and 1.3 times the height) face the larger
    room beside the stage (the text side, left on this page) with the head level, or a little up when he stands low
    in the window; tall and phone windows face the camera with a slight turn to the left, the head down toward the
    text when the stage sits in the upper half (the band), up when it sits in the lower half (the phone's first
    screen). While the planet rolls he faces the way he walks; the blend follows the roll's own sprung progress
    (full turn within about a third of a stop from either end), so it is eased with the roll and the same scrolled
    either way. It never turns on a timer: the old "look ahead after 4 s idle" turn and the glance back at the
    landmark after a roll are gone; the sit after 15 s idle keeps the same facing. Inside a dived place the scene
    sets his facing as before. The cursor still turns his head on fine pointers while it is over the stage.
  - `WORLD.setFocus({x, y})` (optional): a page point in CSS px (viewport) YOU should face instead, e.g. the
    headline's centre; `WORLD.setFocus(null)` goes back to the automatic side. Call it once per section or layout
    change, not every scroll tick (he turns to it).
  - Test hook (not part of the contract): `WORLD._face()` = `{yaw, goal, headYaw, headPitch, aimK, aim}`.
  - tinyworld.js: the reel screen is now a big outdoor LED wall on the bay's east bank (3.6 x 6.4 scene units, 9:16,
    about two thirds of MBS's height, on a steel frame), facing the promenade; YOU, his head turned up to it, and the
    people on the promenade face it. It plays the real reel, muted and looping, on the high tier while the place is
    arrived; on the low tier and with reduced motion it shows the reel's cover (`img/tw-*.jpg`) until the screen is
    tapped. The reel follows the page: whichever `.clip--reel` video starts playing (hover, press or the tile in view)
    switches the screen to that reel (a capture `play` listener on the document; nothing on the page changes). Its
    `pause` hook stops the video under `WORLD.pause()`. The three blocks east of the bay are gone and the Supertrees
    moved beside the screen. No default HUD reading any more (the fight sends an empty reading when it ends).
  - films.js: the drive-in also follows `play` on the `.clip--ad` videos (hover, the tile in view), as well as clicks.
    No default HUD reading any more.

## Stop names
`hero`, `tinyworld`, `ads`, `films`, `workflow`, `bwgu`, `about`, `contact` (the planet's order round the rim; the page's
section order is hero, ads, films, tinyworld, workflow, bwgu, about, contact).
`uncooked` is accepted everywhere as an alias of `bwgu`. `WORLD.stops` maps each name to its planet angle.

## Page side (Builder P)

### `WORLD.setStage({x, y, w, h})`
The stage rectangle in CSS px, viewport coordinates (fixed, never a scrolling element's rect). Call on load, on
resize and whenever `layout()` changes shape. The canvas covers the window but everything 3D (planet, YOU,
clouds, rain, scenes) is drawn with a scissor limited to this rectangle, and the planet is sized so that
`WORLD.bounds()` always lies inside it.
```js
var r = stageEl.getBoundingClientRect();
WORLD.setStage({ x: r.left, y: r.top, w: r.width, h: r.height });
```

### `WORLD.setScene({from, to, roll, dive})`
Call every frame (or on every scroll tick) with values computed from scroll. `from` and `to` are stop names,
`roll` 0..1 is how far the planet has rolled from `from` to `to` (1 = `to` is up under YOU), `dive` 0..1 is how
far the camera has dived into `to` (0 = whole globe, 1 = arrived). W springs toward these; P never eases them.
Dive is only honoured once `roll` is 1 (well, above 0.98); while rolling, pass `dive: 0`.
```js
WORLD.setScene({ from: 'hero', to: 'tinyworld', roll: 1, dive: 0.62 });
```
For hero and contact, pass `from === to` and `dive: 0` (they have no dive; contact may dive later if a scene
registers for it).

### `WORLD.whatIf(mode)`
`'gravity' | 'typhoon' | 'stop' | null` (null = put it back). Zoomed out the whole planet plays it; when the
current stop is arrived (dive above 0.5) and its scene has `whatIf`, the scene plays it instead.
```js
btn.addEventListener('click', function () { WORLD.whatIf('typhoon'); });
```

### `WORLD.wave()`
YOU turns to the camera and waves once.
```js
WORLD.wave();
```

### `WORLD.pause()` / `WORLD.resume()`
Stop / restart the render loop (W also pauses by itself when the tab is hidden).
```js
quickView.addEventListener('open', function () { WORLD.pause(); });
```

### `WORLD.discRect()`
`{x, y, w, h}` in CSS px of the planet disc as drawn now (null before placement). Use it to grow the field
colour circle out of the planet.
```js
var d = WORLD.discRect(); if (d) circle.style.left = (d.x + d.w / 2) + 'px';
```

### `WORLD.bounds()`
`{x, y, w, h}` in CSS px: the union of everything 3D that matters as drawn this frame (planet disc, YOU with
raised arms and any tumble, the active landmark or scene; clouds excluded). Always inside the stage rectangle
(W scales the planet down if it would not fit). Null before placement or after failure.
```js
var b = WORLD.bounds(); // overlap test: assert b is inside the stage and touches no text box
```

### `WORLD.ready`, `WORLD.quality`, `WORLD.ok`
`ready` is a Promise resolved when the planet is in and the intro starts. `quality` is `'high'` or `'low'`
(read it; `WORLD.setQuality('low')` forces a tier, `?world=low` in the URL too). `ok` is true while 3D runs.
```js
WORLD.ready.then(function () { document.documentElement.classList.add('world-in'); });
```

### Old calls (thin wrappers, still work)
`setTarget({rect, stop, angle})` sets the stage from `rect` and rolls to `stop`; `setActive(stop)` is
`setScene({from: stop, to: stop, roll: 1, dive: 0})`; `screenPos(stop)` returns `{x, y, visible}`.

### Window events (all `CustomEvent`, data in `event.detail`)
| Event | detail | When |
|---|---|---|
| `world:ready` | `{quality}` | planet built, intro starting |
| `world:intro-done` | `null` | intro finished |
| `world:failed` | `{reason}` | no WebGL / context lost: show the still pictures |
| `world:hud` | `{stop, left: {value, caption}, extra}` | a scene (or W) has a new HUD reading for its stop |
| `world:poke` | `{title, mode}` | the planet was clicked zoomed out; show `title` for 3 s |
| `world:scene` | `{stop, state}` | `state` = `'loaded'`, `'arrived'`, `'left'`, `'disposed'` |
```js
addEventListener('world:poke', function (e) { hudLeft.show(e.detail.title, 3000); });
addEventListener('world:hud', function (e) { if (e.detail.stop === currentStop) hudLeft.set(e.detail.left); });
```
`world:poke` titles, in order: `What if the world lost gravity?`, `What if a typhoon hit Singapore?`,
`What if the Earth stopped spinning?`, `What if the floor really was lava?`, `What if everyone turned into you?`
(modes `gravity`, `typhoon`, `stop`, `lava`, `clones`).

## Scene side (scene builders)

A scene is a plain script `site/js/scenes/<stop>.js` that calls `WORLD.registerScene(stop, scene)`. W loads it
lazily (a `<script>` tag) when the visitor is one section away and disposes it when they are two away. Until it
registers, the v2 landmark stands in. W only requests files for stops listed in `WORLD.sceneFiles` (default
`['tinyworld']`; the page may set `window.WORLD_SCENES = ['tinyworld', 'ads', ...]` before world.js runs, or
the lead adds the stop to `SCENE_FILES` in world.js), so a missing file never causes a 404 in the console.

### `WORLD.registerScene(stopName, scene)`
```js
WORLD.registerScene('ads', {
  build: function (ctx) { var g = new ctx.THREE.Group(); /* ... * / return g; },  // required, called once
  update: function (t, dt, ctx) { /* every frame while visible * / },            // required
  onPointer: function (ev, ctx) { return false; },  // optional; return true if you used the click
  whatIf: function (mode, ctx) { return true; },    // optional; mode null = reset; return true if handled
  setQuality: function (q) { },                      // optional; 'high' | 'low' (also passed in ctx.quality)
  pause: function (on, ctx) { },                     // optional (fix r4); WORLD.pause() / resume(): stop your own media
  dispose: function () { }                           // required: stop timers, free what you made yourself
});
```

### Scene space (where you build)
- The group you return is placed on the planet at your stop, origin on the ground, **+Y up**, **+Z toward the
  camera**, **+X to screen right**. Units: YOU is **1.8 units tall** (think metres).
- The planet under you is a sphere of radius **`ctx.R` = 14 units**, centred at `(0, -14, 0)`. Ground at
  `(x, z)` is at `y = ctx.groundY(x, z)` (0 at the centre, curving down). Use `ctx.plant(obj, x, z, ry)` to stand
  an object on the curved ground, upright to the sphere.
- Build inside a footprint of radius **9** around the origin and up to **12** high. The settled camera shows the
  whole place from mid-distance as a small set on the planet's curve, so the wider the place, the smaller it is
  drawn: keep it narrow (about 13 units across or less) and stand tall landmarks only partly tipped with the curve
  if they would otherwise lean more than about 8 degrees (tinyworld.js `plantUp`).
- The background is the section's flat field colour: never add a sky dome, fog, gradient or background.
- During the dive W scales your group from 0 to full (no overshoot) as the camera arrives, so your own `build`
  should place everything at its final size.

### `ctx` (same object on every call)
| Field | What |
|---|---|
| `ctx.THREE`, `ctx.THREEX` | three.js and the extras (`THREEX.RoundedBoxGeometry`, `THREEX.GLTFLoader`, ...) |
| `ctx.stop` | your stop name |
| `ctx.palette` | `{sea, land, land2, landDark, tree, trunk, white, cream, orange, yellow, red, ink, dark, grey, navy, glass, glassDark, shirt, pants, skin, lava}` (hex strings) |
| `ctx.box(parent, w, h, d, color, x, y, z)` | box mesh whose origin is the middle of its base; returns the mesh |
| `ctx.rbox(parent, w, h, d, radius, color, x, y, z)` | rounded box, same origin rule |
| `ctx.cyl(parent, rTop, rBottom, h, segments, color, x, y, z)` | cylinder, origin at its base |
| `ctx.mat(color, opts)` | shared flat-shaded `MeshStandardMaterial` (cached per colour+opts; never dispose it) |
| `ctx.instanced(geometry, material, count)` | `InstancedMesh`, dynamic, not frustum culled |
| `ctx.setInstance(mesh, i, x, y, z, ry, sx, sy, sz)` | write one instance matrix (call `mesh.instanceMatrix.needsUpdate = true` after the loop) |
| `ctx.plant(obj, x, z, ry)` | stand `obj` on the curved ground at `(x, z)`, turned `ry` about its up |
| `ctx.groundY(x, z)` | ground height at `(x, z)` |
| `ctx.R` | planet radius in scene units (14) |
| `ctx.you.play(clip, {loop, fade, then})` | play a clip: `Idle Walk Run Jump Victory Roll RecieveHit SitDown StandUp PickUp Punch Defeat Walk_Carry` (missing clips fall back to Idle). `then` = clip to return to after a one-shot |
| `ctx.you.place(x, z, ry)` | where YOU stands in your scene once arrived (default `0, 3, 0`) |
| `ctx.you.lookAt(x, y, z)` | turn his head toward a scene point (`null` = straight) |
| `ctx.you.clips` | names of clips that really exist |
| `ctx.hud(values)` | `values = {left: {value, caption}, extra}`; dispatches `world:hud` with your stop |
| `ctx.quality` | `'high'` or `'low'` (low: about a third of the triangles, no shadows, fewer instances) |
| `ctx.reduced` | true under reduced motion: hold poses, no travel, no loops that move across the screen |
| `ctx.dive` | 0..1, how far the camera has arrived in your scene |
| `ctx.arrived` | true when dive is above 0.9 |
| `ctx.mode` | current what-if mode or null |
| `ctx.frozen` | true while the visitor holds the planet still (stop moving things; keep rendering) |
| `ctx.time` | seconds since load (same as `t`) |
| `ctx.rand()` | seeded random 0..1 |
| `ctx.camera` | the camera (read only) |

### `onPointer(ev, ctx)` events
`ev = {type, x, y, hit}`: `type` is `'click'`, `'down'`, `'move'` or `'up'`; `x, y` CSS px; `hit` is
`{object, point}` for the nearest mesh of your group under the pointer (`point` in your scene space), or null.
Clicks only arrive when your stop is arrived. Return true to say you used it.

### Skeleton (`site/js/scenes/ads.js`)
```js
/* ads scene: a billboard street. Registers with world.js (see briefs/world-api.md). * /
(function () {
  'use strict';
  function go() {
    var W = window.WORLD; if (!W || !W.registerScene) return;
    var parts = {};
    W.registerScene('ads', {
      build: function (ctx) {
        var T = ctx.THREE, g = new T.Group(), P = ctx.palette;
        parts.board = new T.Group(); ctx.plant(parts.board, -3, -1, 0.2); g.add(parts.board);
        ctx.box(parts.board, 0.3, 4, 0.3, P.navy, 0, 0, 0);
        ctx.box(parts.board, 5, 3, 0.3, P.yellow, 0, 4, 0);
        var n = ctx.quality === 'low' ? 6 : 16;
        parts.cars = ctx.instanced(new T.BoxGeometry(1, 0.6, 0.5), ctx.mat(P.orange), n);
        g.add(parts.cars);
        ctx.you.place(1.5, 3, -0.4);
        ctx.hud({ left: { value: '30+', caption: 'campaigns since 2020' } });
        return g;
      },
      update: function (t, dt, ctx) {
        if (ctx.frozen || ctx.reduced) return;
        for (var i = 0; i < parts.cars.count; i++) {
          var x = ((t * 2 + i * 3) % 18) - 9;
          ctx.setInstance(parts.cars, i, x, ctx.groundY(x, 5), 5, 0, 1, 1, 1);
        }
        parts.cars.instanceMatrix.needsUpdate = true;
      },
      onPointer: function (ev, ctx) {
        if (ev.type === 'click' && ev.hit) { ctx.you.play('Victory', { then: 'Idle' }); return true; }
        return false;
      },
      whatIf: function (mode, ctx) { parts.mode = mode; return true; },
      dispose: function () { parts = {}; }
    });
  }
  if (window.WORLD) go(); else addEventListener('DOMContentLoaded', go);
})();
```
W removes your group and disposes its geometries after `dispose()`; materials from `ctx.mat` are kept.

*/
(function () {
  'use strict';

  var NAMES = ['hero', 'tinyworld', 'ads', 'films', 'workflow', 'bwgu', 'about', 'contact'];
  var ALIAS = { uncooked: 'bwgu' };
  var STEP = Math.PI * 2 / NAMES.length;
  var stops = {};
  NAMES.forEach(function (n, i) { stops[n] = i * STEP; });
  function norm(n) { n = ALIAS[n] || n; return typeof n === 'string' && Object.prototype.hasOwnProperty.call(stops, n) ? n : null; }
  var SCENE_FILES = (window.WORLD_SCENES && window.WORLD_SCENES.slice) ? window.WORLD_SCENES.slice() : ['tinyworld'];
  var POKES = [
    { mode: 'gravity', title: 'What if the world lost gravity?' },
    { mode: 'typhoon', title: 'What if a typhoon hit Singapore?' },
    { mode: 'stop', title: 'What if the Earth stopped spinning?' },
    { mode: 'lava', title: 'What if the floor really was lava?' },
    { mode: 'clones', title: 'What if everyone turned into you?' }
  ];

  var root = document.documentElement;
  var layer = document.getElementById('world-layer');
  var BASE = (function () {
    if (typeof window.WORLD_BASE === 'string') return window.WORLD_BASE; // test harnesses that load a copy of this file
    var s = document.currentScript && document.currentScript.src;
    try { return s ? new URL('../', s).href : ''; } catch (e) { return ''; }
  })();

  // ---------- small maths ----------
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function outCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function outBack(t) { t = clamp(t, 0, 1); var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function inOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function wrapPi(a) { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; }
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // A spring described the Apple way: response (s) and damping ratio (1 = no overshoot).
  function Spring(x, response, damping) { this.x = x; this.v = 0; this.goal = x; this.tune(response, damping); }
  Spring.prototype.tune = function (response, damping) { this.w = Math.PI * 2 / response; this.z = damping; return this; };
  Spring.prototype.step = function (dt) {
    var n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (var i = 0; i < n; i++) {
      var a = this.w * this.w * (this.goal - this.x) - 2 * this.z * this.w * this.v;
      this.v += a * h;
      // r13 pass C: an optional speed limit, so a far jump (a fast wheel flick, a scrollbar drag) glides at a steady
      // pace instead of whipping across in a frame or two
      if (this.vm) { if (this.v > this.vm) this.v = this.vm; else if (this.v < -this.vm) this.v = -this.vm; }
      this.x += this.v * h;
    }
    return this.x;
  };
  Spring.prototype.snap = function (x) { this.x = this.goal = x; this.v = 0; return this; };
  Spring.prototype.calm = function (eps) { return Math.abs(this.goal - this.x) < eps && Math.abs(this.v) < eps; };

  // ---------- public state (works before the scene exists) ----------
  var stageGoal = null, stageSnapNext = true;
  var angleGoal = 0, diveGoal = 0, diveStop = 'hero', diveWant = 'hero', curStop = 'hero';
  // r13 pass D: the page's start line asks YOU to run while the planet rolls (setScene run 0..1)
  var runHint = 0;
  var bobK = 1, SIT_WHEN_IDLE = false;
  // W4: the roll the page asked for last (its start angle and signed span), so YOU's turn toward the text can follow
  // the roll's own progress; and the page's optional focus point for him (null = worked out from the stage)
  var rollA0 = 0, rollSpan = 0, focusPt = null;
  var pageMode = null, paused = false, dirty = true, lastInput = 0, lastScroll = performance.now();
  var pending = { wave: false };
  var endGoal = 0, endSet = false, endWaved = false;   // the end card (WORLD.endCard, or worked out from #foot until the page calls it)
  var registry = {};   // stop -> {def, built, group, ...}
  function tellPause(on) {
    Object.keys(registry).forEach(function (n) {
      var e = registry[n];
      if (e && e.built && e.def && typeof e.def.pause === 'function') { try { e.def.pause(on, e.ctx); } catch (err) { /* a scene's hook must not stop the page */ } }
    });
  }
  var readyResolve;
  var readyPromise = new Promise(function (r) { readyResolve = r; });

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || null })); } catch (e) { /* very old browser */ }
  }

  var WORLD = window.WORLD = {
    stops: stops,
    ok: false,
    ready: readyPromise,
    quality: 'high',
    stop: 'hero',
    mode: null,
    sceneFiles: SCENE_FILES,
    setStage: function (r) {
      if (!r) return;
      var x = +r.x, y = +r.y, w = +r.w, h = +r.h;
      if (!isFinite(x) || !isFinite(y) || !(w > 1) || !(h > 1)) return;
      var g = stageGoal;
      if (!g || Math.abs(g.x - x) + Math.abs(g.y - y) + Math.abs(g.w - w) + Math.abs(g.h - h) > 0.5) { dirty = true; lastInput = performance.now(); }
      stageGoal = { x: x, y: y, w: w, h: h };
      if (r.snap) stageSnapNext = true;
    },
    setScene: function (o) {
      if (!o) return;
      var f = norm(o.from), t = norm(o.to);
      f = f || t; t = t || f;
      if (!f) return;
      var roll = clamp(+o.roll || 0, 0, 1), dive = clamp(+o.dive || 0, 0, 1);
      if (roll < 0.98 || t === 'hero') dive = 0;
      var a = stops[f] + wrapPi(stops[t] - stops[f]) * roll;
      if (Math.abs(a - angleGoal) > 1e-4 || Math.abs(dive - diveGoal) > 1e-4) { lastScroll = lastInput = performance.now(); dirty = true; }
      angleGoal = a; diveGoal = dive; diveWant = t;
      runHint = clamp(+o.run || 0, 0, 1);
      rollA0 = stops[f]; rollSpan = wrapPi(stops[t] - stops[f]);
      // the camera keeps its place until it has pulled all the way back out of it (no switch to the next place's
      // framing while the dive is still easing out)
      if (t !== diveStop && (!placed || diveS.x < 0.002)) diveStop = t;
      if (typeof o.beat === 'number' && isFinite(o.beat)) { beat.p = clamp(o.beat, 0, 1); beat.at = performance.now(); }
      var now = roll >= 0.5 ? t : f;
      if (now !== curStop) { curStop = now; WORLD.stop = now; stopChanged(); }
    },
    registerScene: function (name, def) {
      name = norm(name);
      if (!name || !def || typeof def.build !== 'function') return;
      var e = registry[name] || (registry[name] = {});
      e.def = def; e.failed = false; e.requested = true; e.shot0 = null;
      dirty = true;
    },
    whatIf: function (m) {
      pageMode = (m === 'gravity' || m === 'typhoon' || m === 'stop') ? m : null;
      if (pageMode && poke) { poke = null; clearTimeout(pokeTimer); }
      routeMode();
      wiStart(pageMode);
    },
    wave: function () { pending.wave = true; dirty = true; },
    // W4: the point on the page (CSS px, viewport) YOU turns toward on the zoomed-out planet, e.g. the headline's
    // centre; null = worked out from the stage (wide: the larger side beside the stage; tall/phone: below the band,
    // or above it when the stage sits in the lower half). He only turns as part of a roll or a layout change.
    setFocus: function (p) {
      focusPt = (p && isFinite(+p.x) && isFinite(+p.y)) ? { x: +p.x, y: +p.y } : null;
      dirty = true;
    },
    // the end card at the footer: 0 = off, 1 = the whole planet with all seven places on it and YOU waving
    endCard: function (p) {
      var v = clamp(+p || 0, 0, 1);
      endSet = true;
      if (Math.abs(v - endGoal) > 1e-4) { dirty = true; lastInput = performance.now(); }
      endGoal = v;
    },
    // fix r4 (QA bug 6): a built scene with a `pause(on)` hook hears about it, so its own media stops too
    // (the drive-in's video under the page's full ad player)
    pause: function () { if (paused) return; paused = true; tellPause(true); },
    resume: function () { if (!paused) return; paused = false; tellPause(false); dirty = true; start(); },
    discRect: function () { return discRectInner(); },
    bounds: function () { return boundsInner(); },
    screenPos: function (name) { return screenPosInner(norm(name)); },
    setQuality: function (q) { setQuality(q === 'low' ? 'low' : 'high'); },
    // v2 calls, thin wrappers
    setTarget: function (o) {
      if (!o) return;
      if (o.rect) WORLD.setStage({ x: o.rect.left, y: o.rect.top, w: o.rect.width, h: o.rect.height });
      var s = norm(o.stop) || curStop;
      WORLD.setScene({ from: s, to: s, roll: 1, dive: 0 });
      if (typeof o.angle === 'number') angleGoal = o.angle;
    },
    setActive: function (name) { var n = norm(name); if (n) WORLD.setScene({ from: n, to: n, roll: 1, dive: 0 }); }
  };

  // filled in once the scene exists
  var stopChanged = function () {};
  var routeMode = function () { WORLD.mode = pageMode; };
  var screenPosInner = function () { return { x: 0, y: 0, visible: false }; };
  var discRectInner = function () { return null; };
  var boundsInner = function () { return null; };
  var setQuality = function (q) { WORLD.quality = q; };
  var start = function () {};

  var canvas = null, renderer = null, dead = false;
  function fail(why) {
    if (dead) return;
    dead = true;
    WORLD.ok = false;
    if (renderer) { try { renderer.dispose(); } catch (e) { /* already gone */ } }
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (floorEl && floorEl.parentNode) floorEl.parentNode.removeChild(floorEl);
    root.classList.remove('world-live');
    if (window.console) console.info('tinyworld planet off, showing the still pictures:', why);
    emit('world:failed', { reason: String(why) });
  }

  var T = window.THREE, X = window.THREEX;
  if (!T || !X || !layer) { fail('three.js missing'); return; }

  var reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
  var phoneQ = matchMedia('(max-width: 768px)');
  var fineQ = matchMedia('(hover: hover) and (pointer: fine)');
  var forced = /[?&]world=(low|high)/.exec(location.search);
  // iPad pass (fix 4): a tablet (a touch screen wider than a phone) starts on the high tier: shadows on and a sharper
  // picture. The quality watcher in the frame loop steps it down if its frames stay slow (and back up when smooth).
  // Phones and machines with 4 cores or fewer still start low. (Safari reports at most 8 cores, often fewer, so the
  // core count is not used to judge a tablet.)
  var coarseQ = matchMedia('(pointer: coarse)');
  var tabletQ = !phoneQ.matches && coarseQ.matches && !fineQ.matches;
  var startLow = forced ? forced[1] === 'low' : (phoneQ.matches || (!tabletQ && (navigator.hardwareConcurrency || 8) <= 4));
  WORLD.quality = startLow ? 'low' : 'high';

  try {
    canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
    if (!gl) throw new Error('no WebGL2');
    renderer = new T.WebGLRenderer({ canvas: canvas, context: gl, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { fail(e.message); return; }

  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); fail('context lost'); });
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = WORLD.quality === 'high';
  renderer.shadowMap.type = T.PCFShadowMap;
  // iPad pass (fix 5): the soft contact shadow on the field, under the canvas (positioned, so DOM order sets the
  // stacking: the shadow first, the planet over it)
  var floorEl = document.createElement('div'), floorKey = '', floorVis = false;
  floorEl.className = 'world-floor'; floorEl.setAttribute('aria-hidden', 'true');
  layer.appendChild(floorEl);
  canvas.style.position = 'relative';
  layer.appendChild(canvas);

  // ---------- camera: straight on when zoomed out, dives to a horizon when arrived ----------
  var FOV = 26, FOV_IN = 20, CAM_D = 40, EL_IN = 0.3;
  var sc = new T.Scene();
  var cam = new T.PerspectiveCamera(FOV, 1, 1, 200);
  cam.position.set(0, 0, CAM_D);
  cam.lookAt(0, 0, 0);
  var HALF_TAN = Math.tan(FOV * Math.PI / 360);
  var vw = 1, vh = 1;

  // ---------- lights (logo values) ----------
  // depth: a low fill and a key light about 55 degrees to the side of the camera, so every form has a lit side
  // and a clearly darker side (the old light sat behind the camera and flattened everything)
  // (iPad pass: the levels live in LIGHT, so a test can try other values with WORLD._light)
  var LIGHT = { fill0: 1.15, fill1: 0.68, key0: 2.95, key1: 3.35 };
  WORLD._light = function (o) { if (o) Object.keys(o).forEach(function (k) { if (k in LIGHT) LIGHT[k] = +o[k]; }); dirty = true; return LIGHT; };
  var hemi = new T.HemisphereLight('#fff6e0', '#c98a2a', 0.75);
  sc.add(hemi);
  var sun = new T.DirectionalLight('#ffffff', 3.1);
  sun.castShadow = WORLD.quality === 'high';
  sun.shadow.mapSize.set(1024, 1024);   // r13 pass A: 1024 (was 2048), a quarter of the shadow work per draw
  sun.shadow.bias = -0.0004;
  sc.add(sun); sc.add(sun.target);
  var SUN_DIR = new T.Vector3(4, 7, 6);
  // the key light's direction follows the camera's heading loosely (eased, never flickers): from the camera's
  // back vector, turned 55 degrees about the local up and raised 42 degrees
  var sunDir = SUN_DIR.clone().normalize(), sunGoal = new T.Vector3(), kU = new T.Vector3(), kB = new T.Vector3(), kQ = new T.Quaternion();
  function keyLight(dt, still) {
    kU.set(0, 1, 0);
    if (diveE > 1e-4) kU.lerp(arrived.up, diveE).normalize();
    kB.copy(cam.position).sub(camT);
    kB.addScaledVector(kU, -kB.dot(kU));
    if (kB.lengthSq() < 1e-8) kB.set(0, 0, 1);
    kB.normalize().applyQuaternion(kQ.setFromAxisAngle(kU, 0.96));
    sunGoal.copy(kB).multiplyScalar(Math.cos(0.73)).addScaledVector(kU, Math.sin(0.73)).normalize();
    if (still) sunDir.copy(sunGoal);
    else sunDir.lerp(sunGoal, 1 - Math.exp(-dt / 0.8)).normalize();
  }

  var PAL = { sea: '#29A8C9', land: '#7CCB5B', land2: '#6BBE4E', landDark: '#5DAE45', tree: '#3E9B4F', trunk: '#8a5a3b',
    white: '#ffffff', cream: '#F2EBDD', orange: '#FF8A5B', yellow: '#FFC93C', red: '#E8412B', ink: '#141414', dark: '#262626',
    grey: '#3a3a3a', navy: '#2f3b5c', glass: '#BFE2F2', glassDark: '#7DB4CF', shirt: '#ffd23f', pants: '#2f3b5c', skin: '#e0ac85', lava: '#FF6A2B' };

  var FIELD_COL = { hero: '#FFC93C', tinyworld: '#BFE7F1', ads: '#FF8A5B', films: '#141414', workflow: '#f3f3f1', bwgu: '#BFE7F1', about: '#FFC93C', contact: '#141414' };
  function relLum(c) {
    function ch(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }
  // a colour moved (darker on light fields, lighter on dark ones) until it stands at least `ratio`:1 from the field
  function separate(color, field, ratio) {
    var c = new T.Color(color), f = new T.Color(field || '#BFE7F1'), Lf = relLum(f), r = ratio || 1.5, hsl = {};
    c.getHSL(hsl);
    var dark = Lf > 0.18;
    for (var i = 0; i < 40; i++) {
      var L = relLum(c), k = (Math.max(L, Lf) + 0.05) / (Math.min(L, Lf) + 0.05);
      if (k >= r && (dark ? L < Lf : L > Lf)) break;
      hsl.l = clamp(hsl.l + (dark ? -0.025 : 0.025), 0, 1);
      c.setHSL(hsl.h, hsl.s, hsl.l);
    }
    return '#' + c.getHexString();
  }
  // distance fade: far things mix toward the exact field colour (at most 60%), per material, after tone mapping
  var fadeU = { col: { value: new T.Color(1, 1, 1) }, near: { value: 1 }, far: { value: 2 }, max: { value: 0 } };
  var FADE_GLSL = 'uniform vec3 uFadeCol;\nuniform float uFadeNear;\nuniform float uFadeFar;\nuniform float uFadeMax;\n';
  function fadeInject(sh) {
    sh.uniforms.uFadeCol = fadeU.col; sh.uniforms.uFadeNear = fadeU.near; sh.uniforms.uFadeFar = fadeU.far; sh.uniforms.uFadeMax = fadeU.max;
    sh.fragmentShader = FADE_GLSL + sh.fragmentShader.replace('#include <dithering_fragment>',
      '#include <dithering_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeCol, uFadeMax * smoothstep(uFadeNear, uFadeFar, length(vViewPosition)));');
  }
  function fadeMat(mt) {
    if (!mt || mt.userData.fade || !(mt.isMeshStandardMaterial || mt.isMeshLambertMaterial || mt.isMeshPhongMaterial)) return;
    if (mt.onBeforeCompile !== T.Material.prototype.onBeforeCompile) return;   // it has its own shader patch: leave it
    mt.userData.fade = true;
    mt.onBeforeCompile = fadeInject;
    mt.needsUpdate = true;
  }
  function fadeAll(obj) { obj.traverse(function (m) { if (m.isMesh && m.material) [].concat(m.material).forEach(fadeMat); }); }
  // ground contact on the low tier: a flat patch that darkens what it lies on (a darker tone of the ground's own colour)
  var contactMat = keep(new T.MeshBasicMaterial({ color: '#9a9488', blending: T.MultiplyBlending, transparent: true, depthWrite: false, premultipliedAlpha: true }));
  var contactGeo = new T.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  var contacts = [];
  function addContact(obj, radius) {
    if (!obj || !obj.isObject3D) return null;
    var m = new T.Mesh(contactGeo, contactMat);
    m.scale.set(radius || 0.5, 1, radius || 0.5);
    m.position.y = 0.025;
    m.renderOrder = -1;
    m.userData.noBounds = true;
    m.visible = WORLD.quality === 'low';
    obj.add(m);
    contacts.push(m);
    return m;
  }
  var mats = {};
  function M(c) { return mats[c] || (mats[c] = keep(new T.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }))); }
  function keep(m) { m.userData.keep = true; return m; }
  function add(parent, geo, mat, x, y, z) {
    var m = new T.Mesh(geo, typeof mat === 'string' ? M(mat) : mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(m);
    return m;
  }
  // boxes and cylinders whose origin is the middle of their BASE, so y is where they stand
  function bx(p, w, h, d, c, x, y, z) { var g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return add(p, g, c, x, y, z); }
  function rbx(p, w, h, d, r, c, x, y, z) { var g = new X.RoundedBoxGeometry(w, h, d, 2, r); g.translate(0, h / 2, 0); return add(p, g, c, x, y, z); }
  function cyl(p, rt, rb, h, seg, c, x, y, z) { var g = new T.CylinderGeometry(rt, rb, h, seg); g.translate(0, h / 2, 0); return add(p, g, c, x, y, z); }

  // ---------- rig ----------
  // holder: placed + scaled to fit the stage. Holds the tilt, clouds, rain and YOU.
  // tilt:   the logo's 0.25 rad forward tip, so the camera sees a little of the top.
  // roller holds the original landmark and place frames. The globe rolls on a turned axle through the same foot point.
  var R = 2, GUY_H = 1.5, TILT = 0.25, GUY_Z = 0.28;
  var SR = 14, KS = R / SR;            // scene units: planet radius 14, so one scene unit is KS holder units
  var holder = new T.Group(); holder.visible = false; sc.add(holder);
  var tilt = new T.Group(); tilt.rotation.x = TILT; holder.add(tilt);
  var roller = new T.Group(); tilt.add(roller);

  var GUY_R = Math.sqrt(R * R - GUY_Z * GUY_Z) - 0.01; // his feet, in the holder's XY plane
  var guyRollerZ = (-GUY_R * Math.sin(TILT) + GUY_Z * Math.cos(TILT)) / R;
  var runLat = Math.asin(guyRollerZ * R / Math.hypot(GUY_R, GUY_Z));
  var RUN_TURN = -0.60, ROLL_AXIS = new T.Vector3(0, 0, 1);
  var runView = new T.Group(); tilt.add(runView);
  var footUp = new T.Vector3(0, Math.cos(runLat), Math.sin(runLat));
  runView.quaternion.setFromAxisAngle(footUp, RUN_TURN);
  var fromRunView = runView.quaternion.clone().invert();
  var groundRoller = new T.Group(); runView.add(groundRoller);
  var globe = new T.Group(); groundRoller.add(globe);
  // Cancel the view turn at zero roll so the hero keeps the logo's original terrain orientation.
  globe.quaternion.setFromEuler(new T.Euler(0, -0.5, 0)).premultiply(fromRunView);

  var toGroundRoller = globe.quaternion.clone();
  var toGlobe = toGroundRoller.clone().invert();
  var SPIN_AXIS_G = ROLL_AXIS.clone().applyQuaternion(toGlobe);
  // Express an original landmark or place direction in the ground's frame at this roll angle.
  function groundDir(dir, angle) {
    return dir.applyAxisAngle(ROLL_AXIS, angle).applyQuaternion(fromRunView).applyAxisAngle(ROLL_AXIS, -angle).applyQuaternion(toGlobe);
  }

  var BACK = 0.34, LM_Z = -0.24, LM_SCALE = 1.28;
  function stopDir(angle, back, z) {
    var a = angle - back, c = Math.sqrt(1 - z * z);
    return new T.Vector3(Math.sin(a) * c, Math.cos(a) * c, z);
  }
  // fix r4: the five companion landmarks (the stops that never dive) are bigger single silhouettes, so they stand
  // further round the rim from YOU (angle in rad), at his depth (so nothing hides them), and are straightened 70% of the way to upright, on a small plinth (the
  // island, only as wide as the feet).
  // [angle, straighten, size on the end card, plinth radius]. tinyworld and films keep the old spot behind him,
  // where their place grows in during the dive.
  var LM_AT = { ads: [0.76, 0.7, 0.66, 0.56], workflow: [0.86, 0.7, 0.62, 0.62], bwgu: [0.78, 0.7, 0.66, 0.56], about: [0.78, 0.7, 0.66, 0.62], contact: [0.62, 0.7, 0.7, 0.44] };
  function lmDir(n) { return LM_AT[n] ? stopDir(stops[n], LM_AT[n][0], guyRollerZ) : stopDir(stops[n], BACK, LM_Z); }
  var stopDirsGlobe = NAMES.map(function (n) { return groundDir(stopDir(stops[n], BACK * 0.4, guyRollerZ + 0.02), stops[n]); });
  var lmDirsGlobe = NAMES.map(function (n) { return groundDir(lmDir(n), stops[n]); });
  var placeDirsGlobe = NAMES.map(function (n) { return groundDir(stopDir(stops[n], 0, guyRollerZ), stops[n]); });

  var RUN_STOPS = ['hero', 'films', 'tinyworld', 'workflow', 'bwgu', 'about', 'contact'];
  var RUN_KM = [0, 7, 19.2, 25.9, 32, 37.8, 42.195];
  var RUN_MARKS = [5, 10, 15, 21.1, 25, 30, 35, 40];
  // YOU runs on the outer lane. Bias the band toward the part of the crest visible from the camera.
  var RUN_HALF = GUY_H * 0.27, RUN_OFFSET = 0.275, RUN_ARCH = 0.31;
  var RUN_BOARD_SIDE = RUN_OFFSET - RUN_HALF - 0.026;
  // Invert the Z roll at YOU's feet. The land seeds have their own offsets. Reversing into Tinyworld retraces the same curve.
  var runAngles = [stops.hero];
  RUN_STOPS.slice(1).forEach(function (n, j) {
    runAngles.push(runAngles[j] + wrapPi(stops[n] - stops[RUN_STOPS[j]]));
  });
  // Close the surface loop so the approach stays visible ahead of YOU at the last stop, too.
  var RUN_LOOP = Math.PI * 2, RUN_LENGTH = RUN_LOOP * R * Math.cos(runLat + RUN_OFFSET / R);
  function runDir(a, across) {
    return stopDir(a, 0, Math.sin(runLat + across / R)).applyQuaternion(toGlobe);
  }

  var isLandLogo = function (d) {
    return (Math.sin(d.x * 3.3 + 1.2) + Math.sin(d.y * 2.9 - 0.2) + Math.sin(d.z * 3.6 + 2.1) + 0.5 * Math.sin((d.x + d.z) * 6.0)) > 0.45 || d.y > 0.82;
  };
  var ISLAND = Math.cos(0.56), LM_ISLAND = Math.cos(0.42);
  var isLand = function (d) {
    if (isLandLogo(d)) return true;
    for (var i = 1; i < stopDirsGlobe.length; i++) if (d.dot(stopDirsGlobe[i]) > ISLAND || d.dot(lmDirsGlobe[i]) > LM_ISLAND) return true;
    return false;
  };

  // Planet faces carry their centre and a start delay, so the intro can fly them in, and a sea flag for the lava toy.
  var g = new T.IcosahedronGeometry(R, 5), P = g.attributes.position, cols = [], cens = [], dels = [], seas = [];
  var v = new T.Vector3(), a3 = new T.Vector3(), b3 = new T.Vector3(), c3 = new T.Vector3();
  var cS = new T.Color(PAL.sea), cL = new T.Color(PAL.land), cL2 = new T.Color(PAL.land2), cLava = new T.Color(PAL.lava);
  var buildFrom = groundDir(new T.Vector3(0, 0.7, 0.7).normalize(), 0);
  var i;
  for (i = 0; i < P.count; i += 3) {
    a3.fromBufferAttribute(P, i); b3.fromBufferAttribute(P, i + 1); c3.fromBufferAttribute(P, i + 2);
    v.copy(a3).add(b3).add(c3).multiplyScalar(1 / 3);
    var cx = v.x, cy = v.y, cz = v.z;
    v.normalize();
    var land = isLand(v);
    var c = land ? ((i / 3) % 2 ? cL : cL2) : cS;
    var del = 0.6 * Math.acos(clamp(v.dot(buildFrom), -1, 1)) / Math.PI + rnd() * 0.14;
    for (var k = 0; k < 3; k++) { cols.push(c.r, c.g, c.b); cens.push(cx, cy, cz); dels.push(del); seas.push(land ? 0 : 1); }
  }
  // fix r4 detail: the sea steps lighter in two tones next to the shore (still colour, no motion)
  var faceDir = [], faceLand = [];
  (function () {
    var nF = P.count / 3, landD = [], f, k;
    for (f = 0; f < nF; f++) {
      faceDir.push(new T.Vector3(cens[f * 9], cens[f * 9 + 1], cens[f * 9 + 2]).normalize());
      faceLand.push(seas[f * 3] === 0);
      if (faceLand[f]) landD.push(faceDir[f]);
    }
    var cSh1 = new T.Color(PAL.sea).lerp(new T.Color('#9fe0e6'), 0.24), cSh2 = new T.Color(PAL.sea).lerp(new T.Color('#9fe0e6'), 0.1);
    for (f = 0; f < nF; f++) {
      if (faceLand[f]) continue;
      var best = -1;
      for (k = 0; k < landD.length; k++) { var dd = faceDir[f].dot(landD[k]); if (dd > best) best = dd; }
      var ang = Math.acos(clamp(best, -1, 1)), cc = ang < 0.17 ? cSh1 : ang < 0.26 ? cSh2 : null;
      if (cc) for (k = 0; k < 3; k++) { cols[f * 9 + k * 3] = cc.r; cols[f * 9 + k * 3 + 1] = cc.g; cols[f * 9 + k * 3 + 2] = cc.b; }
    }
  })();
  g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  g.setAttribute('aCen', new T.Float32BufferAttribute(cens, 3));
  g.setAttribute('aDel', new T.Float32BufferAttribute(dels, 1));
  g.setAttribute('aSea', new T.Float32BufferAttribute(seas, 1));
  g.computeVertexNormals();
  var buildU = { value: 99 }, lavaU = { value: 0 }, dimU = { value: 0 };
  var planetMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  planetMat.userData.fade = true;
  planetMat.onBeforeCompile = function (sh) {
    fadeInject(sh);
    // calm pass: once arrived in a place, the planet's body under it steps back toward the field colour
    sh.uniforms.uDim = dimU;
    sh.fragmentShader = 'uniform float uDim;\n' + sh.fragmentShader.replace('length(vViewPosition)));', 'length(vViewPosition)));\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeCol, uDim);');
    sh.uniforms.uBuild = buildU;
    sh.uniforms.uLava = lavaU;
    sh.vertexShader = 'attribute vec3 aCen;\nattribute float aDel;\nattribute float aSea;\nuniform float uBuild;\nuniform float uLava;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n' +
      '  float bt = clamp((uBuild - aDel) / 0.34, 0.0, 1.0);\n' +
      '  float be = 1.0 - (1.0 - bt) * (1.0 - bt) * (1.0 - bt);\n' +
      '  transformed = aCen * (1.0 + (1.0 - be) * 0.8) + (transformed - aCen) * be;').replace(
      '#include <color_vertex>',
      '#include <color_vertex>\n' +
      '  float lk = aSea * clamp(uLava * 1.7 - aDel * 1.1, 0.0, 1.0);\n' +
      '  vColor.rgb = mix(vColor.rgb, vec3(' + cLava.r.toFixed(4) + ', ' + cLava.g.toFixed(4) + ', ' + cLava.b.toFixed(4) + '), lk);');
  };
  planetMat.customProgramCacheKey = function () { return 'tw-planet-v4'; };
  var planet = new T.Mesh(g, planetMat);
  planet.receiveShadow = true;
  globe.add(planet);

  function clearLane(dGlobe, margin) {
    var original = dGlobe.clone().normalize(), d = original.clone().applyQuaternion(toGroundRoller);
    var angle = Math.atan2(d.x, d.y), across = (Math.asin(clamp(d.z, -1, 1)) - runLat) * R;
    var edge = RUN_HALF + (margin || 0);
    if (Math.abs(across - RUN_OFFSET) >= edge) return original;
    return runDir(angle, RUN_OFFSET + (across < RUN_OFFSET ? -edge : edge));
  }

  var UP = new T.Vector3(0, 1, 0);

  // ---------- decor: the logo's blocks and trees (always there, the loose props for the what-if toys) ----------
  var decor = [];
  function decorAt(mesh, dir, kind) {
    var d = new T.Vector3(dir[0], dir[1], dir[2]).normalize();
    if (!isLandLogo(d)) return;
    var local = d.clone().applyQuaternion(toGroundRoller);
    var atArch = Math.abs(wrapPi(Math.atan2(local.x, local.y) - RUN_ARCH)) < 0.34;
    d = clearLane(d, atArch ? 0.28 : (kind === 'tree' ? 0.2 : 0.18));
    var near = [], nearPlace = [];
    for (var j = 1; j < lmDirsGlobe.length; j++) {
      if (d.dot(lmDirsGlobe[j]) > Math.cos(0.5)) near.push(NAMES[j]);
      if (d.dot(placeDirsGlobe[j]) > Math.cos(0.78)) nearPlace.push(NAMES[j]);
    }
    var mount = new T.Group();
    mount.position.copy(d).multiplyScalar(R);
    mount.quaternion.setFromUnitVectors(UP, d);
    mount.add(mesh);
    globe.add(mount);
    decor.push({
      mount: mount, mesh: mesh, kind: kind, dir: d.clone(), near: near, nearPlace: nearPlace, q0: mount.quaternion.clone(),
      show: new Spring(1, 0.45, 0.8), lift: 0.5 + rnd() * 0.9, ph: rnd() * 6.28, tx: (rnd() - 0.5) * 1.6, tz: (rnd() - 0.5) * 1.6,
      slideA: 0.1 + rnd() * 0.18, slideB: rnd() < 0.4 ? 0.04 + rnd() * 0.04 : 0, s: 1
    });
  }
  [['#ffffff', [0.55, 0.85, 0.25], 0.42], ['#F2EBDD', [0.75, 0.6, 0.35], 0.3], ['#ffffff', [0.35, 0.75, 0.62], 0.34],
   ['#FF8A5B', [0.62, 0.75, 0.5], 0.22], ['#F2EBDD', [-0.2, 0.85, 0.5], 0.28], ['#ffffff', [0.12, 0.69, 0.71], 0.3],
   ['#F2EBDD', [0.68, 0.69, 0.25], 0.26], ['#FF8A5B', [-0.43, 0.83, 0.36], 0.24], ['#ffffff', [0.8, 0.53, 0.29], 0.34]].forEach(function (b) {
    var m = new T.Mesh(new X.RoundedBoxGeometry(0.2, b[2], 0.2, 2, 0.03), M(b[0]));
    m.geometry.translate(0, b[2] / 2, 0);
    m.castShadow = true; m.receiveShadow = true;
    decorAt(m, b[1], 'block');
  });
  [[-0.5, 0.8, 0.4], [-0.7, 0.55, 0.5], [0.15, 0.95, -0.1], [0.9, 0.35, 0.3], [0.72, 0.69, 0.0], [-0.28, 0.83, 0.48],
   [0.16, 0.34, 0.93], [-0.36, 0.69, 0.62], [0.43, 0.83, -0.36]].forEach(function (d) {
    var t = new T.Mesh(new T.IcosahedronGeometry(0.13, 0), M('#3E9B4F'));
    t.geometry.translate(0, 0.2, 0);
    var trunk = new T.Mesh(new T.CylinderGeometry(0.025, 0.035, 0.12, 5), M('#8a5a3b'));
    trunk.position.y = 0.06;
    t.add(trunk);
    t.castShadow = true;
    decorAt(t, d, 'tree');
  });

  // ---------- fix r4 detail: still things all over the planet (owner, 21 Nov: "a bit less detailed now") ----------
  // Clusters of small trees, small houses along short roads, boats and small islands on the sea. Nothing here moves
  // by itself: it turns with the planet like the logo's blocks. All instanced (seven draw calls), a lighter set on low.
  // Kept off YOU's lane, off every landmark's spot, off the logo's own blocks and trees, and off the ground the two
  // dived places cover (their scenes stand there). Shown once the intro has built the planet; boats hide on lava.
  var detailG = new T.Group(), detailBoats = [];
  globe.add(detailG);
  (function () {
    var lo = WORLD.quality === 'low';
    var sd = 4242;
    function r2() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }
    var diveDirs = ['tinyworld', 'films'].map(function (n) { return placeDirsGlobe[NAMES.indexOf(n)]; });
    var used = decor.map(function (d) { return d.dir; });
    var tmpR = new T.Vector3();
    function faceOf(d) { var bi = 0, bd = -2; for (var f = 0; f < faceDir.length; f++) { var q = d.dot(faceDir[f]); if (q > bd) { bd = q; bi = f; } } return bi; }
    function free(d, gap) {
      tmpR.copy(d).applyQuaternion(toGroundRoller);
      if (Math.abs((Math.asin(clamp(tmpR.z, -1, 1)) - runLat) * R - RUN_OFFSET) < RUN_HALF + 0.22) return false;
      if (tmpR.z < 0.55) return false;   // only on the face the camera always sees (with the planet's tilt), never near the rim: no fuzz on the outline
      for (var j = 1; j < NAMES.length; j++) if (d.dot(lmDirsGlobe[j]) > Math.cos(LM_AT[NAMES[j]] ? 0.3 : 0.36)) return false;
      for (var k = 0; k < diveDirs.length; k++) if (d.dot(diveDirs[k]) > Math.cos(0.8)) return false;
      for (var u = 0; u < used.length; u++) if (d.dot(used[u]) > Math.cos(gap || 0.07)) return false;
      return true;
    }
    function onLand(d) { return faceLand[faceOf(d)]; }
    function randDir() { var y = r2() * 2 - 1, a = r2() * Math.PI * 2, c = Math.sqrt(1 - y * y); return new T.Vector3(c * Math.cos(a), y, c * Math.sin(a)); }
    function near(d, ang) {   // a point about `ang` rad from d in a random direction
      var t = new T.Vector3(r2() - 0.5, r2() - 0.5, r2() - 0.5).cross(d).normalize();
      return d.clone().multiplyScalar(Math.cos(ang)).addScaledVector(t, Math.sin(ang)).normalize();
    }
    var mQ = new T.Quaternion(), mH = new T.Quaternion(), mP = new T.Vector3(), mS = new T.Vector3(), mM = new T.Matrix4(), Y = new T.Vector3(0, 1, 0);
    function inst(geo, n, castS) {
      var mat = keep(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }));
      var im = new T.InstancedMesh(geo, mat, Math.max(1, n));
      im.count = 0; im.castShadow = !!castS && WORLD.quality === 'high'; im.receiveShadow = false; im.frustumCulled = false;
      detailG.add(im);
      return im;
    }
    function put(im, d, heading, sc, col, lift, fwd) {
      if (im.count >= im.instanceMatrix.count) return;
      if (fwd) {
        var up = d.clone().normalize(), fz = fwd.clone().addScaledVector(up, -fwd.dot(up)).normalize(), rx = new T.Vector3().crossVectors(up, fz).normalize();
        mQ.setFromRotationMatrix(new T.Matrix4().makeBasis(rx, up, fz));
      } else mQ.setFromUnitVectors(Y, d).multiply(mH.setFromAxisAngle(Y, heading));
      mP.copy(d).multiplyScalar(R + (lift || -0.012));
      mS.set(sc, sc, sc);
      im.setMatrixAt(im.count, mM.compose(mP, mQ, mS));
      im.setColorAt(im.count, new T.Color(col));
      im.count++;
    }
    function g1(geo, y) { geo.translate(0, y, 0); return geo; }
    var crowns = inst(g1(new T.IcosahedronGeometry(0.052, 0), 0.085), lo ? 60 : 130, true);
    var trunks = inst(g1(new T.CylinderGeometry(0.009, 0.013, 0.062, 5), 0.031), lo ? 60 : 130, false);
    var roofG = new T.ConeGeometry(0.058, 0.042, 4); roofG.rotateY(Math.PI / 4); roofG.translate(0, 0.074, 0);
    var walls = inst(g1(new T.BoxGeometry(0.07, 0.054, 0.062), 0.027), lo ? 14 : 34, true);
    var roofs = inst(roofG, lo ? 14 : 34, true);
    var roads = inst(g1(new T.BoxGeometry(0.03, 0.008, 0.056), 0.002), lo ? 40 : 90, false);
    var hulls = inst(g1(new T.BoxGeometry(0.035, 0.018, 0.09), 0.006), lo ? 4 : 8, false);
    var cabins = inst(g1(new T.BoxGeometry(0.026, 0.02, 0.03), 0.024), lo ? 4 : 8, false);
    var isles = inst(g1(new T.IcosahedronGeometry(0.085, 0).scale(1, 0.3, 1), 0.0), lo ? 3 : 6, false);
    detailBoats.push(hulls, cabins);
    var GREENS = ['#2f8a3f', '#3E9B4F', '#4fa84a', '#2a7a3a', '#5cb34e'];
    var WALLS = ['#ffffff', '#F2EBDD', '#f3d9b1', '#e9e4da'], ROOFS = ['#D2462F', '#b8321f', '#4a4f57', '#E8412B'];
    function tree(d) { var s2 = 0.8 + r2() * 0.55; put(crowns, d, r2() * 6.28, s2, GREENS[(r2() * GREENS.length) | 0]); put(trunks, d, 0, s2, '#8a5a3b'); used.push(d); }
    function house(d, fwd) { var c = WALLS[(r2() * WALLS.length) | 0]; put(walls, d, 0, 1, c, -0.012, fwd); put(roofs, d, 0, 1, ROOFS[(r2() * ROOFS.length) | 0], -0.012, fwd); used.push(d); }
    // clusters of trees on the land
    var nCl = lo ? 6 : 10, tries = 0;
    for (var c = 0; c < nCl && tries < 3000; tries++) {
      var d0 = randDir();
      if (!onLand(d0) || !free(d0, 0.1)) continue;
      c++;
      var nT = 3 + ((r2() * 2) | 0);
      for (var t = 0, tt = 0; t < nT && tt < 30; tt++) {
        var dt = t ? near(d0, 0.035 + r2() * 0.04) : d0;
        if (onLand(dt) && free(dt, 0.032)) { tree(dt); t++; }
      }
    }
    // short roads with small houses beside them
    var nRd = lo ? 2 : 3; tries = 0;
    for (var rd = 0; rd < nRd && tries < 2000; tries++) {
      var p0 = randDir();
      if (!onLand(p0) || !free(p0, 0.08)) continue;
      rd++;
      var head = new T.Vector3(r2() - 0.5, r2() - 0.5, r2() - 0.5).cross(p0).normalize(), cur = p0.clone(), segs = 0;
      for (var st = 0; st < 22; st++) {
        var nx = cur.clone().multiplyScalar(Math.cos(0.05)).addScaledVector(head, Math.sin(0.05)).normalize();
        head.copy(head).multiplyScalar(Math.cos(0.05)).addScaledVector(cur, -Math.sin(0.05)).normalize();   // stay on the great circle
        head.applyAxisAngle(nx, (r2() - 0.5) * 0.25);                                                     // a gentle bend
        if (!onLand(nx) || !free(nx, 0.035)) break;
        put(roads, nx, 0, 1, '#a39e92', -0.012, head);
        segs++;
        if (st % 3 === 1) {
          var side = new T.Vector3().crossVectors(nx, head).normalize().multiplyScalar(r2() < 0.5 ? 1 : -1);
          var hd = nx.clone().multiplyScalar(Math.cos(0.045)).addScaledVector(side, Math.sin(0.045)).normalize();
          if (onLand(hd) && free(hd, 0.035)) house(hd, head);
        }
        cur = nx;
      }
      used.push(p0);
    }
    // a few lone houses near the tree clusters
    for (var lh = 0, tl = 0; lh < (lo ? 3 : 6) && tl < 2000; tl++) {
      var dh = randDir();
      if (onLand(dh) && free(dh, 0.06)) { house(dh, near(dh, 0.5).sub(dh)); lh++; }
    }
    // boats and small islands out at sea (well clear of the shore)
    function offshore(d, ang) { var f = faceOf(d); if (faceLand[f]) return false; for (var q = 0; q < faceDir.length; q++) if (faceLand[q] && d.dot(faceDir[q]) > Math.cos(ang)) return false; return true; }
    for (var bo = 0, tb = 0; bo < (lo ? 2 : 4) && tb < 3000; tb++) {
      var db = randDir();
      if (!offshore(db, 0.2) || !free(db, 0.1)) continue;
      var hb = r2() * 6.28;
      put(hulls, db, hb, 1.35, '#ffffff', -0.004); put(cabins, db, hb, 1.35, ['#FF8A5B', '#2f3b5c', '#E8412B', '#29A8C9'][bo % 4], -0.004);
      used.push(db); bo++;
    }
    for (var is = 0, ti = 0; is < (lo ? 2 : 3) && ti < 3000; ti++) {
      var di = randDir();
      if (!offshore(di, 0.3) || !free(di, 0.16)) continue;
      put(isles, di, r2() * 6.28, 1.3 + r2() * 0.5, '#E6DDCB', -0.006);
      used.push(di);
      var dtr = near(di, 0.012);
      put(crowns, dtr, r2() * 6.28, 0.75, '#3E9B4F', 0.0); put(trunks, dtr, 0, 0.75, '#8a5a3b', 0.0);
      is++;
    }
    detailG.children.forEach(function (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    detailG.visible = false;
  })();

  // ---------- landmarks (the v2 stand-ins, shown zoomed out and for any place without a scene) ----------
  var LM = {};
  function mountAt(dirRoller, lift) {
    var up = dirRoller.clone().normalize();
    var fwd = new T.Vector3(0, 0, 1).addScaledVector(up, -up.z).normalize();
    var right = new T.Vector3().crossVectors(up, fwd).normalize();
    var grp = new T.Group();
    grp.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right, up, fwd));
    grp.position.copy(up).multiplyScalar(R + (lift === undefined ? 0.04 : lift));
    return grp;
  }
  function lmBush(c, x, z, s) { add(c, new T.IcosahedronGeometry(0.1 * s, 0), '#3E9B4F', x, 0.08 * s, z); }
  function island(p, r, depth) {
    var dp = depth || 0.26;   // the straightened landmarks get a deeper plinth, so its low side still meets the ground
    var geo = new T.CylinderGeometry(r, r * 0.74, dp, 9);
    geo.translate(0, -dp / 2, 0);
    var m = new T.Mesh(geo, [M('#5DAE45'), M('#7CCB5B'), M('#5DAE45')]);
    p.add(m);
    return m;
  }

  function buildMBS() {
    var grp = new T.Group();
    var glass = keep(new T.MeshStandardMaterial({ color: '#BFE2F2', roughness: 0.35, metalness: 0.1, flatShading: true }));
    var glassDark = keep(new T.MeshStandardMaterial({ color: '#7DB4CF', roughness: 0.4, metalness: 0.1, flatShading: true }));
    var TH = 0.98;
    [-0.32, 0, 0.32].forEach(function (x) {
      var tower = new T.Group();
      var front = new T.Mesh(new T.BoxGeometry(0.22, TH + 0.06, 0.08), glass);
      front.geometry.translate(0, (TH + 0.06) / 2 - 0.06, 0);
      front.position.z = 0.04;
      var back = new T.Mesh(new T.BoxGeometry(0.2, TH + 0.06, 0.08), glassDark);
      back.geometry.translate(0, (TH + 0.06) / 2 - 0.06, 0);
      back.position.z = -0.05;
      back.rotation.x = -0.1;
      tower.add(front, back);
      tower.position.x = x;
      tower.rotation.z = -x * 0.14;
      grp.add(tower);
    });
    var hull = new T.Shape();
    hull.moveTo(-0.58, 0.06);
    hull.lineTo(0.84, 0.06);
    hull.quadraticCurveTo(0.76, -0.02, 0.56, -0.04);
    hull.lineTo(-0.46, -0.04);
    hull.quadraticCurveTo(-0.55, -0.02, -0.58, 0.06);
    var deckGeo = new T.ExtrudeGeometry(hull, { depth: 0.24, bevelEnabled: false, curveSegments: 4 });
    deckGeo.translate(0, 0, -0.12);
    var deck = new T.Mesh(deckGeo, M('#F2EBDD'));
    deck.position.y = TH + 0.02;
    grp.add(deck);
    var leaf = M('#3E9B4F');
    [[-0.46, 0.03], [-0.3, -0.05], [-0.14, 0.04], [0.02, -0.03], [0.18, 0.05], [0.34, -0.04], [0.5, 0.02], [0.66, -0.01]].forEach(function (p) {
      var dot = new T.Mesh(new T.IcosahedronGeometry(0.035, 0), leaf);
      dot.position.set(p[0], TH + 0.11, p[1]);
      grp.add(dot);
    });
    return grp;
  }
  function buildGorilla() {
    var grp = new T.Group(), fur = '#262626';
    var body = add(grp, new T.IcosahedronGeometry(0.13, 0), fur, 0, 0.22, -0.01);
    body.scale.set(1.2, 1.0, 0.9);
    body.rotation.x = 0.35;
    add(grp, new T.IcosahedronGeometry(0.07, 0), fur, 0, 0.34, 0.08);
    add(grp, new T.BoxGeometry(0.07, 0.045, 0.04), '#5a4a40', 0, 0.32, 0.14);
    [-1, 1].forEach(function (s) {
      var arm = bx(grp, 0.065, 0.27, 0.065, fur, s * 0.13, 0, 0.07);
      arm.rotation.z = s * 0.1;
      bx(grp, 0.07, 0.13, 0.07, fur, s * 0.075, 0, -0.1);
    });
    return grp;
  }
  function lmTinyworld(c) {
    var mbs = buildMBS();
    mbs.scale.setScalar(0.84);
    mbs.position.x = -0.12;
    c.add(mbs);
    var gor = buildGorilla();
    gor.position.set(-0.5, 0, 0.34);
    gor.rotation.y = 0.5;
    gor.scale.setScalar(1.35);
    c.add(gor);
    return { h: 1.02, r: 0.74 };
  }
  // fix r4 (juror: the small landmarks did not read at the companion size): each companion landmark is ONE clear
  // silhouette, about 1.6 times its old size against the planet, no text, no logos, coloured to stand off its own
  // section's field. Meta ads (orange field): a billboard on two legs, a white ad with a picture block and three
  // headline bars.
  function lmAds(c) {
    [-0.42, 0.42].forEach(function (x) { bx(c, 0.09, 0.8, 0.09, '#141414', x, 0, 0); });
    bx(c, 1.32, 0.84, 0.1, '#141414', 0, 0.74, 0);
    bx(c, 1.18, 0.7, 0.02, '#ffffff', 0, 0.81, 0.055);
    bx(c, 0.42, 0.5, 0.02, '#FFC93C', -0.32, 0.91, 0.07);
    [[0.5, 1.3], [0.42, 1.13], [0.3, 0.96]].forEach(function (b) { bx(c, b[0], 0.09, 0.02, '#141414', 0.04 + b[0] / 2, b[1], 0.07); });
    // fix r4 detail: a small set round it (still): a bench, a lamp post, two bushes
    bx(c, 0.34, 0.035, 0.12, '#a8754a', -0.1, 0.1, 0.38); [-0.24, 0.04].forEach(function (x) { bx(c, 0.03, 0.1, 0.1, '#3d444a', x, 0, 0.38); });
    bx(c, 0.035, 0.62, 0.035, '#2b2b2b', -0.44, 0, -0.2); bx(c, 0.1, 0.05, 0.1, '#f3f3f1', -0.44, 0.6, -0.2);
    lmBush(c, -0.4, 0.28, 1); lmBush(c, 0.3, -0.3, 0.8);
    return { h: 1.58, r: 0.62 };
  }
  var screenMat = keep(new T.MeshBasicMaterial({ color: '#f3f3f1' }));
  screenMat.toneMapped = false;
  var screenTex = null;
  function lmFilms(c) {
    // calm pass: the drive-in screen is a 4:5 portrait, like the ads it shows
    bx(c, 0.05, 0.4, 0.05, '#5d636b', -0.6, 0, -0.08);
    bx(c, 0.05, 0.4, 0.05, '#5d636b', 0.04, 0, -0.08);
    var strut = bx(c, 0.04, 0.55, 0.04, '#5d636b', -0.28, 0, -0.32); strut.rotation.x = 0.5;
    bx(c, 0.6, 0.74, 0.05, '#5d636b', -0.28, 0.36, -0.08);
    var face = new T.Mesh(new T.PlaneGeometry(0.52, 0.65), screenMat);
    face.position.set(-0.28, 0.36 + 0.37, -0.05);
    c.add(face);
    function car(x, z, col) {
      rbx(c, 0.2, 0.07, 0.12, 0.02, col, x, 0.025, z);
      rbx(c, 0.11, 0.06, 0.1, 0.02, col, x + 0.01, 0.09, z);
      [-0.065, 0.065].forEach(function (dx) {
        var w = add(c, new T.CylinderGeometry(0.028, 0.028, 0.13, 8), '#141414', x + dx, 0.028, z);
        w.rotation.x = Math.PI / 2;
      });
    }
    car(-0.5, 0.36, '#FF8A5B');
    car(-0.1, 0.4, '#29A8C9');
    return {
      h: 1.06, r: 0.72,
      // r13 pass A: the small drive-in's screen shows the ad's still (no video plays by itself any more)
      tick: function () {
        if (screenTex) return;
        screenTex = 'loading';
        new T.TextureLoader().load(BASE + 'video/ads/ad-3.jpg', function (tex) {
          tex.colorSpace = T.SRGBColorSpace;
          screenTex = tex;
          screenMat.map = tex;
          screenMat.color.set('#ffffff');
          screenMat.needsUpdate = true;
          dirty = true;
        }, undefined, function () { screenTex = null; });
      }
    };
  }
  // How I work with AI (paper field): a short conveyor running through three machines, parcels on the belt
  function lmWorkflow(c) {
    bx(c, 1.42, 0.07, 0.34, '#2b2b2b', 0, 0.34, 0);
    [-0.64, 0.64].forEach(function (x) { bx(c, 0.07, 0.34, 0.28, '#2b2b2b', x, 0, 0); });
    var cols = ['#29A8C9', '#FF8A5B', '#2b2b2b'];
    [-0.42, 0, 0.42].forEach(function (x, j) {
      rbx(c, 0.3, 0.68, 0.44, 0.04, cols[j], x, 0, 0);
      cyl(c, 0.16, 0.07, 0.2, 6, j === 2 ? '#FFC93C' : '#2b2b2b', x, 0.68, 0);
      bx(c, 0.2, 0.2, 0.02, j === 2 ? '#FFC93C' : '#ffffff', x, 0.3, 0.225);
    });
    [-0.21, 0.21, 0.6].forEach(function (x) { rbx(c, 0.13, 0.13, 0.13, 0.02, '#E8412B', x, 0.41, 0); });
    // fix r4 detail: crates waiting at the front, a parcel pile, a bush behind
    bx(c, 0.17, 0.17, 0.17, '#b07a4a', -0.3, 0, 0.42); bx(c, 0.13, 0.13, 0.13, '#c48c58', -0.3, 0.17, 0.42); bx(c, 0.15, 0.15, 0.15, '#b07a4a', -0.1, 0, 0.44);
    rbx(c, 0.1, 0.1, 0.1, 0.015, '#E8412B', 0.2, 0, 0.44); rbx(c, 0.09, 0.09, 0.09, 0.015, '#FFC93C', 0.28, 0, 0.36);
    lmBush(c, 0.0, -0.36, 0.9);
    return { h: 0.9, r: 0.8 };
  }
  // Before We Grow Up (sky field): a film camera with two reels on a tripod, and a clapperboard beside it
  function lmBwgu(c) {
    var apex = new T.Vector3(-0.24, 0.86, 0);
    [0.35, 2.45, 4.3].forEach(function (a) {
      var foot = new T.Vector3(apex.x + Math.cos(a) * 0.36, 0, Math.sin(a) * 0.3);
      var len = foot.distanceTo(apex);
      var leg = new T.Mesh(new T.CylinderGeometry(0.026, 0.026, len, 6), M('#2b2b2b'));
      leg.position.copy(foot).add(apex).multiplyScalar(0.5);
      leg.quaternion.setFromUnitVectors(UP, apex.clone().sub(foot).normalize());
      c.add(leg);
    });
    var camG = new T.Group(); camG.position.copy(apex); c.add(camG);
    rbx(camG, 0.48, 0.3, 0.22, 0.03, '#262626', 0, 0, 0);
    [[-0.11, 0.42, 0.15], [0.17, 0.4, 0.13]].forEach(function (r) {
      var reel = add(camG, new T.CylinderGeometry(r[2], r[2], 0.06, 14), '#3a3a3a', r[0], r[1], 0);
      reel.rotation.x = Math.PI / 2;
      var hub = add(camG, new T.CylinderGeometry(0.035, 0.035, 0.07, 8), '#d9d2c4', r[0], r[1], 0.005);
      hub.rotation.x = Math.PI / 2;
    });
    var lens = add(camG, new T.CylinderGeometry(0.07, 0.09, 0.18, 10), '#141414', 0.33, 0.15, 0);
    lens.rotation.z = -Math.PI / 2;
    var clap = new T.Group(); clap.position.set(0.44, 0, 0.06); c.add(clap);
    bx(clap, 0.36, 0.3, 0.035, '#141414', 0, 0, 0);
    [0.08, 0.17].forEach(function (y) { bx(clap, 0.28, 0.025, 0.012, '#ffffff', 0, y, 0.022); });
    var arm = new T.Group(); arm.position.set(-0.18, 0.31, 0); arm.rotation.z = 0.38; clap.add(arm);
    bx(arm, 0.36, 0.07, 0.035, '#141414', 0.18, 0, 0);
    [0, 1, 2].forEach(function (j) { bx(arm, 0.06, 0.072, 0.04, '#ffffff', 0.06 + j * 0.12, -0.001, 0); });
    // fix r4 detail: a director's chair, a small light on a stand, a coil of cable, a bush
    [-0.07, 0.11].forEach(function (x) { bx(c, 0.025, 0.2, 0.14, '#2b2b2b', x, 0, 0.4); });
    bx(c, 0.22, 0.03, 0.16, '#E8412B', 0.02, 0.19, 0.4); bx(c, 0.22, 0.11, 0.02, '#E8412B', 0.02, 0.27, 0.33);
    bx(c, 0.025, 0.5, 0.025, '#2b2b2b', -0.46, 0, -0.22); rbx(c, 0.14, 0.1, 0.08, 0.015, '#f3f3f1', -0.46, 0.5, -0.22);
    var coil = add(c, new T.TorusGeometry(0.06, 0.018, 4, 10), '#141414', -0.24, 0.02, 0.36); coil.rotation.x = Math.PI / 2;
    lmBush(c, 0.32, -0.3, 0.8);
    return { h: 1.44, r: 0.62 };
  }
  // About (yellow field): a finish arch, two posts and a chequered banner, a white line on the ground between them
  function lmAbout(c) {
    [-0.52, 0.52].forEach(function (x) { bx(c, 0.12, 1.2, 0.12, '#141414', x, 0, 0); });
    bx(c, 1.32, 0.34, 0.12, '#141414', 0, 1.2, 0);
    for (var cx2 = 0; cx2 < 8; cx2++) {
      for (var cy2 = 0; cy2 < 2; cy2++) {
        if ((cx2 + cy2) % 2) bx(c, 0.16, 0.15, 0.012, '#ffffff', -0.56 + cx2 * 0.16, 1.215 + cy2 * 0.155, 0.065);
      }
    }
    bx(c, 0.94, 0.02, 0.14, '#ffffff', 0, 0, 0);
    // fix r4 detail: three cones by the line, a water table behind with cups, a bush
    [-0.3, 0, 0.3].forEach(function (x) { bx(c, 0.12, 0.02, 0.12, '#FF8A5B', x, 0, 0.42); cyl(c, 0.008, 0.05, 0.15, 8, '#FF8A5B', x, 0.02, 0.42); });
    bx(c, 0.4, 0.2, 0.14, '#f3f3f1', -0.05, 0, -0.36); [-0.16, -0.05, 0.06].forEach(function (x) { cyl(c, 0.025, 0.02, 0.05, 6, '#29A8C9', x, 0.2, -0.36); });
    lmBush(c, 0.36, -0.3, 0.8);
    return { h: 1.54, r: 0.74 };
  }
  // Contact (ink field): a red letterbox on a post, a white letter in its slot, its little flag up
  function lmContact(c) {
    bx(c, 0.1, 0.76, 0.1, '#9aa0a6', 0, 0, 0);
    var box = new T.Group(); box.position.set(0, 0.76, 0); c.add(box);
    bx(box, 0.56, 0.48, 0.42, '#E8412B', 0, 0, 0);
    var roof = add(box, new T.CylinderGeometry(0.28, 0.28, 0.42, 14, 1, false, Math.PI / 2, Math.PI), '#E8412B', 0, 0.48, 0);
    roof.rotation.x = Math.PI / 2;
    bx(box, 0.32, 0.05, 0.01, '#141414', 0, 0.3, 0.215);
    var letter = bx(box, 0.24, 0.16, 0.012, '#ffffff', 0, 0.31, 0.225);
    letter.rotation.x = -0.25;
    bx(box, 0.03, 0.34, 0.03, '#FFC93C', 0.3, 0.2, 0.1);
    bx(box, 0.03, 0.1, 0.14, '#FFC93C', 0.3, 0.44, 0.15);
    // fix r4 detail: two parcels waiting by the post, a pot plant, a bush behind
    bx(c, 0.2, 0.15, 0.16, '#c48c58', -0.26, 0, 0.26); bx(c, 0.14, 0.11, 0.12, '#b07a4a', -0.25, 0.15, 0.27);
    cyl(c, 0.06, 0.045, 0.1, 7, '#b8321f', 0.14, 0, 0.3); lmBush(c, 0.14, 0.27, 0.6);
    lmBush(c, -0.3, -0.24, 0.8);
    return { h: 1.52, r: 0.46 };
  }

  // a box in an object's own frame that holds all its meshes (for bounds)
  var tmpM = new T.Matrix4(), tmpBox = new T.Box3();
  function localBox(obj) {
    obj.updateWorldMatrix(true, true);
    var inv = obj.matrixWorld.clone().invert(), box = new T.Box3();
    obj.traverse(function (m) {
      if (!m.isMesh || !m.geometry) return;
      if (m.isInstancedMesh || m.userData.noBounds) return; // instances move; the static parts give the frame
      for (var up2 = m; up2 && up2 !== obj; up2 = up2.parent) if (up2.userData.foreground) return; // a foreground prop
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      tmpBox.copy(m.geometry.boundingBox).applyMatrix4(tmpM.multiplyMatrices(inv, m.matrixWorld));
      box.union(tmpBox);
    });
    return box;
  }

  // a light point cloud of an object's meshes, in its own frame (or through `pre`): one point per 0.6-unit column,
  // [x, top y, z, bottom y]. The arrived camera frames a place from it (a merged mesh's box is far too loose).
  function contentPoints(obj, pre) {
    obj.updateWorldMatrix(true, true);
    var inv = obj.matrixWorld.clone().invert(), m = new T.Matrix4(), p = new T.Vector3(), bins = {}, out = [];
    function put(x, y, z) {
      var k = Math.round(x / 0.6) + ',' + Math.round(z / 0.6), b = bins[k];
      if (!b) { b = bins[k] = [x, y, z, y]; out.push(b); }
      else { if (y > b[1]) { b[0] = x; b[1] = y; b[2] = z; } if (y < b[3]) b[3] = y; }
    }
    obj.traverse(function (o) {
      if (!o.isMesh || !o.geometry || o.userData.noBounds || o.visible === false) return;
      m.multiplyMatrices(inv, o.matrixWorld);
      if (pre) m.premultiply(pre);
      if (o.isInstancedMesh) {
        // instances as placed at build time (railings, benches, lamps...): the corners of each one's box
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        var bb = o.geometry.boundingBox, im = new T.Matrix4(), n2 = Math.min(o.count, 3000);
        for (var q = 0; q < n2; q++) {
          o.getMatrixAt(q, im);
          if (Math.abs(im.elements[12]) + Math.abs(im.elements[13]) + Math.abs(im.elements[14]) < 1e-6) continue; // not placed yet
          im.premultiply(m);
          for (var c = 0; c < 8; c++) {
            p.set(c & 1 ? bb.max.x : bb.min.x, c & 2 ? bb.max.y : bb.min.y, c & 4 ? bb.max.z : bb.min.z).applyMatrix4(im);
            put(p.x, p.y, p.z);
          }
        }
        return;
      }
      var pos = o.geometry.attributes.position;
      if (!pos) return;
      var stp = Math.max(1, Math.floor(pos.count / 120000));
      for (var j = 0; j < pos.count; j += stp) {
        p.fromBufferAttribute(pos, j).applyMatrix4(m);
        var k = Math.round(p.x / 0.6) + ',' + Math.round(p.z / 0.6), b = bins[k];
        if (!b) { b = bins[k] = [p.x, p.y, p.z, p.y]; out.push(b); }
        else { if (p.y > b[1]) { b[0] = p.x; b[1] = p.y; b[2] = p.z; } if (p.y < b[3]) b[3] = p.y; }
      }
    });
    return out;
  }

  // fix r4: merge a still landmark's meshes into one mesh per material (fewer draw calls for the prop sets)
  function mergeLm(content) {
    content.updateMatrixWorld(true);
    var inv = content.matrixWorld.clone().invert(), byMat = {}, drop = [];
    content.traverse(function (m) {
      if (!m.isMesh || !m.geometry || Array.isArray(m.material)) return;
      var g2 = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      ['uv', 'uv1', 'uv2'].forEach(function (a) { if (g2.attributes[a]) g2.deleteAttribute(a); });
      g2.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      var k = m.material.uuid;
      (byMat[k] = byMat[k] || { mat: m.material, list: [] }).list.push(g2);
      drop.push(m);
    });
    drop.forEach(function (m) { m.parent.remove(m); m.geometry.dispose(); });
    Object.keys(byMat).forEach(function (k) {
      var e = byMat[k], mg = X.mergeGeometries(e.list, false);
      e.list.forEach(function (g3) { g3.dispose(); });
      var mm = new T.Mesh(mg, e.mat); mm.castShadow = true; mm.receiveShadow = true;
      content.add(mm);
    });
  }
  var BUILDERS = { tinyworld: lmTinyworld, ads: lmAds, films: lmFilms, workflow: lmWorkflow, bwgu: lmBwgu, about: lmAbout, contact: lmContact };
  Object.keys(BUILDERS).forEach(function (name) {
    var mount = mountAt(lmDir(name));
    var riser = new T.Group(), fx = new T.Group(), content = new T.Group();
    mount.add(riser); riser.add(fx); fx.add(content);
    var info = BUILDERS[name](content);
    var at = LM_AT[name];
    var plinthRadius = at ? at[3] : info.r;
    island(content, plinthRadius, at ? 0.62 : 0);
    if (at) mergeLm(content);   // fix r4: the companion sets are still, so each draws as one mesh per material
    content.scale.setScalar(LM_SCALE);
    var lean = at ? at[0] * at[1] : 0;   // straightened toward upright (undone on the end card)
    content.rotation.z = -lean;
    info.h *= LM_SCALE;
    content.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    roller.add(mount);
    riser.visible = false;
    LM[name] = { name: name, mount: mount, riser: riser, fx: fx, content: content, h: info.h, tick: info.tick || null,
      rise: new Spring(0, 0.5, 0.62), ph: rnd() * 6, box: null, p0: mount.position.clone(), q0: mount.quaternion.clone(), carded: false,
      lean: lean, cardK: at ? at[2] : 1, plinthRadius: plinthRadius };
  });

  // ---------- route: one surface batch and one batch for all the posts, plaques and the start arch ----------
  var runRoad = new T.Group(), runSigns = null, runSignMaterial = null, runBoardKey = '', runCheckAt = 0;
  var runRoll = { value: 0 }, runGapDir = new T.Vector3();
  // lead, r10: a board shows only near the visitor's own km (the route retraces part of the loop, so a board for a
  // later km can stand on ground that is in view early: 21.1 stood beside START on the first screen)
  var runKm = { value: -1 }, runFinish = 0;
  var runGapNames = NAMES.slice(1), runGapFade = { value: new Float32Array(runGapNames.length) };
  var runGaps = { value: runGapNames.map(function (n) {
    var width = LM[n].plinthRadius * LM_SCALE;
    // The two unleaned plinths narrow below their top rim, which sets their ground footprint.
    var radius = LM_AT[n] ? Math.atan2(width + 0.09, R - 0.18) : Math.atan2(width, R + 0.04);
    return new T.Vector4(0, 0, 0, Math.cos(radius));
  }) };
  runRoad.visible = false;
  globe.add(runRoad);

  // A radial hit on the actual planet triangles keeps both the ribbon and the posts seated on the facets.
  var runSurface = (function () {
    var ray = new T.Ray(), hit = new T.Vector3();
    var faces = faceDir.map(function (d, j) {
      var verts = [0, 1, 2].map(function (k) { return new T.Vector3().fromBufferAttribute(P, j * 3 + k); });
      var limit = Math.min.apply(null, verts.map(function (p) { return d.dot(p) / R; })) - 1e-6;
      return { d: d, limit: limit, verts: verts };
    });
    return function (dir) {
      ray.direction.copy(dir);
      for (var j = 0; j < faces.length; j++) {
        var f = faces[j];
        if (dir.dot(f.d) < f.limit) continue;
        if (ray.intersectTriangle(f.verts[0], f.verts[1], f.verts[2], false, hit)) return hit.length();
      }
      return R;
    };
  })();

  function runMaterial(atlas) {
    var ribbon = !atlas;
    var mat = keep(new T.MeshBasicMaterial({ map: atlas || null, vertexColors: !ribbon, toneMapped: false,
      transparent: true, alphaTest: 0.005, polygonOffset: ribbon, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    mat.customProgramCacheKey = function () { return ribbon ? 'run-ribbon' : 'run-signs'; };
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uRunGaps = runGaps; sh.uniforms.uRunGapFade = runGapFade;
      var v = 'varying vec3 vRunAnchor;\n';
      var f = v + 'uniform vec4 uRunGaps[' + runGapNames.length + '];\nuniform float uRunGapFade[' + runGapNames.length + '];\n';
      var vs = ribbon ? 'vRunAnchor = position; vRunUV = uv;' : 'vRunAnchor = aRunSign.xyz;';
      var fs = 'vec3 routeDir = normalize(vRunAnchor);\n' +
        'for (int j = 0; j < ' + runGapNames.length + '; j++) {\n' +
        '  vec4 gap = uRunGaps[j];\n' +
        '  if (dot(routeDir, gap.xyz) > gap.w' + (ribbon ? '' : ' - 0.023') + ') diffuseColor.a *= 1.0 - uRunGapFade[j];\n' +
        '}\n';
      if (ribbon) {
        var lo = WORLD.quality === 'low';
        v += 'varying vec2 vRunUV;\n'; f += 'varying vec2 vRunUV;\nuniform vec3 uAsphalt, uKerb, uDash;\n';
        sh.uniforms.uAsphalt = { value: new T.Color('#2c3038') };
        sh.uniforms.uKerb = { value: new T.Color('#c8c3b7') };
        sh.uniforms.uDash = { value: new T.Color('#f2ebdd') };
        sh.uniforms.uDashPeriod = { value: RUN_LENGTH / Math.round(RUN_LENGTH / (lo ? 0.36 : 0.27)) };
        f += 'uniform float uDashPeriod;\n';
        fs += 'float across = abs(vRunUV.y);\n' +
          'float aa = max(fwidth(vRunUV.y), 0.0001);\n' +
          'float kerb = smoothstep(0.012 - aa, 0.012 + aa, across - ' + (RUN_HALF - 0.035).toFixed(4) + ');\n' +
          'float dash = abs(fract(vRunUV.x / uDashPeriod) - 0.5);\n' +
          'float da = max(fwidth(vRunUV.x) / uDashPeriod, 0.0001);\n' +
          'float paint = (1.0 - smoothstep(0.024 - aa, 0.024 + aa, across)) * (1.0 - smoothstep(0.27 - da, 0.27 + da, dash));\n' +
          'diffuseColor.rgb = mix(mix(uAsphalt, uKerb, kerb), uDash, paint);\n';
      } else {
        sh.uniforms.uRunRoll = runRoll; sh.uniforms.uRunKm = runKm;
        v += 'attribute vec4 aRunSign;\nattribute float aRunKm;\nuniform float uRunRoll;\nuniform float uRunKm;\nvarying float vRunAlpha;\n';
        f += 'varying float vRunAlpha;\n';
        // A marker has just under a radian of visibility. The spacing keeps at most two in that window.
        vs += '\nfloat ahead = mod(max(0.0, aRunSign.w) - uRunRoll + PI, 2.0 * PI) - PI;\n' +
          'vRunAlpha = aRunSign.w < 0.0 ? 1.0 - smoothstep(0.18, 0.36, abs(ahead)) :\n' +
          '  smoothstep(0.25, 0.47, ahead) * (1.0 - smoothstep(0.79, 1.24, ahead));\n' +
          'if (uRunKm >= 0.0) vRunAlpha *= 1.0 - smoothstep(5.0, 7.5, abs(aRunKm - uRunKm));\n' +
          'if (aRunSign.w >= 0.0) transformed -= aRunSign.xyz * (1.0 - vRunAlpha) * 0.58;';
        fs += 'diffuseColor.a *= vRunAlpha;\n';
      }
      sh.vertexShader = v + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + vs);
      sh.fragmentShader = f + sh.fragmentShader.replace('#include <alphatest_fragment>', fs + '#include <alphatest_fragment>');
    };
    return mat;
  }

  function buildRunRibbon() {
    var along = Math.ceil(RUN_LOOP * R / 0.033), across = Math.ceil(2 * RUN_HALF / 0.033);
    var positions = [], uv = [], indices = [];
    for (var j = 0; j <= along; j++) {
      var a = j / along * RUN_LOOP;
      for (var k = 0; k <= across; k++) {
        var x = lerp(-RUN_HALF, RUN_HALF, k / across), d = runDir(a, RUN_OFFSET + x);
        d.multiplyScalar(runSurface(d) + 0.0045);
        positions.push(d.x, d.y, d.z);
        uv.push(j / along * RUN_LENGTH, x);
        if (j < along && k < across) {
          var p = j * (across + 1) + k, q = p + across + 1;
          indices.push(p, p + 1, q, p + 1, q + 1, q);
        }
      }
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    var mesh = new T.Mesh(geo, runMaterial());
    mesh.userData.noBounds = true;
    mesh.renderOrder = -2;
    runRoad.add(mesh);
    return mesh;
  }
  var runRibbon = buildRunRibbon();

  function runBoardAngles() {
    var sections = window.SITE && window.SITE.sections && window.SITE.sections();
    var measured = sections && RUN_STOPS.every(function (n, j) {
      return sections[j] && sections[j].stop === n && (j === 0 || sections[j].t);
    });
    var finish = measured ? Math.min(document.documentElement.scrollHeight - window.innerHeight, sections[RUN_STOPS.length - 1].t.t1) : 0;
    runFinish = finish;
    return RUN_MARKS.map(function (km) {
      var j, fraction = 1;
      if (finish > 0) {
        var y = window.SITE && SITE.yOfKm ? Math.min(finish, SITE.yOfKm(km)) : km / RUN_KM[RUN_KM.length - 1] * finish;   // r13 pass D: the page's own km
        for (j = 1; j < runAngles.length - 1 && y >= sections[j].t.t1; j++) {}
        var t = sections[j].t, wide = t.r0 !== undefined;
        var a = wide ? t.r0 : t.L, b = wide ? t.r1 : t.en;
        fraction = wide && b <= a ? +(y >= b) : clamp((y - a) / (wide ? b - a : Math.max(1, b - a)), 0, 1);
      } else {
        for (j = 1; j < RUN_KM.length - 1 && km > RUN_KM[j]; j++) {}
        fraction = (km - RUN_KM[j - 1]) / (RUN_KM[j] - RUN_KM[j - 1]);
      }
      return { km: km, a: lerp(runAngles[j - 1], runAngles[j], fraction) };
    });
  }

  function runAtlas() {
    var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
    var ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    RUN_MARKS.forEach(function (km, j) {
      var x = j % 4 * 256, y = Math.floor(j / 4) * 128;
      ctx.fillStyle = '#f2ebdd'; ctx.fillRect(x, y, 256, 128);
      ctx.fillStyle = '#2c3038'; ctx.font = 'bold 83px sans-serif'; ctx.fillText(String(km), x + 128, y + 49);
      ctx.font = 'bold 34px sans-serif'; ctx.fillText(km === 21.1 ? 'half' : 'km', x + 128, y + 104);
    });
    ctx.fillStyle = '#f8d263'; ctx.fillRect(0, 256, 512, 128);
    ctx.fillStyle = '#2c3038'; ctx.font = 'bold 100px sans-serif'; ctx.fillText('START', 256, 325);
    var tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }

  function buildRunSigns() {
    var boards = runBoardAngles().sort(function (a, b) { return a.a - b.a || a.km - b.km; });
    // The HUD counts through holds too. Separate markers that would land at the same point on the far kerb.
    var spacing = 0.51, next = RUN_ARCH + 0.36;
    boards.forEach(function (b) { b.a = Math.max(b.a, next); next = b.a + spacing; });
    next = runAngles[runAngles.length - 1] - 0.055;
    for (var j = boards.length - 1; j >= 0; j--) { boards[j].a = Math.min(boards[j].a, next); next = boards[j].a - spacing; }
    var key = boards.map(function (b) { return b.km + ':' + b.a.toFixed(3); }).join(',');
    if (key === runBoardKey) return false;
    if (!runSignMaterial) {
      var atlas = runAtlas();
      runBoardKey = key;
      if (!atlas) return false;
      runSignMaterial = runMaterial(atlas);
    }
    runBoardKey = key;
    var parts = [];
    function part(geo, sign, color, cell) {
      var uv = geo.attributes.uv, rgb = new T.Color(color), colors = [], anchor = [], kms = [];
      for (var k = 0; k < uv.count; k++) {
        if (cell) uv.setXY(k, (cell[0] + 2 + uv.getX(k) * (cell[2] - 4)) / 1024, 1 - (cell[1] + 126 - uv.getY(k) * 124) / 512);
        else uv.setXY(k, 0.99, 0.05);
        colors.push(rgb.r, rgb.g, rgb.b); anchor.push(sign.up.x, sign.up.y, sign.up.z, sign.angle); kms.push(sign.km);
      }
      geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geo.setAttribute('aRunSign', new T.Float32BufferAttribute(anchor, 4));
      geo.setAttribute('aRunKm', new T.Float32BufferAttribute(kms, 1));
      geo.applyMatrix4(sign.frame);
      parts.push(geo);
    }
    function box(sign, w, h, d, x, y, color) {
      part(new T.BoxGeometry(w, h, d).translate(x, y, 0), sign, color);
    }
    function plaque(sign, w, h, y, z, cell) {
      var geo = new T.PlaneGeometry(w, h);
      if (z < 0) geo.rotateY(Math.PI);
      part(geo.translate(0, y, z), sign, '#ffffff', cell);
    }
    var untilt = new T.Quaternion().setFromEuler(new T.Euler(-TILT, 0, 0));
    var signQ = new T.Quaternion();
    boards.forEach(function (b) {
      var half = b.km === 21.1, w = half ? 0.45 : 0.36, h = half ? 0.25 : 0.21;
      var cell = RUN_MARKS.indexOf(b.km);
      var up = runDir(b.a, RUN_BOARD_SIDE);
      // Fix the board in the ground facing upright toward the camera midway through its visible arc.
      signQ.setFromAxisAngle(ROLL_AXIS, 0.74 - b.a).multiply(fromRunView).multiply(untilt).premultiply(toGlobe);
      var frame = new T.Matrix4().makeRotationFromQuaternion(signQ).setPosition(up.clone().multiplyScalar(runSurface(up)));
      var sign = { angle: b.a, up: up, frame: frame, km: b.km };
      box(sign, 0.039, 0.46, 0.04, 0, 0.18, '#646970');
      box(sign, w + 0.025, h + 0.025, 0.046, 0, 0.49, '#2c3038');
      plaque(sign, w, h, 0.49, 0.024, [cell % 4 * 256, Math.floor(cell / 4) * 128, 256]);
    });
    var up = runDir(RUN_ARCH, RUN_OFFSET);
    var front = up.clone().cross(SPIN_AXIS_G).normalize();
    var right = up.clone().cross(front).normalize();
    var frame = new T.Matrix4().makeBasis(right, up, front).setPosition(up.clone().multiplyScalar(runSurface(up)));
    var arch = { angle: -1, up: up, frame: frame, km: 0 };
    [-0.49, 0.49].forEach(function (x) { box(arch, 0.062, 0.79, 0.067, x, 0.28, '#41454d'); });
    box(arch, 1.06, 0.225, 0.077, 0, 0.66, '#2c3038');
    plaque(arch, 0.98, 0.18, 0.66, 0.04, [0, 256, 512]);
    plaque(arch, 0.98, 0.18, 0.66, -0.04, [0, 256, 512]);
    var geo = X.mergeGeometries(parts, false);
    parts.forEach(function (part) { part.dispose(); });
    if (runSigns) { runRoad.remove(runSigns); runSigns.geometry.dispose(); }
    runSigns = new T.Mesh(geo, runSignMaterial);
    runSigns.userData.noBounds = true;
    runRoad.add(runSigns);
    return true;
  }

  function showRunRoad(angle, endK) {
    var opacity = (1 - smooth(0.12, 0.45, diveE)) * (1 - smooth(0, 0.12, endK));
    runRoad.visible = detailG.visible && opacity > 0.005;
    if (!runRoad.visible) return;
    runRoad.scale.copy(detailG.scale);
    runRibbon.material.opacity = opacity;
    if (runSignMaterial) runSignMaterial.opacity = opacity;
    runRoll.value = wrapPi(angle);
    runKm.value = window.SITE && SITE.kmOf && runFinish > 0 ? SITE.kmOf(window.scrollY || 0) : runFinish > 0 ? 42.195 * clamp((window.scrollY || 0) / runFinish, 0, 1) : -1;
    runGapNames.forEach(function (n, j) {
      var L = LM[n], fade = smooth(0.16, 0.38, L.rise.x);
      runGapFade.value[j] = fade;
      if (fade <= 0) return;
      groundDir(runGapDir.copy(L.mount.position).normalize(), angle);
      var gap = runGaps.value[j];
      gap.set(runGapDir.x, runGapDir.y, runGapDir.z, gap.w);
    });
  }

  // a place mount for every stop: exactly where YOU stands when that stop is up. Scenes and the dive camera use it.
  var PLACE = {};
  NAMES.forEach(function (name) {
    var mount = mountAt(stopDir(stops[name], 0, guyRollerZ), 0);
    var sroot = new T.Group();
    mount.add(sroot);
    roller.add(mount);
    PLACE[name] = { mount: mount, root: sroot };
  });

  // ---------- clouds: three depths, drifting round the planet's vertical axis ----------
  var clouds = [];
  [[3.1, 0.85, -1.0, 0.95, 0.05, 1], [3.0, -1.0, 1.4, 0.85, 0.045, 1], [3.2, 0.1, 3.5, 0.9, 0.048, 1],
   [2.6, 0.6, 1.9, 0.75, -0.035, 0.6], [2.7, -1.5, -2.3, 0.7, -0.03, 0.6], [2.55, 1.0, 4.4, 0.7, -0.032, 0.6],
   [3.6, -0.4, -2.8, 0.55, 0.022, 0.3], [3.7, 1.0, 0.3, 0.5, 0.02, 0.3], [3.5, -1.85, 0.9, 0.5, 0.024, 0.3]].forEach(function (p) {
    var cg = new T.Group();
    [[0, 0, 0.22], [0.22, 0.04, 0.17], [-0.2, 0.02, 0.16], [0.08, 0.13, 0.13]].forEach(function (q) {
      var puff = new T.Mesh(new T.IcosahedronGeometry(q[2], 1), M('#ffffff'));
      puff.position.set(q[0], q[1], 0);
      cg.add(puff);
    });
    holder.add(cg);
    clouds.push({ g: cg, r: p[0], y: p[1], a: p[2], size: p[3], speed: p[4], par: p[5],
      ph: rnd() * 6.28, tx: (rnd() - 0.5) * 2, lift: 0.4 + rnd() * 0.8, yOff: new Spring(0, 0.6, 1), k: 1 });
  });

  // ---------- typhoon rain: thin streaks in one instanced mesh, spawned inside the stage ----------
  var RAIN_N = 56;
  var rainDir = new T.Vector3(-0.55, -1, 0).normalize();
  var rain = new T.InstancedMesh(new T.BoxGeometry(0.018, 0.55, 0.018), keep(new T.MeshBasicMaterial({ color: '#4a6b85' })), RAIN_N);
  rain.frustumCulled = false;
  rain.visible = false;
  holder.add(rain);
  var drops = [];
  for (i = 0; i < RAIN_N; i++) drops.push(new T.Vector3(-3.5 + rnd() * 8.5, -3 + rnd() * 7.5, -1.6 + rnd() * 4.2));
  var rainQ = new T.Quaternion().setFromUnitVectors(UP, rainDir.clone().negate());
  var mtx = new T.Matrix4(), sclV = new T.Vector3();

  // ---------- "everyone turned into you": instanced clones all over the planet ----------
  var CLONE_N = 64, cloneT = -1;
  var cloneBody = (function () {
    var parts = [[0.2, 0.42, 0.13, 0, 0, PAL.pants], [0.32, 0.4, 0.19, 0, 0.42, PAL.shirt], [0.08, 0.34, 0.08, -0.2, 0.46, PAL.shirt],
      [0.21, 0.2, 0.2, 0, 0.84, PAL.skin], [0.23, 0.06, 0.22, 0, 1.02, '#141414']];
    var geos = parts.map(function (p) {
      var bg = new T.BoxGeometry(p[0], p[1], p[2]); bg.translate(p[3], p[4] + p[1] / 2, 0);
      var col = new T.Color(p[5]), n = bg.attributes.position.count, arr = [];
      for (var j = 0; j < n; j++) arr.push(col.r, col.g, col.b);
      bg.setAttribute('color', new T.Float32BufferAttribute(arr, 3));
      return bg.toNonIndexed();
    });
    return X.mergeGeometries(geos, false);
  })();
  var cloneMat = keep(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }));
  var clonesBody = new T.InstancedMesh(cloneBody, cloneMat, CLONE_N);
  var armGeo = new T.BoxGeometry(0.08, 0.36, 0.08); armGeo.translate(0, 0.18, 0);
  var clonesArm = new T.InstancedMesh(armGeo, M(PAL.shirt), CLONE_N);
  [clonesBody, clonesArm].forEach(function (m) { m.frustumCulled = false; m.visible = false; m.castShadow = true; globe.add(m); });
  var clones = [];
  (function () {
    var gold = Math.PI * (3 - Math.sqrt(5));
    for (var j = 0; j < CLONE_N; j++) {
      var y = 1 - (j + 0.5) / CLONE_N * 2, r = Math.sqrt(1 - y * y), th = gold * j;
      var d = clearLane(new T.Vector3(Math.cos(th) * r, y, Math.sin(th) * r), 0.06);
      var q = new T.Quaternion().setFromUnitVectors(UP, d).multiply(new T.Quaternion().setFromAxisAngle(UP, rnd() * 6.28));
      clones.push({ d: d, q: q, del: rnd() * 0.5, ph: rnd() * 6.28, s: 0.3 + rnd() * 0.08, at: -1 });
    }
  })();
  var cm4 = new T.Matrix4(), cm5 = new T.Matrix4(), cp = new T.Vector3(), cs = new T.Vector3();
  var ZQ = new T.Quaternion(), Z_AX = new T.Vector3(0, 0, 1);

  // ---------- YOU ----------
  var YOU = { Shirt: '#ffd23f', Pants: '#2f3b5c', Skin: '#e0ac85', Hair: '#141414', Belt: '#2f3b5c' };
  var you = new T.Group();      // stands on the planet, does not roll; lean + position live here
  var squash = new T.Group();   // landing squash
  var facing = new T.Group();   // turns him to face along the run
  you.add(squash); squash.add(facing);
  you.position.set(0, GUY_R, GUY_Z);
  you.visible = false;
  holder.add(you);
  var FACE = Math.PI / 2 - 0.2; // profile, a touch towards the camera

  var blob = new T.Mesh(new T.CircleGeometry(0.38, 18), keep(new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false })));
  blob.visible = false;
  holder.add(blob);

  var mixer = null, acts = {}, headBone = null, neckBone = null, handBones = {}, held = [];
  // props a scene puts in YOU's hand or on his head: sized in scene units whatever his bones' scale
  var heldS = new T.Vector3();
  function stepHeld() {
    for (var i = 0; i < held.length; i++) {
      held[i].bone.getWorldScale(heldS);
      held[i].wrap.scale.setScalar(KS * holder.scale.x / (heldS.x || 1));
    }
  }
  function attachHeld(obj, where, owner) {
    var b = handBones[where] || handBones.handR;
    if (!b || !obj || !obj.isObject3D) return function () {};
    var wrap = new T.Group(); wrap.add(obj); b.add(wrap);
    var h = { bone: b, wrap: wrap, obj: obj, owner: owner };
    held.push(h);
    stepHeld();
    return function () { var i = held.indexOf(h); if (i >= 0) held.splice(i, 1); if (wrap.parent) wrap.parent.remove(wrap); wrap.remove(obj); };
  }
  function dropHeld(owner) { held.slice().forEach(function (h) { if (h.owner === owner) { held.splice(held.indexOf(h), 1); if (h.wrap.parent) h.wrap.parent.remove(h.wrap); } }); }
  var walkSpeed = 1.2, runSpeed = 3.2, airT = 0.45, guyLoaded = false, guyFailed = false;
  var LOOPS = { Idle: 1, Walk: 1, Run: 1, Walk_Carry: 1, JumpHold: 1 };
  var HOLDS = { SitDown: 1, Defeat: 1 };

  function prepareGuy(gltf) {
    var o = gltf.scene;
    o.traverse(function (m) {
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      m.material = [].concat(m.material).map(function (mt) {
        var n = mt.clone();
        if (YOU[mt.name]) n.color = new T.Color(YOU[mt.name]);
        n.metalness = 0;
        n.roughness = Math.max(0.6, n.roughness);
        n.userData.keep = true;
        return n;
      });
      if (m.material.length === 1) m.material = m.material[0];
    });
    mixer = new T.AnimationMixer(o);
    var find = function (n) { return gltf.animations.find(function (a) { return a.name === n; }); };
    WORLD.clips = gltf.animations.map(function (a) { return a.name; });
    var bone = function (n) { return o.getObjectByName(n) || o.getObjectByName(n.replace('.', '')); };
    headBone = bone('Head'); neckBone = bone('Neck');
    handBones.handR = bone('Hand.R') || bone('Wrist.R') || bone('LowerArm.R');
    handBones.handL = bone('Hand.L') || bone('Wrist.L') || bone('LowerArm.L');
    handBones.head = headBone;
    if (headBone) headRest = headBone.scale.x || 1;
    var foot = bone('Foot.L'), hips = bone('Hips');

    var tmp = new T.Vector3();
    function sample(clip, fn) {
      var act = mixer.clipAction(clip);
      act.reset().play();
      for (var s = 0; s <= 32; s++) {
        act.time = clip.duration * s / 32;
        mixer.update(0);
        o.updateMatrixWorld(true);
        fn(s / 32);
      }
      act.stop();
    }
    function strideSpeed(name) {
      var clip = find(name); if (!clip || !foot) return null;
      var lo = new T.Vector3(Infinity, 0, Infinity), hi = new T.Vector3(-Infinity, 0, -Infinity);
      sample(clip, function () { foot.getWorldPosition(tmp); o.worldToLocal(tmp); lo.min(tmp); hi.max(tmp); });
      return { units: 2 * Math.max(hi.x - lo.x, hi.z - lo.z) / clip.duration };
    }
    var jumpClip = find('Jump');
    if (jumpClip && hips) {
      var best = -Infinity;
      sample(jumpClip, function (u) { hips.getWorldPosition(tmp); if (tmp.y > best) { best = tmp.y; airT = u * jumpClip.duration; } });
    }
    var ws = strideSpeed('Walk'), rs = strideSpeed('Run');

    var idleClip = find('Idle') || gltf.animations[0];
    var idle = mixer.clipAction(idleClip);
    idle.reset().play(); mixer.update(0); o.updateMatrixWorld(true);
    var bb = new T.Box3().setFromObject(o);
    var sc2 = GUY_H / (bb.max.y - bb.min.y);
    o.scale.setScalar(sc2);
    o.position.y = -bb.min.y * sc2;
    if (ws) walkSpeed = ws.units * sc2;
    if (rs) runSpeed = rs.units * sc2;
    // other people (calm pass): YOU's own body baked into a few still poses, recoloured per person (ctx.person)
    try {
      idle.stop();
      [['Idle', idleClip, 0.25], ['Walk', find('Walk'), 0.25], ['Sit', find('SitDown'), 0.999]].forEach(function (pz) {
        if (!pz[1]) return;
        var act = mixer.clipAction(pz[1]);
        act.reset().play();
        act.time = pz[1].duration * pz[2];
        mixer.update(0); o.updateMatrixWorld(true);
        poseGeo[pz[0]] = bakeGuy(o);
        act.stop();
      });
      idle.reset().play(); mixer.update(0); o.updateMatrixWorld(true);
    } catch (eB) { poseGeo = {}; if (window.console) console.info('people bake skipped:', eB.message); }

    function mk(name, clip) {
      clip = clip || find(name);
      if (!clip) return null;
      var a = mixer.clipAction(clip);
      if (!LOOPS[name]) { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; }
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      if (!LOOPS[name]) a.paused = true;
      a.w = 0;
      return a;
    }
    acts.Idle = idle; idle.w = 1; idle.setEffectiveWeight(1);
    ['Walk', 'Run', 'Walk_Carry', 'Jump', 'Victory', 'Roll', 'RecieveHit', 'SitDown', 'StandUp', 'PickUp', 'Punch', 'Defeat'].forEach(function (n) { acts[n] = mk(n); });
    if (jumpClip) {
      var pc = jumpClip.clone(); pc.name = 'JumpHold';
      acts.JumpHold = mk('JumpHold', pc);
      acts.JumpHold.time = airT; acts.JumpHold.timeScale = 0;
    }
    Object.keys(acts).forEach(function (n) { if (!acts[n]) delete acts[n]; });
    mixer.update(0);
    facing.add(o);
    fadeAll(o);
    guyLoaded = true;
    WORLD.debug = { walkSpeed: walkSpeed, runSpeed: runSpeed, airT: airT, head: !!headBone, neck: !!neckBone, clips: Object.keys(acts) };
  }

  // ---------- other people, from YOU's own model (calm pass): still poses baked once, shared geometry ----------
  var poseGeo = {}, personMats = {};
  function bakeGuy(o) {
    var out = [], v = new T.Vector3(), k = 1.8 / GUY_H;
    o.traverse(function (m) {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      var src = m.geometry, n = src.attributes.position.count, arr = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld).multiplyScalar(k);
        arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
      }
      var gb = new T.BufferGeometry();
      gb.setAttribute('position', new T.BufferAttribute(arr, 3));
      if (src.index) gb.setIndex(src.index.clone());
      src.groups.forEach(function (gr) { gb.addGroup(gr.start, gr.count, gr.materialIndex); });
      gb.computeVertexNormals();
      gb.userData.shared = true;
      var ms = [].concat(m.material);
      out.push({ geo: gb, names: ms.map(function (mt) { return mt.name; }), cols: ms.map(function (mt) { return mt.color ? '#' + mt.color.getHexString() : '#cccccc'; }) });
    });
    return out;
  }
  function personMat(c) { return personMats[c] || (personMats[c] = keep(new T.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0 }))); }
  // a person in scene units (1.8 tall, feet at 0, facing +Z like YOU): {shirt, pants, skin, hair, pose: 'idle'|'walk'|'sit'}
  function makePerson(o) {
    o = o || {};
    var pose = poseGeo[o.pose === 'walk' ? 'Walk' : o.pose === 'sit' ? 'Sit' : 'Idle'] || poseGeo.Idle;
    if (!pose) return null;
    var cols = { Shirt: o.shirt || '#ffffff', Pants: o.pants || '#2f3b5c', Skin: o.skin || '#e0ac85', Hair: o.hair || '#141414', Belt: o.belt || o.pants || '#2f3b5c' };
    var grp = new T.Group();
    pose.forEach(function (pp) {
      var mats = pp.names.map(function (nm, j) { return personMat(cols[nm] || pp.cols[j]); });
      var me = new T.Mesh(pp.geo, mats.length === 1 ? mats[0] : mats);
      me.castShadow = true;
      grp.add(me);
    });
    return grp;
  }

  function loadGuy(urls) {
    new X.GLTFLoader().load(BASE + urls[0], function (gltf) {
      if (dead) return;
      try { prepareGuy(gltf); } catch (e) { guyFailed = true; if (window.console) console.info('YOU could not be set up:', e.message); }
      dirty = true;
      tryStart();
    }, undefined, function (err) {
      if (dead) return;
      if (urls.length > 1) { loadGuy(urls.slice(1)); return; }
      guyFailed = true;
      if (window.console) console.info('YOU did not load, the planet stays:', err && err.message);
      tryStart();
    });
  }
  loadGuy(['assets3d/people/you.glb', 'assets3d/people/anim_Casual_Male.gltf']);

  // ---------- stage + placement ----------
  var stage = null;   // the sprung stage rect, clamped to the window and to the newest stage
  var vp = null;      // the rect the camera draws into: the stage, or the stage plus the ground strip (arrived)
  var stS = { x: new Spring(0, 0.32, 1), y: new Spring(0, 0.32, 1), w: new Spring(1, 0.32, 1), h: new Spring(1, 0.32, 1) };
  var placed = false, upp0 = 1;
  var FIG_TOP = R + GUY_H + 0.32;   // figure extent above the planet centre (raised arms), planet units
  var FIG_BOT = R + 0.05;
  var diveS = new Spring(0, 0.42, 1), diveE = 0;
  var angS = new Spring(0, 0.45, 1);
  angS.vm = 6;   // r13 pass C: the planet rolls at most 6 rad a second (a jump across the page spins it, it never whips)
  var drag = new Spring(0, 0.7, 0.8);
  var stopOff = new Spring(0, 0.8, 1);
  var tiltX = new Spring(0, 0.5, 1), tiltY = new Spring(0, 0.5, 1);
  var timeK = new Spring(1, 0.14, 1);  // world clock speed: 0 while the visitor holds the planet still

  // fix r4: on a phone the stage is small, so sharpness is cheap: the low tier there renders at the device's pixel
  // ratio up to 2 (it keeps its lighter geometry and has no depth map). Low on a wider screen stays at 1.
  // iPad pass: prCap is the quality watcher's sharpness (1.5, 1.25 or 1 on a 2x screen); see watchQuality()
  var prCap = 1.5;
  function pixelRatio() {
    var d = window.devicePixelRatio || 1;
    // r13 pass A: capped at 1.5 (was 2): about half the pixels on a 2x screen, still sharp at the planet's size
    if (WORLD.quality === 'low') return phoneQ.matches ? Math.min(d, 1.5) : 1;
    return Math.min(d, prCap);
  }
  var sizeW = 0, sizeH = 0, viewH = 1;
  function resize() {
    var w = layer.clientWidth || window.innerWidth, h = layer.clientHeight || window.innerHeight;
    viewH = window.innerHeight || h;
    var touch = !fineQ.matches;
    if (sizeW && w === sizeW && touch && h <= sizeH && h > sizeH - 260) return;
    sizeW = w; sizeH = h + (touch ? 140 : 0); vw = w; vh = sizeH;
    canvas.style.height = sizeH + 'px';
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, sizeH, false);
    // r13 pass C: the stage glides at most about 2.4 window sides a second
    var vmS = Math.max(w, viewH) * 2.4;
    stS.x.vm = stS.y.vm = stS.w.vm = stS.h.vm = vmS;
    dirty = true;
  }
  window.addEventListener('resize', resize);
  var dprSeen = window.devicePixelRatio;
  resize();

  function stageNow(dt, still) {
    var gS = stageGoal;
    if (!gS) return null;
    // clamp the goal to the window so nothing is ever cut by its edge
    var x0 = clamp(gS.x, 0, vw), y0 = clamp(gS.y, 0, viewH), x1 = clamp(gS.x + gS.w, 0, vw), y1 = clamp(gS.y + gS.h, 0, viewH);
    var gx = x0, gy = y0, gw = Math.max(0, x1 - x0), gh = Math.max(0, y1 - y0);
    stS.x.goal = gx; stS.y.goal = gy; stS.w.goal = gw; stS.h.goal = gh;
    var snapNow = stageSnapNext || still || !placed;
    // r13 pass C: the relocation snap below is OFF. The page now plans every stage move so the 3D never crosses text
    // (wide: the planet rides the gap between two sections when it changes sides), so the picture always follows its
    // stage with the damped spring and a speed limit (STAGE_VMAX): no jump, no fade-in, however fast the scroll.
    var RELOC_SNAP = false;
    // fix r4 (QA bug 4): when the stage RELOCATES (its centre jumps by over a quarter of its size between frames,
    // e.g. the hero place to the companion place in one wheel notch), the old clamp slid the sprung picture into the
    // new stage at once, so the planet landed about 500 px away in one frame. A glide across the gap is not allowed:
    // between the two places sit the page's HUD readouts (the overlap gate failed on "2020 the year I started" when
    // the planet glided through it), and the picture must never leave the newest stage. So a relocation now settles
    // the picture straight on the new place and fades the planet in there over about 0.35 s: the planet leaves its
    // old spot and appears in its new one, with no frame of it sliding over text. Any smaller change keeps the spring.
    if (!snapNow && RELOC_SNAP) {
      var cw0 = stS.w.x, ch0 = stS.h.x;
      var mdx = Math.abs(stS.x.x + cw0 / 2 - (gx + gw / 2)), mdy = Math.abs(stS.y.x + ch0 / 2 - (gy + gh / 2));
      if (mdx > 0.25 * Math.max(gw, cw0) || mdy > 0.25 * Math.max(gh, ch0)) { snapNow = true; relocFade = 0; relocCount++; }
    }
    if (snapNow) { stS.x.snap(gx); stS.y.snap(gy); stS.w.snap(gw); stS.h.snap(gh); stageSnapNext = false; }
    else { stS.x.step(dt); stS.y.step(dt); stS.w.step(dt); stS.h.step(dt); }
    if (relocFade < 1) {
      relocFade = still ? 1 : Math.min(1, relocFade + dt / 0.35);
      var op = relocFade * relocFade * (3 - 2 * relocFade);
      canvas.style.opacity = op >= 1 ? '' : op.toFixed(3);
    }
    // the picture may glide, but it is never drawn or measured outside the NEWEST stage:
    // clamp the size to the new stage first, then slide the position inside it
    // r13 pass C: the sprung picture as it is (it was clamped into the newest stage, which made it jump whenever the
    // stage shrank or moved faster than the spring); only kept inside the window
    var w = clamp(stS.w.x, 1, vw), h = clamp(stS.h.x, 1, viewH);
    var x = clamp(stS.x.x, 0, Math.max(0, vw - w)), y = clamp(stS.y.x, 0, Math.max(0, viewH - h));
    return { x: x, y: y, w: w, h: h };
  }
  var relocFade = 1, relocCount = 0, lmUpK = 0;
  WORLD._reloc = function () { return { count: relocCount, fade: relocFade }; }; // test hook
  // the zoomed-out fit: the whole figure (disc + YOU with raised arms) inside the stage, with a margin
  function fitFor(st) {
    upp0 = 2 * CAM_D * HALF_TAN / st.h;
    var sH = 0.92 * st.h * upp0 / (FIG_TOP + FIG_BOT);
    var sW = Math.min(0.92 * st.w * upp0 / (2 * R + 0.3), 0.8 * st.w * upp0 / (2 * R));
    return Math.max(0.01, Math.min(sH, sW));
  }

  // ---------- the arrived camera: one calm, settled, mid-distance framing per place ----------
  // The calm pass (W3): the camera settles on ONE framing per place and stays there. It only moves while the visitor
  // scrolls the dive in or out (and, gently, during a what-if the visitor pressed). Only shot 0 of a scene's `shots`
  // is used: its line of sight gives the heading (azimuth) and, clamped to 12..20 degrees, the camera's height
  // angle; its fov is clamped to 30..38. The look point is the place's centre, the camera's up is the place's own
  // up (level horizon, no roll), and the distance and a lens shift are worked out from the stage so the whole place
  // sits inside the stage (calmFrame()). `site:beat` p no longer moves the camera; scenes can read it as `ctx.beat`.
  var beat = { p: 0, at: -1e9 };
  window.addEventListener('site:beat', function (ev) {
    var d = ev.detail || {};
    if (typeof d.p !== 'number' || !isFinite(d.p)) return;
    var n = norm(d.stop);
    if (n && n !== diveStop) return;
    beat.p = clamp(d.p, 0, 1); beat.at = performance.now();
  });
  var lmPts = {}, defShots = { key: '', list: null };
  function gY(x, z) { var r2 = x * x + z * z; return r2 >= SR * SR ? -SR : Math.sqrt(SR * SR - r2) - SR; }
  function placePoints() {
    var e = registry[diveStop];
    if (e && e.built && e.pts) return { id: 's' + e.ptsId, pts: e.pts };
    if (!lmPts[diveStop]) {
      var L = LM[diveStop], list = [];
      if (L) {
        var pm = PLACE[diveStop].mount;
        pm.updateMatrix(); L.mount.updateMatrix(); L.content.updateMatrix();
        // the landmark as it stands when arrived (fully risen, grown 30%), in the place's frame
        var pre = new T.Matrix4().makeScale(1 / KS, 1 / KS, 1 / KS).multiply(pm.matrix.clone().invert()).multiply(L.mount.matrix)
          .multiply(new T.Matrix4().makeScale(1.3, 1.3, 1.3)).multiply(L.content.matrix);
        list = contentPoints(L.content, pre);
      }
      lmPts[diveStop] = list;
    }
    return { id: 'l' + diveStop, pts: lmPts[diveStop] };
  }
  function v3ok(a) { return a && a.length === 3 && isFinite(a[0]) && isFinite(a[1]) && isFinite(a[2]); }
  function youSize() { var e = registry[diveStop]; return e && e.built ? sceneYou.scale[0] : GUY_H * 0.42 / KS / 1.8; }
  // shot 0 only: {pos, look, fov} (scene units); a place without a scene gets a three-quarter view of YOU's side
  function shot0() {
    var e = registry[diveStop], hasScene = !!(e && e.built);
    if (hasScene && e.shot0) return e.shot0;
    if (hasScene && e.def.shots && e.def.shots.length) {
      var s = e.def.shots[0];
      if (s && v3ok(s.pos) && v3ok(s.look)) {
        e.shot0 = { pos: s.pos.slice(), look: s.look.slice(), fov: +s.fov || 34, you: s.you && s.you.length === 2 ? s.you.slice() : null };
        return e.shot0;
      }
    }
    var key = diveStop + '|' + (hasScene ? e.ptsId : 'l');
    if (defShots.key === key) return defShots.list;
    var yp = hasScene ? sceneYou.place : [3.4, 2.2];
    var az = Math.atan2(yp[0], yp[1] + 6) * 0.5;
    defShots.key = key;
    defShots.list = { pos: [Math.sin(az) * 10, 3, Math.cos(az) * 10], look: [0, 0, 0], fov: 34, you: [yp[0], yp[1]] };
    return defShots.list;
  }

  // The settled framing for a stage: camera = look + D * dir (scene units, the place's frame), lens shift (sx, sy)
  // in stage NDC. D is the nearest distance at which YOU is at most 16% of the stage height AND every column of the
  // place (anything above 0.5 units) fits inside the stage: 5% clear of each side, its top 11% below the stage top.
  // Cached per stage size and place, so it never changes by itself.
  var calm = { key: '', f: null };
  var EL_MIN = 12 * Math.PI / 180, EL_MAX = 20 * Math.PI / 180, EL_DEF = 16 * Math.PI / 180;
  var cfR = new T.Vector3(), cfU = new T.Vector3(), cfF = new T.Vector3(), cfY = new T.Vector3(0, 1, 0);
  function calmFrame(st) {
    var s0 = shot0(), e = registry[diveStop], hasScene = !!(e && e.built);
    var a = st.w / st.h, key = diveStop + '|' + (hasScene ? e.ptsId : 'l') + '|' + st.w.toFixed(1) + 'x' + st.h.toFixed(1);
    if (calm.key === key && calm.f) return calm.f;
    var dx = s0.pos[0] - s0.look[0], dy = s0.pos[1] - s0.look[1], dz = s0.pos[2] - s0.look[2];
    var az = Math.atan2(dx, dz), hz = Math.hypot(dx, dz);
    var el = hz > 1e-4 ? Math.atan2(dy, hz) : EL_DEF;
    el = clamp(el, EL_MIN, EL_MAX);
    var fov = clamp(s0.fov, 30, 38), Tf = Math.tan(fov * Math.PI / 360);
    var dir = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    // the columns to frame (and YOU, standing where the place puts him on arrival)
    var pts = placePoints().pts, cols = [], i;
    // (heights above the curved ground, so things far out on the curve count too)
    for (i = 0; i < pts.length; i++) {
      var p = pts[i], g0 = gY(p[0], p[2]);
      if (p[1] - g0 > 0.3) { cols.push([p[0], p[1], p[2]]); cols.push([p[0], Math.max(g0, p[3]), p[2]]); }
    }
    var yp = s0.you || (hasScene ? sceneYou.place : [3.4, 2.2]), k = youSize();
    var yg = gY(yp[0], yp[1]), youTop = [yp[0], yg + 1.8 * k, yp[1]], youFoot = [yp[0], yg, yp[1]];
    cols.push(youTop, youFoot);
    // the look point: the place's centre, at the height of the middle of its columns
    var hi = 0;
    for (i = 0; i < cols.length; i++) hi = Math.max(hi, cols[i][1]);
    var look = [0, clamp(hi * 0.35, 0.8, 4), 0];
    cfF.set(-dir[0], -dir[1], -dir[2]);
    cfR.crossVectors(cfF, cfY).normalize();
    cfU.crossVectors(cfR, cfF).normalize();
    function proj(P, D, out) {
      var px = P[0] - (look[0] + dir[0] * D), py = P[1] - (look[1] + dir[1] * D), pz = P[2] - (look[2] + dir[2] * D);
      var zf = px * cfF.x + py * cfF.y + pz * cfF.z;
      if (zf < 0.5) return false;
      out[0] = (px * cfR.x + py * cfR.y + pz * cfR.z) / zf; out[1] = (px * cfU.x + py * cfU.y + pz * cfU.z) / zf;
      return true;
    }
    // does the sight line through image point (x, y) (tangent units, camera at distance D) hit the planet?
    function onPlanet(x, y, D) {
      var ox = look[0] + dir[0] * D, oy = look[1] + dir[1] * D + SR, oz = look[2] + dir[2] * D;
      var rx = cfF.x + x * cfR.x + y * cfU.x, ry = cfF.y + x * cfR.y + y * cfU.y, rz = cfF.z + x * cfR.z + y * cfU.z;
      var rl = Math.sqrt(rx * rx + ry * ry + rz * rz); rx /= rl; ry /= rl; rz /= rl;
      var b = ox * rx + oy * ry + oz * rz, c = ox * ox + oy * oy + oz * oz - SR * SR;
      return b * b - c > 0 && -b > 0;
    }
    // which side is the inner edge (next to the text): 1 = the stage is on the right of the window
    var sideS = stageShape(st), inner = sideS.side;
    var q = [0, 0], q2 = [0, 0];
    var MX = 0.05, TOP = 0.11, BOT = 0.05;
    // everything about one camera distance D: the place's extent on the image, YOU's size, the shift that puts the
    // place 11% under the stage top and (beside the text) the least nudge toward the outer side that lets the
    // planet's curve leave through the stage bottom. Continuous in D and in the stage size (bisection, no steps),
    // so a stage that grows during the dive never makes the framing jump.
    function at(D) {
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (var j = 0; j < cols.length; j++) {
        if (!proj(cols[j], D, q)) return null;
        if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
      }
      proj(youTop, D, q); proj(youFoot, D, q2);
      var r = { D: D, youF: (q[1] - q2[1]) / (2 * Tf), sx: -(x0 + x1) / 2, sy: Tf * (1 - 2 * TOP) - y1, clear: true };
      r.fit = (x1 - x0) <= 2 * a * Tf * (1 - 2 * MX) && (y1 - y0) <= 2 * Tf * (1 - TOP - BOT) && r.youF <= 0.16;
      if (inner && r.fit) {
        var room = Math.max(0, a * Tf * (1 - MX) - (x1 - x0) / 2), sx0 = r.sx;
        var clearAt = function (u) { return !onPlanet(-inner * a * Tf - (sx0 + inner * room * u), -Tf - r.sy, D); };
        if (!clearAt(0)) {
          if (!clearAt(1)) r.clear = false;
          else {
            var lo = 0, hi = 1;
            for (var k = 0; k < 24; k++) { var mid = (lo + hi) / 2; if (clearAt(mid)) hi = mid; else lo = mid; }
            r.sx = sx0 + inner * room * hi;
          }
        }
      }
      r.ok = r.fit && r.clear;
      return r;
    }
    var dLo = 6, dHi = 12, best = at(dHi);
    while ((!best || !best.ok) && dHi < 400) { dLo = dHi; dHi *= 1.5; best = at(dHi); }
    if (best && best.ok) {
      for (var it = 0; it < 40; it++) { var dm = (dLo + dHi) / 2, rm = at(dm); if (rm && rm.ok) { dHi = dm; best = rm; } else dLo = dm; }
    } else best = best || at(60) || { D: 60, youF: 0, sx: 0, sy: 0 };
    var sx = best.sx, sy = best.sy;
    var f = {
      pos: [look[0] + dir[0] * best.D, look[1] + dir[1] * best.D, look[2] + dir[2] * best.D], look: look, fov: fov,
      sx: sx / (a * Tf), sy: sy / Tf, D: best.D, youF: best.youF, el: el * 180 / Math.PI, az: az * 180 / Math.PI
    };
    calm.key = key; calm.f = f;
    return f;
  }

  var comp = { x: 0, y: 0 };
  // the drawn area: the stage, run on to any window edge the stage nearly touches (so the ground ends at a real edge)
  function stageShape(st) {
    var sideTol = Math.max(48, vw * 0.04), bTol = Math.max(48, viewH * 0.1);
    var nearL = st.x <= sideTol, nearR = vw - (st.x + st.w) <= sideTol, nearT = st.y <= sideTol;
    var gapB = viewH - (st.y + st.h), nearB = gapB <= bTol;
    var full = nearL && nearR, band = full && !nearB;
    var x0 = nearL ? 0 : st.x, x1 = nearR ? vw : st.x + st.w;
    var y0 = nearT ? 0 : st.y, y1 = nearB ? Math.max(viewH, st.y + st.h) : st.y + st.h;
    var side = full ? 0 : (st.x + st.w / 2 > vw / 2 ? 1 : -1);
    return { ext: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, band: band, side: side, topReal: nearT };
  }

  // ---------- the end card ----------
  // At the footer the planet backs off and all seven places stand on it at once, spread round the rim with a gap
  // at the top for YOU (who waves once). Driven by WORLD.endCard(p); until the page calls that, p is worked out
  // from how far the page's #foot has come into the window while Contact is the stop.
  var endS = new Spring(0, 0.55, 1), CARD_LM = 0.62, CARD_ORDER = ['tinyworld', 'ads', 'films', 'workflow', 'bwgu', 'about', 'contact'];
  var footEl = document.getElementById('foot');
  function autoEnd() {
    if (!footEl || curStop !== 'contact') return 0;
    var r = footEl.getBoundingClientRect();
    if (!(r.height > 0)) return 0;
    return clamp((viewH - r.top) / Math.max(80, Math.min(r.height, viewH * 0.5)), 0, 1);
  }
  var cardLh = 0;
  Object.keys(LM).forEach(function (n) { cardLh = Math.max(cardLh, LM[n].h * LM[n].cardK); });
  function fitCard(st) {
    var rad = R + 0.06 + cardLh * CARD_LM + 0.14;
    var top = Math.max(FIG_TOP, rad), bot = rad;
    var sH = 0.9 * st.h * upp0 / (top + bot), sW = 0.88 * st.w * upp0 / (2 * rad);
    return { s: Math.max(0.01, Math.min(sH, sW)), y: -(top - bot) / 2 };
  }
  var cardDir = new T.Vector3(), cardP = new T.Vector3(), cardQ = new T.Quaternion(), cardF = new T.Vector3(), cardR = new T.Vector3(), cardM = new T.Matrix4();
  // where landmark i stands on the card: evenly round the rim (45 deg apart, the top left for YOU), tipped a little
  // toward the camera so the ones at the bottom are not hidden behind the planet
  function cardPose(i, rollA) {
    var th = (i + 1) * STEP, a = th + rollA, ys = Math.cos(th);
    var z = (0.1 - ys * Math.sin(TILT)) / Math.cos(TILT), c = Math.sqrt(Math.max(0, 1 - z * z));
    cardDir.set(Math.sin(a) * c, Math.cos(a) * c, z).normalize();
    cardF.set(0, 0, 1).addScaledVector(cardDir, -cardDir.z).normalize();
    cardR.crossVectors(cardDir, cardF).normalize();
    cardQ.setFromRotationMatrix(cardM.makeBasis(cardR, cardDir, cardF));
    cardP.copy(cardDir).multiplyScalar(R + 0.04);
  }

  setQuality = function (q) {
    if (q === WORLD.quality && renderer.shadowMap.enabled === (q === 'high')) return;
    WORLD.quality = q;
    var hi = q === 'high';
    renderer.shadowMap.enabled = hi;
    sun.castShadow = hi;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(vw, vh, false);
    rain.count = hi ? RAIN_N : 36;
    contacts = contacts.filter(function (m) { return !!m.parent; });
    contacts.forEach(function (m) { m.visible = !hi; });
    sc.traverse(function (m) { if (m.material) [].concat(m.material).forEach(function (mt) { mt.needsUpdate = true; }); });
    Object.keys(registry).forEach(function (n) {
      var e = registry[n];
      if (e.ctx) e.ctx.quality = q;
      if (e.built && e.def.setQuality) { try { e.def.setQuality(q); } catch (err) { sceneError(n, err); } }
    });
    dirty = true;
  };

  // ---------- acting state ----------
  var guyActive = function () { return guyLoaded && mixer; };
  var dirSign = 1, oneShot = null, glance = null, lookYaw = new Spring(0, 0.35, 1), lookPitch = new Spring(0, 0.35, 1);
  var faceS = new Spring(FACE, 0.38, 1), lean = new Spring(0, 0.3, 0.9), sq = new Spring(0, 0.38, 0.42);
  var phi = new Spring(0, 1.1, 1), lastVel = 0;
  var mode = null, modeG = new Spring(0, 0.9, 1), modeT = new Spring(0, 0.6, 1), modeS = new Spring(0, 0.7, 1);
  var modeL = new Spring(0, 0.5, 1), modeC = new Spring(0, 0.5, 1);
  var stopClock = 0, stopFling = 0, sitting = false, sitAsked = false;
  var flick = null;         // grab-and-flick state
  var frozen = false;
  var poke = null, pokeI = 0;
  var sceneYou = { base: null, place: [0, 3, 0], look: null, off: [0, 0, 0, 0, 0], scale: [1, 1] };
  var headRest = 1;

  function playOnce(name, o) {
    if (name === 'Float') name = 'JumpHold';
    if (!guyActive() || !acts[name] || LOOPS[name]) return false;
    o = o || {};
    if (oneShot && oneShot.act !== acts[name]) oneShot.fading = true;
    var a = acts[name];
    a.reset(); a.paused = false; a.timeScale = o.speed || 1; a.play();
    oneShot = { name: name, act: a, fading: false, hold: !!(o.hold || HOLDS[name]), then: o.then || null };
    dirty = true;
    return true;
  }

  function setGlobeMode(m) {
    if (m === mode) return;
    var was = mode;
    mode = m;
    WORLD.mode = pageMode;
    dirty = true; lastInput = performance.now();
    modeG.goal = m === 'gravity' ? 1 : 0;
    modeT.goal = m === 'typhoon' ? 1 : 0;
    modeS.goal = m === 'stop' ? 1 : 0;
    modeL.goal = m === 'lava' ? 1 : 0;
    modeC.goal = m === 'clones' ? 1 : 0;
    if (m === 'stop') { stopClock = 0; stopFling = 0; }
    if (m === 'clones') { cloneT = 0; clones.forEach(function (c) { c.at = -1; }); }
    if (was === 'stop') { phi.goal = 0; stopOff.goal = 0; }
    if (reduceQ.matches) {
      [modeG, modeT, modeS, modeL, modeC].forEach(function (s) { s.snap(s.goal); });
      phi.snap(m === 'stop' ? 0.62 : 0); stopOff.snap(m === 'stop' ? 0.55 : 0);
      if (m === 'clones') cloneT = 9;
    }
  }

  // which scene (if any) is the one the camera has arrived in
  function arrivedEntry() {
    var e = registry[diveStop];
    return diveE > 0.5 && e && e.built ? e : null;
  }
  var routedTo = null;
  routeMode = function () {
    WORLD.mode = pageMode;
    var e = arrivedEntry();
    if (e && e.def.whatIf) {
      var handled = false;
      try { handled = e.def.whatIf(pageMode, e.ctx) !== false; } catch (err) { sceneError(diveStop, err); }
      routedTo = diveStop;
      if (handled) { if (!poke) setGlobeMode(null); return; }
    } else if (routedTo && registry[routedTo] && registry[routedTo].built && registry[routedTo].def.whatIf) {
      try { registry[routedTo].def.whatIf(null, registry[routedTo].ctx); } catch (err2) { sceneError(routedTo, err2); }
      routedTo = null;
    }
    if (!poke) setGlobeMode(pageMode);
  };

  stopChanged = function () {
    dirty = true;
    if (curStop === 'contact') pending.wave = true;
    // W4: no timed glance back at the landmark after a roll any more: he now ends every roll facing the text
    // (the landmark stands on that side too), and a turn may only happen with the roll itself
  };

  // ---------- scenes: lazy load, build, dispose ----------
  function sceneError(name, err) {
    var e = registry[name];
    if (e) e.failed = true;
    if (window.console) console.info('scene "' + name + '" switched off:', err && err.message ? err.message : err);
    try { disposeScene(name); } catch (e2) { /* already gone */ }
  }
  function requestScene(name) {
    var e = registry[name] || (registry[name] = {});
    if (e.requested || e.def) return;
    e.requested = true;
    var s = document.createElement('script');
    s.src = BASE + 'js/scenes/' + name + '.js';
    s.async = true;
    s.onerror = function () { e.failed = true; if (window.console) console.info('scene "' + name + '" did not load; the landmark stays.'); };
    document.head.appendChild(s);
  }
  var cRand = 11, ptsSeq = 0;
  function makeCtx(name) {
    var matCache = {};
    var ctx = {
      THREE: T, THREEX: X, stop: name, palette: PAL, R: SR, base: BASE, camera: cam,
      quality: WORLD.quality, reduced: reduceQ.matches, dive: 0, arrived: false, mode: null, frozen: false, time: 0,
      whatIfStage: 0, whatIfT: 0,
      rand: function () { cRand = (cRand * 16807) % 2147483647; return (cRand - 1) / 2147483646; },
      mat: function (color, opts) {
        var key = String(color) + (opts ? JSON.stringify(opts) : '');
        if (matCache[key]) return matCache[key];
        var o = { color: color, roughness: 0.85, flatShading: true };
        if (opts) for (var kk in opts) o[kk] = opts[kk];
        return (matCache[key] = keep(new T.MeshStandardMaterial(o)));
      },
      box: function (p, w, h, d, color, x, y, z) { var gg = new T.BoxGeometry(w, h, d); gg.translate(0, h / 2, 0); return add(p, gg, typeof color === 'string' ? ctx.mat(color) : color, x, y, z); },
      rbox: function (p, w, h, d, r, color, x, y, z) { var gg = new X.RoundedBoxGeometry(w, h, d, 2, r); gg.translate(0, h / 2, 0); return add(p, gg, typeof color === 'string' ? ctx.mat(color) : color, x, y, z); },
      cyl: function (p, rt, rb, h, seg, color, x, y, z) { var gg = new T.CylinderGeometry(rt, rb, h, seg); gg.translate(0, h / 2, 0); return add(p, gg, typeof color === 'string' ? ctx.mat(color) : color, x, y, z); },
      instanced: function (geo, mat, count) {
        var im = new T.InstancedMesh(geo, mat, count);
        im.instanceMatrix.setUsage(T.DynamicDrawUsage);
        im.frustumCulled = false;
        return im;
      },
      setInstance: (function () {
        var m4 = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(), e = new T.Euler();
        return function (mesh, idx, x, y, z, ry, sx, sy, sz) {
          var a = sx === undefined ? 1 : sx;
          e.set(0, ry || 0, 0); q.setFromEuler(e);
          p.set(x, y, z); s.set(a, sy === undefined ? a : sy, sz === undefined ? a : sz);
          mesh.setMatrixAt(idx, m4.compose(p, q, s));
        };
      })(),
      groundY: function (x, z) { var r2 = x * x + z * z; return r2 >= SR * SR ? -SR : Math.sqrt(SR * SR - r2) - SR; },
      plant: (function () {
        var up = new T.Vector3(), q = new T.Quaternion();
        return function (obj, x, z, ry) {
          var y = ctx.groundY(x, z);
          obj.position.set(x, y, z);
          up.set(x, y + SR, z).normalize();
          obj.quaternion.setFromUnitVectors(UP, up).multiply(q.setFromAxisAngle(UP, ry || 0));
          return obj;
        };
      })(),
      field: FIELD_COL[name] || '#BFE7F1',
      separate: function (color, ratio) { return separate(color, FIELD_COL[name], ratio); },
      contact: function (obj, radius) { return addContact(obj, radius); },
      contactMat: contactMat,
      beat: 0,
      // a scene point (scene units) to CSS px on the page, as drawn this frame
      project: function (x, y, z) {
        var en = registry[name];
        if (!en || !en.group) return null;
        var pt = new T.Vector3(x, y, z);
        en.group.localToWorld(pt);
        var sp = toScreen(pt);
        return { x: sp.x, y: sp.y, visible: sp.z < 1 };
      },
      person: function (o) { return makePerson(o); },
      hud: function (values) {
        values = values || {};
        emit('world:hud', { stop: name, left: values.left || null, extra: values.extra === undefined ? null : values.extra });
      },
      you: {
        clips: [],
        play: function (clip, o) {
          o = o || {};
          if (clip === 'Float') clip = 'JumpHold';
          if (!acts[clip]) clip = 'Idle';
          if (diveStop !== name) return;
          if (LOOPS[clip] || o.loop) { sceneYou.base = clip === 'Idle' ? null : clip; sceneYou.speed = clamp(+o.speed || 1, 0.25, 3); if (oneShot) oneShot.fading = true; }
          else playOnce(clip, { hold: o.hold, then: o.then && o.then !== 'Idle' ? o.then : null, speed: o.speed });
        },
        place: function (x, z, ry) { if (diveStop === name || !registry[diveStop] || !registry[diveStop].built) sceneYou.place = [+x || 0, +z || 0, +ry || 0]; },
        lookAt: function (x, y, z) { sceneYou.look = (x === null || x === undefined) ? null : [x, y, z]; },
        attach: function (obj, where) { return attachHeld(obj, where, name); },
        offset: function (dx, dy, dz, rx, rz) { sceneYou.off = [dx || 0, dy || 0, dz || 0, rx || 0, rz || 0]; },
        // body and head size while in this place (1, 1 = normal). The ads place uses it for "aged 13".
        scale: function (body, head) {
          if (diveStop !== name) return;
          sceneYou.scale = [clamp(+body || 1, 0.4, 1.5), clamp(+head || 1, 0.6, 1.6)];
        }
      }
    };
    return ctx;
  }
  function buildScene(name) {
    var e = registry[name];
    if (!e || !e.def || e.built || e.failed) return;
    var ctx = e.ctx || (e.ctx = makeCtx(name));
    ctx.you.clips = Object.keys(acts);
    ctx.quality = WORLD.quality;
    ctx.reduced = reduceQ.matches;
    var grp;
    try { grp = e.def.build(ctx); } catch (err) { sceneError(name, err); return; }
    if (!grp || !grp.isObject3D) { sceneError(name, 'build() did not return a THREE.Group'); return; }
    var wrap = new T.Group();
    wrap.add(grp);
    PLACE[name].root.add(wrap);
    wrap.scale.setScalar(KS);
    // one still update first, so things the scene places in update (instanced trees, boats, props) are where they
    // stand on arrival when the place is measured for the settled framing (and the framing never shifts later)
    try { ctx.dive = 0; ctx.arrived = false; ctx.stage = ctx.stage || { x: 0, y: 0, w: 1, h: 1 }; e.def.update(time, 0, ctx); } catch (err0) { sceneError(name, err0); return; }
    e.box = localBox(grp);
    e.pts = contentPoints(grp);
    grp.traverse(function (m) {
      if (!m.isMesh || m.userData.noBounds || m.material === contactMat) return;
      var tr = [].concat(m.material).some(function (mt) { return mt && mt.transparent; });
      m.castShadow = !tr && m.userData.cast !== false;
      m.receiveShadow = true;
    });
    fadeAll(grp);
    e.ptsId = ++ptsSeq;
    // compile the place's shaders now (a section early, in parallel where the browser can), not on the first frame of
    // the dive, so the dive does not stall when the place first shows
    try {
      wrap.visible = true;
      if (renderer.compileAsync) renderer.compileAsync(sc, cam).catch(function () {}); else renderer.compile(sc, cam);
    } catch (errC) { /* it compiles on first draw instead */ }
    wrap.scale.setScalar(0.0001);
    wrap.visible = false;
    e.group = grp; e.wrap = wrap; e.built = true; e.grow = new Spring(0, 0.45, 1); e.warm = 2;
    emit('world:scene', { stop: name, state: 'loaded' });
  }
  function disposeScene(name) {
    var e = registry[name];
    if (!e || !e.built) return;
    e.built = false;
    try { if (e.def && e.def.dispose) e.def.dispose(); } catch (err) { /* keep going */ }
    dropHeld(name);
    if (e.wrap && e.wrap.parent) e.wrap.parent.remove(e.wrap);
    if (e.wrap) e.wrap.traverse(function (m) {
      if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
      if (m.material) [].concat(m.material).forEach(function (mt) {
        if (mt.userData && mt.userData.keep) return;
        if (mt.map) mt.map.dispose();
        mt.dispose();
      });
    });
    e.group = e.wrap = null; e.shot0 = null;
    if (routedTo === name) routedTo = null;
    emit('world:scene', { stop: name, state: 'disposed' });
  }
  // fix r4 (QA bug 12): "one section away" is counted in the PAGE's order (its [data-stop] sections: hero, ads,
  // films, tinyworld, ...), not the planet's, so tinyworld's file is no longer fetched at the hero
  var pageOrder = null;
  function orderOf(n) {
    if (!pageOrder) {
      var seen = [];
      [].forEach.call(document.querySelectorAll('[data-stop]'), function (el) { var s = norm(el.getAttribute('data-stop')); if (s && seen.indexOf(s) < 0) seen.push(s); });
      pageOrder = seen.length >= 3 ? seen : NAMES;
    }
    var i = pageOrder.indexOf(n);
    return i < 0 ? NAMES.indexOf(n) : i;
  }
  // r13 pass A: every place is fetched and built ahead, one per idle moment once the intro is done, and (high tier)
  // kept, so no dive ever builds, compiles or uploads a place in the middle of a scroll. A place one section away
  // that is somehow not built yet is still built at once, as before.
  var idleBuildOn = false;
  var onIdle = window.requestIdleCallback ? function (f) { window.requestIdleCallback(f, { timeout: 2500 }); } : function (f) { setTimeout(f, 200); };
  function idleBuild() {
    if (idleBuildOn || dead) return;
    idleBuildOn = true;
    onIdle(function () {
      idleBuildOn = false;
      if (dead || !intro.done) return;
      var next = null;
      SCENE_FILES.some(function (n) {
        n = norm(n); if (!n) return false;
        var e = registry[n];
        if (!e || (!e.def && !e.requested)) { requestScene(n); return false; }
        if (e.def && !e.built && !e.failed) { next = n; return true; }
        return false;
      });
      if (next) { buildScene(next); dirty = true; }
    });
  }
  function manageScenes() {
    var cur = orderOf(curStop);
    var keep = WORLD.quality === 'high';
    var waiting = false;
    SCENE_FILES.forEach(function (n) {
      n = norm(n); if (!n) return;
      var d = Math.abs(orderOf(n) - cur);
      var e = registry[n];
      if (d <= 1) {
        if (!e || (!e.def && !e.requested)) requestScene(n);
        else if (e.def && !e.built && !e.failed) buildScene(n);
      } else if (d >= 2 && e && e.built && !keep) disposeScene(n);
      else if (keep && (!e || (!e.built && !e.failed))) waiting = true;
    });
    if (waiting && intro.done) idleBuild();
    // scenes that registered without being in the list (included by the page directly)
    Object.keys(registry).forEach(function (n) {
      var e = registry[n];
      if (!e.def || SCENE_FILES.indexOf(n) >= 0) return;
      var d = Math.abs(orderOf(n) - cur);
      if (d <= 1 && !e.built && !e.failed) buildScene(n);
      else if (d >= 2 && e.built) disposeScene(n);
    });
  }

  // ---------- projection helpers ----------
  var pv = new T.Vector3(), pv2 = new T.Vector3();
  // the camera's picture covers `vp` (the stage, or the stage plus the ground strip when arrived)
  function toScreen(vec) {
    vec.project(cam);
    var r = vp || stage;
    if (!r) return { x: 0, y: 0, z: 2 };
    return { x: r.x + (vec.x + 1) / 2 * r.w, y: r.y + (1 - vec.y) / 2 * r.h, z: vec.z };
  }
  screenPosInner = function (name) {
    var L = name && LM[name];
    if (!L || !placed || !holder.visible) return { x: 0, y: 0, visible: false };
    L.mount.updateWorldMatrix(true, false);
    pv.set(0, L.h * Math.max(0, L.rise.x), 0);
    L.mount.localToWorld(pv);
    var p = toScreen(pv);
    var on = L.rise.x > 0.5 && p.x >= stage.x && p.x <= stage.x + stage.w && p.y >= stage.y && p.y <= stage.y + stage.h;
    return { x: p.x, y: p.y, visible: on };
  };
  var camRight = new T.Vector3();
  function discRaw() {
    if (!placed || !stage) return null;
    holder.updateWorldMatrix(true, false);
    pv.setFromMatrixPosition(holder.matrixWorld);
    camRight.setFromMatrixColumn(cam.matrixWorld, 0);
    pv2.copy(pv).addScaledVector(camRight, R * holder.scale.x);
    var c0 = toScreen(pv.clone()), c1 = toScreen(pv2);
    var r = Math.hypot(c1.x - c0.x, c1.y - c0.y);
    return { x: c0.x - r, y: c0.y - r, w: 2 * r, h: 2 * r, cx: c0.x, cy: c0.y, r: r };
  }
  discRectInner = function () { var d = discRaw(); return d ? { x: d.x, y: d.y, w: d.w, h: d.h } : null; };
  var corner = new T.Vector3();
  function unionBox(acc, obj, box) {
    if (!box || box.isEmpty()) return;
    obj.updateWorldMatrix(true, false);
    for (var j = 0; j < 8; j++) {
      corner.set(j & 1 ? box.max.x : box.min.x, j & 2 ? box.max.y : box.min.y, j & 4 ? box.max.z : box.min.z).applyMatrix4(obj.matrixWorld);
      var p = toScreen(corner);
      if (p.z > 1 || p.z < -1) continue;
      acc.x0 = Math.min(acc.x0, p.x); acc.y0 = Math.min(acc.y0, p.y); acc.x1 = Math.max(acc.x1, p.x); acc.y1 = Math.max(acc.y1, p.y);
    }
  }
  var youBox = new T.Box3(new T.Vector3(-0.42, 0, -0.32), new T.Vector3(0.42, GUY_H + 0.28, 0.32));
  function rawBounds() {
    var d = discRaw(), acc = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    if (d) { acc.x0 = d.x; acc.y0 = d.y; acc.x1 = d.x + d.w; acc.y1 = d.y + d.h; }
    if (you.visible) unionBox(acc, you, youBox);
    Object.keys(LM).forEach(function (n) {
      var L = LM[n];
      if (!L.riser.visible) return;
      if (!L.box) L.box = localBox(L.content);
      unionBox(acc, L.content, L.box);
    });
    Object.keys(registry).forEach(function (n) {
      var e = registry[n];
      if (e.built && e.wrap.visible && e.box) unionBox(acc, e.group, e.box);
    });
    return acc;
  }
  boundsInner = function () {
    if (!placed || !stage || !holder.visible) return null;
    var acc = rawBounds();
    if (!isFinite(acc.x0)) return null;
    // everything is drawn through a scissor on the stage, so what is drawn is always inside it
    var x0 = clamp(acc.x0, stage.x, stage.x + stage.w), x1 = clamp(acc.x1, stage.x, stage.x + stage.w);
    var y0 = clamp(acc.y0, stage.y, stage.y + stage.h), y1 = clamp(acc.y1, stage.y, stage.y + stage.h);
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  };
  // the unclipped union, for tests: zoomed out it must already sit inside the stage
  WORLD._rawBounds = function () {
    if (!placed || !stage) return null;
    var acc = rawBounds();
    return isFinite(acc.x0) ? { x: acc.x0, y: acc.y0, w: acc.x1 - acc.x0, h: acc.y1 - acc.y0, stage: { x: stage.x, y: stage.y, w: stage.w, h: stage.h }, dive: diveE } : null;
  };
  // test hook: a landmark's box on the page as drawn now (null while it is down)
  WORLD._lmRect = function (n) {
    var L = LM[norm(n)];
    if (!placed || !L || !L.riser.visible) return null;
    if (!L.box) L.box = localBox(L.content);
    var acc = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    unionBox(acc, L.content, L.box);
    if (!isFinite(acc.x0)) return null;
    // and each mesh's own box on the page (much tighter than the whole tilted landmark's box), for clearance tests
    var parts = [];
    L.content.traverse(function (m) {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      var a2 = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      unionBox(a2, m, m.geometry.boundingBox);
      if (isFinite(a2.x0)) parts.push([a2.x0, a2.y0, a2.x1, a2.y1]);
    });
    return { x: acc.x0, y: acc.y0, w: acc.x1 - acc.x0, h: acc.y1 - acc.y0, parts: parts };
  };
  function guyRectPx() {
    if (!placed || !you.visible) return null;
    var acc = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    unionBox(acc, you, youBox);
    if (!isFinite(acc.x0)) return null;
    return { x: acc.x0, y: acc.y0, w: acc.x1 - acc.x0, h: acc.y1 - acc.y0 };
  }

  // ---------- pointer: look, poke, hold, grab YOU, drag to spin; zoomed in, clicks go to the scene ----------
  var pointer = { x: 0, y: 0, seen: false };
  var dragS = null, cursorSet = '', holdTimer = 0;
  var ray = new T.Raycaster(), ndc = new T.Vector2();
  var INTERACTIVE = 'a,button,video,input,textarea,select,label,summary,[role="button"],[contenteditable],[tabindex]';
  var TEXTY = 'p,h1,h2,h3,h4,h5,h6,li,dt,dd,blockquote,figcaption,span,strong,em,small,td,th,img,svg';
  function inStage(x, y) { return !!stage && x >= stage.x && x <= stage.x + stage.w && y >= stage.y && y <= stage.y + stage.h; }
  function inDisc(x, y) {
    var d = discRaw(); if (!d || !inStage(x, y)) return false;
    var dx = x - d.cx, dy = y - d.cy;
    return dx * dx + dy * dy <= d.r * d.r;
  }
  function onGuy(x, y) { var g2 = guyRectPx(); return !!g2 && inStage(x, y) && x >= g2.x && x <= g2.x + g2.w && y >= g2.y && y <= g2.y + g2.h; }
  function closest(el, sel) { return el && el.closest ? el.closest(sel) : null; }
  function setCursor(cv) { if (cv === cursorSet) return; cursorSet = cv; root.style.cursor = cv; }
  function setRay(x, y) {
    var r = vp || stage;
    ndc.set((x - r.x) / r.w * 2 - 1, -((y - r.y) / r.h * 2 - 1));
    ray.setFromCamera(ndc, cam);
  }
  function sceneHit(x, y) {
    var e = arrivedEntry();
    if (!e || !inStage(x, y)) return null;
    setRay(x, y);
    var hits = ray.intersectObject(e.group, true);
    if (!hits.length) return { e: e, hit: null };
    var h = hits[0], pt = h.point.clone();
    e.group.worldToLocal(pt);
    return { e: e, hit: { object: h.object, point: pt } };
  }
  function clickable(o) { while (o) { if (o.userData && o.userData.clickable) return o.userData.clickable; o = o.parent; } return false; }
  // test hooks (used by the harness checks)
  WORLD._hitTest = function (x, y) { var r = sceneHit(x, y); return r && r.hit ? clickable(r.hit.object) || 'scene' : null; };
  WORLD._guyRect = function () { return guyRectPx(); };
  function sendPointer(type, x, y) {
    var r = sceneHit(x, y);
    if (!r || !r.e.def.onPointer) return false;
    try { return !!r.e.def.onPointer({ type: type, x: x, y: y, hit: r.hit }, r.e.ctx); } catch (err) { sceneError(diveStop, err); return false; }
  }
  // the pointer on the plane YOU moves in, in holder units
  var planePt = new T.Vector3(), planeN = new T.Vector3(), plane = new T.Plane();
  function pointerOnPlane(x, y) {
    if (!stage) return null;
    setRay(x, y);
    holder.updateWorldMatrix(true, false);
    planePt.set(0, 0, GUY_Z).applyMatrix4(holder.matrixWorld);
    planeN.set(0, 0, 1).transformDirection(holder.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(planeN, planePt);
    var out = new T.Vector3();
    if (!ray.ray.intersectPlane(plane, out)) return null;
    return holder.worldToLocal(out);
  }
  var moveQueued = null;

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') { pointer.x = e.clientX; pointer.y = e.clientY; pointer.seen = true; }
    // r13 pass A: a pointer moving over the text is not a reason to draw the 3D; over the stage (or just off it, so
    // the tilt and the head can settle back) or while dragging it is
    var overStage = inStage(e.clientX, e.clientY);
    if (dragS || overStage || pointer.wasIn) lastInput = performance.now();
    pointer.wasIn = overStage;
    if (dragS && dragS.id === e.pointerId) {
      if (dragS.arrived) sendPointer('move', e.clientX, e.clientY);
      var dx = e.clientX - dragS.x0, dy = e.clientY - dragS.y0;
      if (Math.hypot(dx, dy) > 8 && holdTimer && !frozen) { clearTimeout(holdTimer); holdTimer = 0; }
      if (dragS.grab) {
        var p = pointerOnPlane(e.clientX, e.clientY);
        if (p && flick && flick.phase === 'held') {
          flick.p.set(p.x + flick.off.x, p.y + flick.off.y);
          flick.hist.push([performance.now(), flick.p.x, flick.p.y]);
          if (flick.hist.length > 6) flick.hist.shift();
          if (Math.hypot(dx, dy) > 4) dragS.moved = true;
        }
        return;
      }
      if (!dragS.on && dragS.canDrag && !frozen && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        dragS.on = true;
        dragS.base = drag.x;
        dragS.x0 = e.clientX;
        dx = 0;
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* fine without */ }
        root.style.userSelect = 'none';
        setCursor('grabbing');
      }
      if (dragS.on) {
        var sel = window.getSelection && window.getSelection();
        if (sel && sel.rangeCount) sel.removeAllRanges();
        var d = discRaw(), rpx = d ? d.r : 200;
        var off = dragS.base - dx / rpx;
        var lim = Math.PI * 1.5;
        if (Math.abs(off) > lim) off = Math.sign(off) * (lim + (Math.abs(off) - lim) * 0.25);
        drag.x = drag.goal = off;
        dragS.hist.push([performance.now(), off]);
        if (dragS.hist.length > 6) dragS.hist.shift();
      }
    } else if (fineQ.matches && placed && holder.visible) {
      if (closest(e.target, INTERACTIVE) || closest(e.target, TEXTY) || !inStage(e.clientX, e.clientY)) { setCursor(''); return; }
      if (diveE > 0.9) moveQueued = [e.clientX, e.clientY];
      else if (diveE < 0.1) setCursor(onGuy(e.clientX, e.clientY) && !reduceQ.matches ? 'grab' : inDisc(e.clientX, e.clientY) ? 'pointer' : '');
      else setCursor('');
    }
  }, { passive: true });

  window.addEventListener('pointerdown', function (e) {
    if (!placed || !holder.visible || e.button > 0) return;
    if (closest(e.target, INTERACTIVE) || closest(e.target, TEXTY)) return;
    var x = e.clientX, y = e.clientY;
    if (!inStage(x, y)) return;
    lastInput = performance.now();
    var zoomedOut = diveE < 0.1, arrived = diveE > 0.9;
    if (!zoomedOut && !arrived) return;
    var hitGuy = zoomedOut && intro.done && onGuy(x, y), hitDisc = zoomedOut && inDisc(x, y);
    if (zoomedOut && !hitGuy && !hitDisc) return;
    dragS = { id: e.pointerId, x0: x, y0: y, t0: performance.now(), on: false, hist: [], base: 0, hitGuy: hitGuy, arrived: arrived,
      canDrag: hitDisc && !hitGuy && fineQ.matches && (e.pointerType === 'mouse' || e.pointerType === 'pen') && !reduceQ.matches };
    if (arrived) {
      var aE = arrivedEntry();
      if (sendPointer('down', x, y) || (aE && aE.def.holds)) dragS.noHold = true;   // the scene has its own hold
    }
    if (hitGuy && !reduceQ.matches && guyActive() && !flick) {
      var p = pointerOnPlane(x, y);
      if (p) {
        dragS.grab = true;
        flick = { phase: 'held', p: new T.Vector2(you.position.x, you.position.y), off: new T.Vector2(you.position.x - p.x, you.position.y - p.y),
          v: new T.Vector2(), rz: 0, rv: 0, hist: [[performance.now(), you.position.x, you.position.y]], t: 0 };
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
        root.style.userSelect = 'none';
        setCursor('grabbing');
        dirty = true;
        return;
      }
    }
    clearTimeout(holdTimer);
    if (dragS.noHold) return;
    holdTimer = setTimeout(function () {
      holdTimer = 0;
      if (dragS && !dragS.on && !dragS.grab) { frozen = true; dragS.held = true; dirty = true; }
    }, 380);
  }, { passive: true });

  function endPointer(e, cancelled) {
    if (!dragS || (e && dragS.id !== e.pointerId)) return;
    var d = dragS; dragS = null;
    clearTimeout(holdTimer); holdTimer = 0;
    if (frozen) { frozen = false; dirty = true; }
    if (d.grab) {
      root.style.userSelect = '';
      try { root.releasePointerCapture(d.id); } catch (err) { /* fine */ }
      setCursor('');
      if (!flick) return;
      var h = flick.hist, now = performance.now();
      if (!d.moved && !cancelled) { flick = null; pending.wave = true; if (e) emit('world:tap', { x: e.clientX, y: e.clientY, onGuy: true }); return; }
      flick.phase = 'fly';
      if (h.length > 1) {
        var a = h[0], b = h[h.length - 1], span = (b[0] - a[0]) / 1000;
        if (span > 0 && now - b[0] < 120) flick.v.set((b[1] - a[1]) / span, (b[2] - a[2]) / span);
      }
      if (flick.v.length() > 16) flick.v.setLength(16);
      flick.rv = -flick.v.x * 1.6 + (flick.v.y > 0 ? -2 : 2);
      dirty = true;
      return;
    }
    if (d.on) {
      root.style.userSelect = '';
      try { root.releasePointerCapture(d.id); } catch (err) { /* fine */ }
      setCursor('');
      var hh = d.hist, vel = 0;
      if (hh.length > 1) {
        var a2 = hh[0], b2 = hh[hh.length - 1], span2 = (b2[0] - a2[0]) / 1000;
        if (span2 > 0 && performance.now() - b2[0] < 90) vel = (b2[1] - a2[1]) / span2;
      }
      drag.v = clamp(vel, -14, 14);
      drag.coast = Math.abs(drag.v) > 0.8;
      drag.goal = Math.round(drag.x / (Math.PI * 2)) * Math.PI * 2;
      return;
    }
    if (cancelled || !e || d.held) { if (d.arrived && e) sendPointer('up', e.clientX, e.clientY); return; }
    var moved = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
    if (d.arrived) {
      sendPointer('up', e.clientX, e.clientY);
      if (moved < 10 && performance.now() - d.t0 < 600) sendPointer('click', e.clientX, e.clientY);
      dirty = true;
      return;
    }
    if (moved < 10 && performance.now() - d.t0 < 600) {
      emit('world:tap', { x: e.clientX, y: e.clientY, onGuy: false });
      if (intro.done) doPoke();
      dirty = true;
    }
  }
  window.addEventListener('pointerup', function (e) { endPointer(e, false); }, { passive: true });
  window.addEventListener('pointercancel', function (e) { endPointer(e, true); }, { passive: true });
  window.addEventListener('blur', function () { if (dragS) endPointer(null, true); });

  var pokeTimer = 0;
  function doPoke() {
    var pk = POKES[pokeI % POKES.length];
    pokeI++;
    clearTimeout(pokeTimer);
    poke = pk;
    setGlobeMode(pk.mode);
    emit('world:poke', { title: pk.title, mode: pk.mode });
    wiStart(pk.mode, true);
  }
  WORLD._poke = doPoke; // test hook
  WORLD._cam = cam; // test hook
  WORLD._placePx = function (n) { n = norm(n) || diveStop; var pm = PLACE[n].mount; pm.updateWorldMatrix(true, false); var v0 = new T.Vector3(); pm.localToWorld(v0); var s0 = toScreen(v0); return { x: s0.x, y: s0.y }; }; // test hook
  WORLD._snapDive = function (v) { diveS.snap(clamp(+v || 0, 0, 1)); dirty = true; }; // test hook (the next setScene sets the goal again)
  // r13 pass C test hook (read only): the eased state the 3D shows right now, to measure jumps per frame
  WORLD._probe = function () { return { ang: angS.x + drag.x, dive: diveS.x, sx: stS.x.x, sy: stS.y.x, sw: stS.w.x, sh: stS.h.x, frames: WORLD._stats.frames }; };
  WORLD._comp = function () { return { frame: arrived.f, ext: arrived.sh && arrived.sh.ext, sx: comp.x, sy: comp.y, fov: arrived.fov, fx: fxS, wi: { mode: wi.mode, stage: wi.stage, t: wi.t } }; }; // test hook

  // ---------- intro ----------
  var intro = { started: false, t: 0, done: false, guyDrop: -1, landed: false };
  var tryStartTimer = setTimeout(function () { tryStart(true); }, 4000);
  function tryStart(timeout) {
    if (dead || intro.started) return;
    if (!timeout && !guyLoaded && !guyFailed) return;
    if (!stageGoal) { clearTimeout(tryStartTimer); tryStartTimer = setTimeout(function () { tryStart(true); }, 120); return; }
    clearTimeout(tryStartTimer);
    intro.started = true;
    intro.t = 0;
    holder.visible = true;
    fadeAll(sc);
    if (!reduceQ.matches) { buildU.value = 0; decor.forEach(function (d) { d.s = 0; }); }
    WORLD.ok = true;
    root.classList.add('world-live');
    readyResolve(true);
    emit('world:ready', { guy: guyLoaded, quality: WORLD.quality });
    if (reduceQ.matches) finishIntro();
    dirty = true;
    start();
  }
  function finishIntro() {
    buildU.value = 99;
    decor.forEach(function (d) { d.s = 1; });
    clouds.forEach(function (cl) { cl.introK = 1; cl.introA = 0; });
    if (guyLoaded) { you.visible = true; intro.landed = true; }
    if (!intro.done) { intro.done = true; emit('world:intro-done'); }
  }

  // ---------- per-frame ----------
  var lastT = 0, running = false, time = 0, lastScrollY = window.scrollY, scrollV = 0, lastRender = 0, settleUntil = 0;
  var fpsChecked = !!forced;
  // ---------- iPad pass (fix 3): the quality watcher ----------
  // It runs for the whole visit, only on frames drawn back to back (the 30 fps idle draws and pauses are not
  // counted). Four steps, from the best down: high tier at sharpness 1.5, 1.25, 1, then the low tier (no shadows).
  // About 40 slow frames in a row (under about 38 fps on average) take it one step down; 4 s of smooth frames
  // (over about 55 fps) take it one step back up, never above where it started and never back to a step it was
  // pushed out of twice. Turning shadows back on rebuilds every material, so that only happens while the page is
  // still. A steady 30 fps (iPad Low Power Mode caps the screen there) only lowers sharpness, never the shadows.
  var Q_STEPS = [{ q: 'high', pr: 1.5 }, { q: 'high', pr: 1.25 }, { q: 'high', pr: 1 }, { q: 'low', pr: 1 }];
  var qStep = WORLD.quality === 'low' ? 3 : 0, qTop = qStep, qDrops = [0, 0, 0, 0], qWin = [], qGood = 0, qQuietAt = 0;
  function qApply(n) {
    var s = Q_STEPS[n];
    qStep = n; prCap = s.pr; qWin = []; qGood = 0; qQuietAt = performance.now() + 1500;
    if (s.q !== WORLD.quality) setQuality(s.q);
    else { renderer.setPixelRatio(pixelRatio()); renderer.setSize(vw, vh, false); dirty = true; }
    WORLD._q = { step: qStep, pr: prCap, quality: WORLD.quality };
  }
  function watchQuality(now, gap, busy) {
    if (!busy || gap > 120 || gap <= 0 || now < qQuietAt) return;   // only back-to-back frames, settled after a change
    qWin.push(gap);
    if (qWin.length > 40) qWin.shift();
    var d = window.devicePixelRatio || 1;
    if (qWin.length === 40) {
      var sum = 0, sq = 0;
      for (var i = 0; i < 40; i++) { sum += qWin[i]; sq += qWin[i] * qWin[i]; }
      var avg = sum / 40, sd = Math.sqrt(Math.max(0, sq / 40 - avg * avg));
      var capped = avg > 30 && avg < 37 && sd < 3;
      if (avg > 26 && qStep < 3) {
        var next = qStep + 1;
        if (d <= 1.05 && next < 3) next = 3;            // a 1x screen: sharpness steps change nothing
        if (next === 3 && capped) return;                // a 30 fps cap: shadows stay
        qDrops[qStep]++;
        qApply(next);
        return;
      }
    }
    if (gap < 18.2) qGood++; else qGood = Math.max(0, qGood - 3);
    if (qGood > 240 && qStep > qTop) {
      var up = qStep - 1;
      if (up === 2 && d <= 1.05) up = 0;
      if (qDrops[up] >= 2) { qGood = 0; return; }      // pushed out of that step twice: stay
      if (Q_STEPS[up].q !== WORLD.quality && (Math.abs(scrollV) > 30 || diveS.x > 0.02 && diveS.x < 0.98)) return;   // shadows back on only while still
      qApply(up);
    }
  }
  WORLD._q = { step: qStep, pr: prCap, quality: WORLD.quality };
  var qA = new T.Quaternion(), qB = new T.Quaternion(), qC = new T.Quaternion(), qF = new T.Quaternion(), qD = new T.Quaternion();
  var vA = new T.Vector3(), vB = new T.Vector3(), eul = new T.Euler(0, 0, 0, 'YXZ');
  var WIND_W = new T.Vector3(-1, 0, 0), Z_AXIS = new T.Vector3(0, 0, 1);
  var camT = new T.Vector3(), camP = new T.Vector3(), dir0 = new T.Vector3(0, 0, 1), dir1 = new T.Vector3(), mW = new T.Vector3();
  var uW = new T.Vector3(), fW = new T.Vector3(), rW = new T.Vector3(), qW = new T.Quaternion(), qSlerp = new T.Quaternion(), qId = new T.Quaternion();
  var arrivedWas = false, arrivedName = null;
  WORLD._stats = { frames: 0 };

  function stepIntro(dt) {
    if (!intro.started || intro.done) return;
    var t = intro.t += dt;
    buildU.value = t;
    decor.forEach(function (d, j) { d.s = outBack((t - 0.45 - j * 0.035) / 0.36); });
    clouds.forEach(function (cl, j) {
      var kk = outCubic((t - 0.45 - j * 0.05) / 0.6);
      cl.introK = kk;
      cl.introA = (1 - kk) * 0.9 * (cl.speed > 0 ? -1 : 1);
    });
    if (guyLoaded && intro.guyDrop < 0 && t >= 1.0) intro.guyDrop = 0;
    if (t >= 1.75 && (intro.landed || !guyLoaded)) {
      intro.done = true;
      buildU.value = 99;
      clouds.forEach(function (cl) { cl.introA = 0; cl.introK = 1; });
      emit('world:intro-done');
    }
  }

  function stepGuyDrop(dt) {
    if (!guyLoaded) return 0;
    if (intro.guyDrop < 0) {
      if (intro.done && !intro.landed) { if (reduceQ.matches) { you.visible = true; intro.landed = true; return 0; } intro.guyDrop = 0; }
      else return 0;
    }
    if (intro.landed) return 0;
    you.visible = true;
    intro.guyDrop += dt;
    var p = intro.guyDrop / 0.36;
    if (p >= 1) { intro.landed = true; sq.x = 0; sq.v = -5.2; return 0; }
    return 2.6 * (1 - p * p);
  }

  // ---------- what-ifs: three escalating stages over about 6 s, then they put themselves back ----------
  var wi = { mode: null, t: 0, stage: 0, poked: false };
  var WI_AT = [0, 0, 1.8, 3.6], WI_END = 5.8;
  function sfx(n) { try { if (window.SFX && typeof window.SFX.play === 'function') window.SFX.play(n); } catch (err) { /* no sound layer */ } }
  function wiStart(m, poked) {
    if (m && m === wi.mode) { wi.poked = !!poked; return; }
    var was = wi.mode;
    wi.mode = m || null; wi.t = 0; wi.stage = m ? 1 : 0; wi.poked = !!poked;
    if (!m && !was) return;
    emit('world:whatif', { mode: wi.mode, stage: wi.stage });
    sfx(m ? (m === 'lava' || m === 'clones' ? 'pop' : m) : 'reset');
    dirty = true; lastInput = performance.now();
  }
  function stepWi(dtW, still) {
    if (!wi.mode) return;
    wi.t += dtW;
    var sg = still ? 3 : wi.t < WI_AT[2] ? 1 : wi.t < WI_AT[3] ? 2 : 3;
    if (sg !== wi.stage) {
      wi.stage = sg;
      emit('world:whatif', { mode: wi.mode, stage: sg });
      if (!still) sfx(sg === 3 && (wi.mode === 'stop' || wi.mode === 'gravity') ? 'thud' : sg === 3 && wi.mode === 'clones' ? 'pop' : 'whoosh');
    }
    if (wi.t >= (still ? 4 : WI_END)) {
      if (wi.poked) { poke = null; } else { pageMode = null; }
      wiStart(null);
      routeMode();
    }
  }
  // the camera's reaction (scene units for the arrived camera; scaled down for the whole globe). Calm pass: gentle,
  // no whip, a shake of a few px at most, eased in and out (fxS), and exactly zero once the what-if has put itself back
  var fx = { x: 0, y: 0, z: 0, lx: 0, ly: 0, roll: 0 }, fxS = { x: 0, y: 0, z: 0, lx: 0, ly: 0, roll: 0 }, FX_KEYS = ['x', 'y', 'z', 'lx', 'ly', 'roll'];
  function stepFx(still, dt) {
    fx.x = fx.y = fx.z = fx.lx = fx.ly = fx.roll = 0;
    if (wi.mode) {
      var t = wi.t, S = wi.stage, out = 1 - smooth(WI_END - 0.9, WI_END, t), grow = smooth(0, 1.6, t);
      if (wi.mode === 'gravity') {
        // weightless: the camera drifts up a little, more with each stage
        var lift = (0.12 * S + (still ? 0 : 0.04 * Math.sin(t * 0.9))) * grow * out;
        fx.y = lift; fx.ly = lift * 1.2;
        fx.roll = 0.006 * S * out;
      } else if (wi.mode === 'typhoon') {
        // a slow sway, a few px at most, and a slight lean into the wind
        var amp = still ? 0 : [0, 0.012, 0.022, 0.035][S] * out;
        fx.x = amp * (Math.sin(t * 9) + 0.6 * Math.sin(t * 13 + 1)); fx.y = amp * 0.6 * (Math.sin(t * 11 + 2) + 0.5 * Math.sin(t * 15));
        fx.roll = -0.006 * S * out;
      } else if (wi.mode === 'stop') {
        // an eased look east at each stage, no whip
        fx.lx = (still ? 0.4 : 0.15 * S) * grow * out;
      } else if (wi.mode === 'lava' || wi.mode === 'clones') {
        var a2 = still ? 0 : [0, 0.005, 0.01, 0.015][S] * out;
        fx.y = a2 * Math.sin(t * 7); fx.x = a2 * Math.sin(t * 5 + 1);
      }
    }
    var kk = still ? 1 : 1 - Math.exp(-(dt || 0) / 0.22);
    for (var i = 0; i < FX_KEYS.length; i++) {
      var n = FX_KEYS[i], g0 = fx[n];
      fxS[n] += (g0 - fxS[n]) * kk;
      if (g0 === 0 && Math.abs(fxS[n]) < 1e-5) fxS[n] = 0;
    }
    return fxS;
  }

  // ---------- the arrived camera, each frame: the settled framing plus the (gentle, eased) what-if reaction ----------
  var arrived = { pos: new T.Vector3(), look: new T.Vector3(), basePos: new T.Vector3(), baseLook: new T.Vector3(), up: new T.Vector3(0, 1, 0), fov: 34, sh: null, roll: 0, f: null };
  function stepArrived(dt, still, st) {
    var fr = calmFrame(st), f = fxS;
    arrived.f = fr;
    var pm = PLACE[diveStop].mount;
    pm.updateWorldMatrix(true, false);
    arrived.pos.set(fr.pos[0] + f.x, fr.pos[1] + f.y, fr.pos[2] + f.z).multiplyScalar(KS);
    pm.localToWorld(arrived.pos);
    arrived.look.set(fr.look[0] + f.lx, fr.look[1] + f.ly, fr.look[2]).multiplyScalar(KS);
    pm.localToWorld(arrived.look);
    arrived.basePos.set(fr.pos[0], fr.pos[1], fr.pos[2]).multiplyScalar(KS);
    pm.localToWorld(arrived.basePos);
    arrived.baseLook.set(fr.look[0], fr.look[1], fr.look[2]).multiplyScalar(KS);
    pm.localToWorld(arrived.baseLook);
    // level: the camera's up is the place's own up, so the place stands upright and its lean is symmetric
    pm.getWorldQuaternion(qW);
    arrived.up.set(0, 1, 0).applyQuaternion(qW);
    arrived.fov = fr.fov;
    arrived.fxRoll = f.roll;
    arrived.sh = stageShape(st);
    comp.x = fr.sx; comp.y = fr.sy;
  }

  // camera: the whole globe straight on, or the dive from it down into the place's first shot
  var zoomFx = new T.Vector3();
  function placeCamera(e, st) {
    var sNow = holder.scale.x;
    cam.aspect = st.w / st.h;
    if (e < 1e-4) {
      var f = fxS, zk = 0.55;   // the what-if reaction, small at planet scale
      cam.position.set(f.x * zk, f.y * zk * 0.6, CAM_D); cam.up.set(0, 1, 0);
      zoomFx.set(f.lx * zk * 0.35, f.ly * zk * 0.4, 0);
      cam.lookAt(zoomFx);
      if (f.roll) cam.rotateZ(f.roll * 0.5);
      cam.fov = FOV;
      camT.set(0, 0, 0);
      cam.near = 1; cam.far = 200;
      cam.clearViewOffset();
      cam.updateProjectionMatrix();
      vp = st;
      return;
    }
    // the camera along the dive (with the what-if reaction), and the same path without it (for the lens shift)
    divePose(cam, e, arrived.pos, arrived.look, arrived.up, arrived.fov, arrived.fxRoll || 0, true);
    var len = cam.position.distanceTo(camT);
    cam.near = Math.max(0.01 * sNow, Math.min(len * 0.04, 0.05 * sNow)); cam.far = len + 30 * sNow;
    // the picture is laid out on the stage (with the lens shift); the drawn window runs on past the stage to any
    // window edge the stage nearly touches, so the ground ends at real edges
    var X = arrived.sh ? arrived.sh.ext : st;
    // the lens shift through the dive: the place's own spot glides on the stage in a straight line from where it sits
    // on the whole globe to where the settled framing puts it (so it never dips and comes back). Worked out on the
    // path without the what-if reaction, so a reaction still shows.
    cam.clearViewOffset(); cam.updateProjectionMatrix();
    var pm0 = PLACE[diveStop].mount;
    pm0.updateWorldMatrix(true, false);
    dvP.setFromMatrixPosition(pm0.matrixWorld);
    dvCam.aspect = cam.aspect;
    divePose(dvCam, e, arrived.basePos, arrived.baseLook, arrived.up, arrived.fov, 0, false);
    var now0 = projPx(dvCam, dvP, st, dvA);
    divePose(dvCam, 0, arrived.basePos, arrived.baseLook, arrived.up, arrived.fov, 0, false);
    var from0 = projPx(dvCam, dvP, st, dvB);
    divePose(dvCam, 1, arrived.basePos, arrived.baseLook, arrived.up, arrived.fov, 0, false);
    var to0 = projPx(dvCam, dvP, st, dvC);
    var gx = lerp(from0.x, to0.x + comp.x * st.w / 2, e) - now0.x, gy = lerp(from0.y, to0.y - comp.y * st.h / 2, e) - now0.y;
    cam.setViewOffset(st.w, st.h, (X.x - st.x) - gx, (X.y - st.y) - gy, X.w, X.h);
    cam.updateProjectionMatrix();
    vp = X;
  }
  // camera c at dive e: from the whole globe (straight on, CAM_D away) to the settled framing (pos, look, up, fov).
  // The look point reaches the place early, the direction turns and the distance closes in (log scale) with e.
  var dpT = new T.Vector3(), dpD = new T.Vector3(), dpQ = new T.Quaternion(), dpQ2 = new T.Quaternion(), dpV = new T.Vector3();
  function divePose(c, e, pos, look, up, fov, roll, real) {
    dpD.copy(pos).sub(look);
    var dist = Math.max(1e-4, dpD.length());
    dpD.divideScalar(dist);
    dpT.set(0, 0, 0).lerp(look, smooth(0, 0.55, e));
    dpQ.setFromUnitVectors(dir0, dpD);
    dpQ2.identity().slerp(dpQ, e);
    dpV.copy(dir0).applyQuaternion(dpQ2);
    var len = Math.exp(lerp(Math.log(CAM_D), Math.log(dist), e));
    c.position.copy(dpT).addScaledVector(dpV, len);
    c.up.set(0, 1, 0).lerp(up, e).normalize();
    c.lookAt(dpT);
    if (roll * e) c.rotateZ(-roll * e);
    c.fov = lerp(FOV, fov, e);
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    if (real) { camT.copy(dpT); camP.copy(look); mW.copy(pos); uW.copy(up); }
  }
  var dvCam = new T.PerspectiveCamera(30, 1, 0.01, 1000), dvP = new T.Vector3(), dvA = { x: 0, y: 0 }, dvB = { x: 0, y: 0 }, dvC = { x: 0, y: 0 }, dvV = new T.Vector3();
  // a world point to stage px through camera c (no view offset)
  function projPx(c, pW, st, out) {
    dvV.copy(pW).project(c);
    out.x = (dvV.x + 1) / 2 * st.w; out.y = (1 - dvV.y) / 2 * st.h;
    return out;
  }

  // r13 pass A: a built place that is visible and playing its own video (only after the visitor tapped its screen)
  function sceneLive() {
    for (var n in registry) { var e = registry[n]; if (e.built && e.wrap && e.wrap.visible && e.ctx && e.ctx.live) return true; }
    return false;
  }
  function warming() {
    for (var n in registry) { if (registry[n].built && registry[n].warm) return true; }
    return false;
  }
  function frame() {
    if (dead) return;
    if (paused || document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
    var now = performance.now();
    var still = reduceQ.matches;
    if (window.devicePixelRatio !== dprSeen) { dprSeen = window.devicePixelRatio; resize(); }
    if ((intro.done || intro.t > 0.95) && now >= runCheckAt) {
      runCheckAt = now + 500;
      if (buildRunSigns()) dirty = true;
    }

    var anyScene = false;
    Object.keys(registry).forEach(function (n) { if (registry[n].built && registry[n].wrap.visible) anyScene = true; });
    var vid = false;   // r13 pass A: the landmark's screen is a still now
    // reduced motion draws only when something changed (an arrived scene at 10 fps)
    if (still && !dirty && !vid && !wi.mode && !(anyScene && now - lastRender > 100)) { lastT = now; return; }
    var calm = now - lastInput > 4000 && !mode && !(oneShot && !oneShot.hold) && intro.done && !dragS && !flick && !poke && angS.calm(1e-3) && drag.calm(1e-3) && diveS.calm(1e-3) &&
      modeG.x + modeT.x + modeS.x + modeL.x + modeC.x < 1e-3 && stS.x.calm(0.05) && stS.h.calm(0.05);
    // r13 pass A: draw every frame only when something changed. A scroll, a resize, the stage or scene moving, input on the
    // stage, a spring still travelling, a what-if, a one-shot, a scene's own playing video, or a place being warmed
    // up keeps the frames coming, and for a short settle after it (long enough for every spring and an arrival's
    // sit-down to finish). Then nothing is drawn: the last picture stays and the world clock stops with it, so the
    // clouds, the idle loops and a place's own life freeze while the visitor reads.
    var springing = !(angS.calm(1e-3) && drag.calm(1e-3) && diveS.calm(1e-3) && endS.calm(1e-3) && timeK.calm(1e-3) &&
      stS.x.calm(0.05) && stS.y.calm(0.05) && stS.w.calm(0.05) && stS.h.calm(0.05) && tiltX.calm(1e-4) && tiltY.calm(1e-4) &&
      modeG.x + modeT.x + modeS.x + modeL.x + modeC.x < 1e-3);
    var busy = dirty || springing || vid || sceneLive() || !!wi.mode || !!mode || !!dragS || !!flick || !!poke || !!frozen ||
      (oneShot && !oneShot.hold) || !intro.started || !intro.done || now - lastInput < 120 || warming();
    if (busy) settleUntil = Math.max(settleUntil, now + (anyScene ? 2500 : 1200));
    // r13 pass B: when nothing changed the world keeps living (YOU's idle loop, the clouds, a place's own life) at
    // about 30 frames a second, and only while its stage is in the window (the tab hidden or a dialog open stops the
    // loop altogether, above). Scrolling and moves draw every frame.
    var busyNow = now <= settleUntil;
    if (!busyNow) {
      var sg = stageGoal, onScreen = !!sg && sg.w > 8 && sg.h > 8 && sg.x < vw && sg.x + sg.w > 0 && sg.y < viewH && sg.y + sg.h > 0;
      if (!onScreen) { lastT = now; return; }
      if (now - lastRender < 31) return;
    }
    var gapMs = now - lastRender;
    lastRender = now;
    WORLD._drawnAt = now;
    var t0 = performance.now();

    var dt = Math.min((now - lastT) / 1000, 0.1);
    lastT = now;
    dirty = false;

    // iPad pass (fix 3): the quality watcher (it replaces the one-off probe during the intro)
    if (!fpsChecked && intro.started && (intro.t > 0.25 || intro.done)) watchQuality(now, gapMs, busyNow);

    // the world clock: holding the planet freezes it
    timeK.goal = frozen ? 0 : 1;
    if (still) timeK.snap(timeK.goal); else timeK.step(dt);
    var tk = clamp(timeK.x, 0, 1), dtW = dt * tk;
    time += dtW;

    stepIntro(dt);
    manageScenes();

    var sy = window.scrollY, dy = sy - lastScrollY;
    lastScrollY = sy;
    scrollV += ((dt > 0 ? dy / dt : 0) - scrollV) * Math.min(1, dt * 8);

    // ----- stage, fit and the dive
    var st = stageNow(dt, still || !intro.started);
    stage = st;
    if (!st || st.w < 8 || st.h < 8) { renderer.setScissorTest(false); renderer.clear(); return; }
    var s = fitFor(st), figY = -(FIG_TOP - FIG_BOT) / 2;
    placed = true;
    // ----- the end card: as the footer comes in, the planet backs off to show every place on it at once
    if (!endSet) endGoal = autoEnd();
    endS.goal = endGoal;
    if (still) endS.snap(endGoal); else endS.step(dt);
    var endK = clamp(endS.x, 0, 1);
    if (endK > 1e-4) { var fc = fitCard(st); s = lerp(s, fc.s, smooth(0, 0.6, endK)); figY = lerp(figY, fc.y, smooth(0, 0.6, endK)); }
    if (endK > 0.6 && !endWaved) { endWaved = true; pending.wave = true; }
    if (endGoal < 0.2 && endK < 0.3) endWaved = false;
    if (diveWant !== diveStop && diveS.x < 0.002) { diveStop = diveWant; dirty = true; }
    diveS.goal = (diveWant === diveStop ? diveGoal : 0) * (1 - endGoal);
    if (still) diveS.snap(diveS.goal > 0.5 ? 1 : 0); else diveS.step(dt);
    diveE = inOut(clamp(diveS.x, 0, 1));
    var inScene = smooth(0.04, 0.6, diveE);   // YOU moves into the place early in the dive, before the place grows

    var arrivedNow = !!arrivedEntry();
    if (arrivedNow !== arrivedWas) {
      arrivedWas = arrivedNow;
      if (arrivedNow) arrivedName = diveStop;
      emit('world:scene', { stop: arrivedNow ? diveStop : arrivedName, state: arrivedNow ? 'arrived' : 'left' });
      routeMode();
      if (!arrivedNow) { sceneYou.base = null; sceneYou.off = [0, 0, 0, 0, 0]; sceneYou.look = null; sceneYou.scale = [1, 1]; sceneYou.speed = 1; if (oneShot && oneShot.hold) oneShot.fading = true; }
    }
    if (diveE > 0.05 && flick && flick.phase !== 'down') flick = null;

    // ----- placement: centre the figure in the stage
    // lead r6 (calm rule): the float is the first screen's only (the 3D is the hook there); beside a section's text the planet holds still
    bobK += ((curStop === 'hero' ? 1 : 0) - bobK) * Math.min(1, (dt || 0) * 3);
    // r13 pass B (Tedd: bring the 3D back to life): the gentle float on the first screen is back
    var bob = still ? 0 : Math.sin(time * 1.4) * 2.5 * bobK * (1 - smooth(0, 0.3, diveE));   // calm pass: no bob once the dive is under way (a half-dived view holds still)
    floorBob = bob;
    // fix r4: a companion landmark reaches about 3.25 planet units left of the centre; on a narrow companion stage
    // (1440x900, 1280x720) that is past the stage edge, so while one is up the planet slides right (away from the text,
    // never past its own room on the right) instead of shrinking. Eased with the landmark's own rise.
    var halfAvail = st.w / 2 * upp0 / s, lmShift = clamp(3.25 - halfAvail, 0, Math.max(0, halfAvail - 2.25)) * lmUpK * (1 - smooth(0, 0.6, endK));
    holder.position.set(lmShift * s, figY * s - bob * upp0, 0);
    holder.scale.setScalar(s);
    // tilt toward the cursor (fine pointers, zoomed out)
    var tgx = 0, tgy = 0;
    if (fineQ.matches && pointer.seen && !still && diveE < 0.5 && !dragS && inStage(pointer.x, pointer.y)) {
      var nx = clamp((pointer.x - (st.x + st.w / 2)) / (st.w / 2), -1, 1), ny = clamp((pointer.y - (st.y + st.h / 2)) / (st.h / 2), -1, 1);
      tgy = nx * 0.07; tgx = ny * 0.05;
    }
    tiltX.goal = tgx * (1 - diveE); tiltY.goal = tgy * (1 - diveE);
    if (still) { tiltX.snap(0); tiltY.snap(0); } else { tiltX.step(dt); tiltY.step(dt); }
    holder.rotation.set(tiltX.x, tiltY.x, 0);

    // ----- roll: critically damped spring, so wheel notches blend into one smooth run
    angS.goal = angleGoal;
    if (still || !intro.started) angS.snap(angleGoal); else angS.step(dt);
    if (!dragS || !dragS.on) {
      if (drag.coast) {
        drag.x += drag.v * dt;
        drag.v *= Math.pow(0.998, dt * 1000);
        if (Math.abs(drag.v) < 1.2) { drag.coast = false; drag.goal = Math.round(drag.x / (Math.PI * 2)) * Math.PI * 2; }
      } else drag.step(dt);
      if (drag.calm(1e-4) && drag.goal !== 0) drag.snap(0);
    }
    if (diveE > 0.02 && !drag.calm(1e-3)) { drag.goal = Math.round(drag.x / (Math.PI * 2)) * Math.PI * 2; drag.coast = false; }

    // ----- what-if clock: three stages, then it puts itself back; the planet's intensities follow the stage
    stepWi(dtW, still);
    stepFx(still, dt);
    if (mode && wi.mode === mode) {
      var STG = [0, 0.45, 0.8, 1.15][wi.stage];
      modeG.goal = mode === 'gravity' ? STG : 0; modeT.goal = mode === 'typhoon' ? STG : 0;
      modeL.goal = mode === 'lava' ? Math.min(1, STG * 1.1) : 0;
    }
    // ----- what-if intensities (world clock, so holding freezes them too)
    if (!still) { modeG.step(dtW); modeT.step(dtW); modeS.step(dtW); modeL.step(dtW); modeC.step(dtW); }
    var G = clamp(modeG.x, 0, 1.2), TY = clamp(modeT.x, 0, 1.2), ST = clamp(modeS.x, 0, 1.2), LV = clamp(modeL.x, 0, 1.2), CL = clamp(modeC.x, 0, 1.2);
    if (mode !== 'stop' && ST < 1e-3 && stopOff.calm(1e-3) && phi.calm(1e-3)) { stopClock = 0; stopFling = 0; }
    if (mode === 'stop') {
      stopClock += dtW;
      // everything slides east, faster at each stage
      var stopGoal = 0.55 * [0, 0.45, 1, 1.75][wi.mode === 'stop' ? wi.stage : 3];
      if (still) stopOff.snap(stopGoal);
      else { stopOff.tune(0.5, 1); stopOff.goal = stopGoal; stopOff.step(dtW); }
    } else if (!still) { stopOff.tune(0.8, 1); stopOff.step(dtW); }

    var angle = angS.x + drag.x + stopOff.x;
    var angVel = still ? 0 : angS.v + (dragS && dragS.on ? 0 : drag.v) + stopOff.v * tk;
    if (dragS && dragS.on && dragS.hist.length > 1) {
      var h0 = dragS.hist[0], h1 = dragS.hist[dragS.hist.length - 1];
      angVel += (h1[0] > h0[0] ? (h1[1] - h0[1]) / ((h1[0] - h0[0]) / 1000) : 0);
    }
    var groundVel = angVel * R;
    roller.rotation.z = angle;
    groundRoller.rotation.z = angle;
    lavaU.value = LV;

    // ----- landmarks: the active one rises (calm, no ticks) zoomed out; grows and comes alive as the camera dives
    var baseAngle = angS.x + stopOff.x, lmUpNext = 0;
    Object.keys(LM).forEach(function (n) {
      var L = LM[n], e = registry[n];
      var sceneUp = e && e.built && n === diveStop && diveE > 0.3;   // the landmark gives way once the place has begun to grow (no gap)
      var near = Math.abs(wrapPi(baseAngle - stops[n])) < STEP * 0.9;
      var want = (n === curStop && near && intro.started && (intro.done || intro.t > 0.7) && !sceneUp) ? 1 : 0;
      // the end card: every landmark rises, one after another, and moves to its place round the rim
      var ci = CARD_ORDER.indexOf(n), kM = smooth(0, 0.6, endK);
      if (endK > 0.12 + ci * 0.06) want = 1;
      if (kM > 1e-4) {
        cardPose(ci, roller.rotation.z);
        L.mount.position.lerpVectors(L.p0, cardP, kM);
        L.mount.quaternion.slerpQuaternions(L.q0, cardQ, kM);
        L.carded = true;
      } else if (L.carded) { L.mount.position.copy(L.p0); L.mount.quaternion.copy(L.q0); L.carded = false; }
      L.rise.goal = want;
      if (still || !intro.started) L.rise.snap(want); else L.rise.step(dt);
      var r = L.rise.x;
      if (LM_AT[n] && kM < 1e-4) lmUpNext = Math.max(lmUpNext, clamp(r, 0, 1));
      L.riser.visible = r > 0.004;
      if (!L.riser.visible) return;
      var grow = n === diveStop ? 1 + 0.3 * diveE : 1;
      L.riser.position.y = -(1 - r) * (L.h + 0.3);
      L.riser.scale.setScalar((0.45 + 0.55 * clamp(r, 0, 1.2)) * grow * lerp(1, CARD_LM * L.cardK, kM));
      if (L.lean) L.content.rotation.z = -L.lean * (1 - kM);   // the card stands every landmark radial
      var busy = (n === diveStop && diveE > 0.3) || endK > 0.5;
      if (L.tick && busy && !still) L.tick(time + L.ph, dtW);
      else if (L.tick && n === 'films') L.tick(0, 0);
      if (G > 0.001) {
        L.fx.position.y = G * (0.22 + 0.05 * Math.sin(time * 0.8 + L.ph));
        L.fx.rotation.set(G * 0.12 * Math.sin(time * 0.5 + L.ph), 0, G * 0.1 * Math.sin(time * 0.4));
      } else if (L.fx.position.y !== 0) { L.fx.position.y = 0; L.fx.rotation.set(0, 0, 0); }
    });
    lmUpK = lmUpNext;   // used by next frame's placement (the slide right for a wide companion landmark)

    // ----- scenes: grow in as the camera arrives, update while visible
    Object.keys(registry).forEach(function (n) {
      var e = registry[n];
      if (!e.built) return;
      var goal = n === diveStop ? smooth(0.12, 0.62, diveE) : 0;
      e.grow.goal = goal;
      if (still) e.grow.snap(goal); else e.grow.step(dt);
      var gk = Math.max(0, e.grow.x);
      e.wrap.visible = gk > 0.003;
      e.wrap.scale.setScalar(KS * Math.max(0.0001, gk));
      if (!e.wrap.visible) return;
      var cx2 = e.ctx;
      cx2.dive = n === diveStop ? diveE : 0; cx2.arrived = n === diveStop && diveE > 0.9; cx2.frozen = frozen || tk < 0.05;
      cx2.mode = n === routedTo ? pageMode : null; cx2.beat = n === diveStop ? beat.p : 0; cx2.time = time; cx2.reduced = still; cx2.quality = WORLD.quality;
      var cs2 = cx2.stage || (cx2.stage = {});
      cs2.x = st.x; cs2.y = st.y; cs2.w = st.w; cs2.h = st.h;
      cx2.whatIfStage = cx2.mode && wi.mode === cx2.mode ? wi.stage : 0; cx2.whatIfT = cx2.mode && wi.mode === cx2.mode ? wi.t : 0;
      try { e.def.update(time, still ? 0 : dtW, cx2); } catch (err) { sceneError(n, err); }
    });
    if (moveQueued && diveE > 0.9 && !dragS) {
      var mq = moveQueued; moveQueued = null;
      var hr = sceneHit(mq[0], mq[1]);
      setCursor(hr && hr.hit && clickable(hr.hit.object) ? 'pointer' : '');
      if (hr && hr.e.def.onPointer) { try { hr.e.def.onPointer({ type: 'move', x: mq[0], y: mq[1], hit: hr.hit }, hr.e.ctx); } catch (err4) { sceneError(diveStop, err4); } }
    }

    // ----- fix r4 detail: the still planet detail shows once the intro has built the planet; boats hide on lava
    detailG.visible = intro.done || intro.t > 0.95;
    detailG.scale.setScalar(1 - 0.09 * smooth(0.12, 0.45, diveE));   // it sinks into the planet as a dive begins (scroll-driven, like the decor)
    detailBoats[0].visible = detailBoats[1].visible = LV < 0.05;
    showRunRoad(angle, endK);
    // ----- decor shows on the top and the front face only; it sinks under a place that is showing its scene
    globe.getWorldQuaternion(qA);
    var sceneShowing = null;
    Object.keys(registry).forEach(function (n) { var e = registry[n]; if (e.built && e.wrap.visible) sceneShowing = n; });
    decor.forEach(function (d) {
      vA.copy(d.dir).applyQuaternion(qA);
      var clear = true;
      for (var n2 = 0; n2 < d.near.length; n2++) if (LM[d.near[n2]].rise.goal > 0) clear = false;
      if (sceneShowing && d.nearPlace.indexOf(sceneShowing) >= 0) clear = false;
      d.show.goal = clear && diveE < 0.25 && (vA.y > 0.42 || vA.z > 0.78) ? 1 : 0;
      if (still || !intro.done) d.show.snap(d.show.goal); else d.show.step(dt);
      var kk = Math.max(0, d.s * clamp(d.show.x, 0, 1.2));
      d.mesh.visible = kk > 0.01;
      d.mesh.scale.setScalar(Math.max(0.001, kk));
    });

    // ----- decor: gravity lift and tumble, typhoon lean (trees), stop slide, lava hops
    var anyFx = G > 0.001 || TY > 0.001 || ST > 0.001 || stopClock > 0 || LV > 0.001;
    if (anyFx || decor.fxOn) {
      decor.fxOn = anyFx;
      var tStop = Math.min(stopClock, 8);
      decor.forEach(function (d) {
        var slide = ST * (d.slideA + d.slideB * Math.max(0, tStop - 0.4));
        if (slide > 1e-4) {
          qA.setFromAxisAngle(SPIN_AXIS_G, -slide);
          d.mount.position.copy(d.dir).applyQuaternion(qA).multiplyScalar(R);
          d.mount.quaternion.copy(qA).multiply(d.q0);
        } else if (d.slid) { d.mount.position.copy(d.dir).multiplyScalar(R); d.mount.quaternion.copy(d.q0); }
        d.slid = slide > 1e-4;
        var bobG = still ? 1 : 1 + 0.12 * Math.sin(time * 0.7 + d.ph);
        var hop = LV * (still ? 0.06 : 0.16 * Math.abs(Math.sin(time * 6.5 + d.ph)));
        d.mesh.position.y = G * d.lift * bobG + hop;
        eul.set(G * d.tx * (still ? 0.5 : Math.sin(time * 0.45 + d.ph)), 0, G * d.tz * (still ? 0.5 : Math.cos(time * 0.38 + d.ph)), 'YXZ');
        qB.setFromEuler(eul);
        if (d.kind === 'tree' && TY > 0.001) {
          d.mount.getWorldQuaternion(qC).invert();
          vA.copy(WIND_W).applyQuaternion(qC); vA.y = 0;
          if (vA.lengthSq() > 1e-6) {
            vA.normalize();
            vB.crossVectors(UP, vA).normalize();
            var gust = still ? 0 : 0.12 * Math.sin(time * 7 + d.ph) + 0.06 * Math.sin(time * 13);
            qC.setFromAxisAngle(vB, TY * (0.42 + gust));
            qB.premultiply(qC);
          }
        }
        d.mesh.quaternion.copy(qB);
      });
      if (!anyFx) decor.forEach(function (d) { d.mesh.position.y = 0; d.mesh.quaternion.identity(); d.mount.position.copy(d.dir).multiplyScalar(R); d.mount.quaternion.copy(d.q0); });
    }

    // ----- clones
    if (CL > 0.002 || cloneT >= 0) {
      if (cloneT >= 0) cloneT += dtW;
      var showC = CL > 0.002;
      clonesBody.visible = clonesArm.visible = showC;
      if (showC) {
        for (var j = 0; j < clones.length; j++) {
          var cl = clones[j];
          // more of them at each stage
          if (mode === 'clones' && cl.at < 0 && j < CLONE_N * [0, 0.2, 0.55, 1][wi.mode === 'clones' ? wi.stage : 3]) cl.at = cloneT + cl.del * 0.5;
          var pop = mode === 'clones' ? (cl.at < 0 ? 0 : outBack((cloneT - cl.at) / 0.34)) : clamp(CL, 0, 1);
          var sk = Math.max(0.0001, pop * cl.s);
          cp.copy(cl.d).multiplyScalar(R);
          cs.set(sk, sk, sk);
          cm4.compose(cp, cl.q, cs);
          clonesBody.setMatrixAt(j, cm4);
          var wv = still ? -2.5 : -2.5 + 0.55 * Math.sin(time * 9 + cl.ph);
          ZQ.setFromAxisAngle(Z_AX, wv);
          cm5.compose(cp.set(0.17, 0.8, 0), ZQ, cs.set(1, 1, 1));
          clonesArm.setMatrixAt(j, cm4.multiply(cm5));
        }
        clonesBody.instanceMatrix.needsUpdate = true;
        clonesArm.instanceMatrix.needsUpdate = true;
      } else cloneT = -1;
    }

    // ----- clouds: drift, scroll parallax by depth, typhoon race, stop freeze, gravity float; fade at the stage edge
    // r13 pass B: the clouds drift again (the world is alive); scroll parallax and the typhoon what-if as before
    var drift = still ? 0 : (1 - ST) + TY * 30;
    var cloudK = 1 - smooth(0, 0.35, diveE);
    holder.updateWorldMatrix(true, false);
    placeCamera(0, st); // the zoomed-out camera, to place the clouds against the stage edges
    clouds.forEach(function (cl) {
      if (!still) {
        cl.a += cl.speed * dtW * drift + dy * 0.0011 * cl.par * (1 - ST) * tk;
        cl.yOff.goal = clamp(-scrollV * 0.00035 * cl.par, -0.5, 0.5);
        cl.yOff.step(dt);
      }
      var a = cl.a + (cl.introA || 0) + ST * 0.3 * cl.par;
      var lift = G * cl.lift * (still ? 1 : 1 + 0.15 * Math.sin(time * 0.6 + cl.ph));
      cl.g.position.set(Math.sin(a) * cl.r, cl.y + cl.yOff.x + lift, Math.cos(a) * cl.r);
      cl.g.rotation.set(G * 0.4 * Math.sin(time * 0.3 + cl.ph), 0, G * cl.tx * 0.3);
      // keep a whole cloud inside the stage: shrink it away as it nears an edge
      vA.copy(cl.g.position).applyMatrix4(holder.matrixWorld).project(cam);
      var px2 = (vA.x + 1) / 2 * st.w, py2 = (1 - vA.y) / 2 * st.h;
      var rpx = 0.5 * cl.size * s / upp0;
      var edge = Math.min(px2, st.w - px2, py2, st.h - py2) - rpx;
      var ek = vA.z > 1 ? 0 : smooth(0, 40, edge);
      var kk = (cl.introK === undefined ? 0 : cl.introK) * ek * cloudK;
      cl.g.visible = kk > 0.01;
      cl.g.scale.setScalar(Math.max(0.001, cl.size * kk));
    });

    // ----- rain, inside the stage
    if (TY > 0.01 && diveE < 0.5) {
      rain.visible = true;
      var len = clamp(TY, 0, 1);
      var hx = (st.w * upp0 / 2) / s * 0.94, hyT = ((st.h * upp0 / 2) - holder.position.y) / s * 0.94, hyB = (-(st.h * upp0 / 2) - holder.position.y) / s * 0.94;
      for (var j2 = 0; j2 < rain.count; j2++) {
        var dp = drops[j2];
        if (!still) {
          dp.addScaledVector(rainDir, 10 * dtW);
          if (dp.y < hyB + 0.3 || dp.x < -hx + 0.2) { dp.y = hyT - 0.3 - rnd() * 0.6; dp.x = -hx * 0.6 + rnd() * hx * 1.55; }
        }
        dp.x = Math.min(dp.x, hx - 0.2);
        sclV.set(1, len, 1);
        mtx.compose(dp, rainQ, sclV);
        rain.setMatrixAt(j2, mtx);
      }
      rain.instanceMatrix.needsUpdate = true;
    } else rain.visible = false;

    // ----- camera, then YOU (his head looks through this camera)
    if (diveE > 1e-4) stepArrived(dt, still, st);
    placeCamera(diveE, st);
    stepGuy(dt, dtW, still, groundVel, G, TY, ST, inScene, st);
    // distance fade toward this place's field colour, only once arrived
    fadeU.col.value.set(FIELD_COL[diveStop] || '#BFE7F1');
    fadeU.max.value = 0.6 * smooth(0.55, 1, diveE);
    dimU.value = smooth(0.4, 1, diveE) * (relLum(fadeU.col.value) < 0.05 ? 0.55 : 0.3);
    if (diveE > 1e-4) {
      var dLook = cam.position.distanceTo(camP), unit = KS * s;
      fadeU.near.value = dLook + 4 * unit; fadeU.far.value = dLook + 18 * unit;
    }

    // sun follows what the camera looks at, so its shadows stay put
    holder.updateWorldMatrix(true, false);
    vB.setFromMatrixPosition(holder.matrixWorld).lerp(camT, diveE);
    sun.target.position.copy(vB);
    keyLight(dt, still);
    // the whole globe keeps a brighter fill (the logo look); street level gets the low fill and the stronger key
    // iPad pass (fix 7, depth): less fill and a stronger key, so each form has a clearly lit and a clearly darker side
    // (was hemi 1.35 to 0.75, key 2.5 to 3.1)
    hemi.intensity = lerp(LIGHT.fill0, LIGHT.fill1, diveE); sun.intensity = lerp(LIGHT.key0, LIGHT.key1, diveE);
    sun.position.copy(vB).addScaledVector(sunDir, 10 * s);
    var ext = lerp((R + GUY_H + 0.6) * s, 1.45 * s, diveE);
    var sc2 = sun.shadow.camera;
    if (Math.abs(sc2.right - ext) > 1e-3) {
      sc2.left = -ext; sc2.right = ext; sc2.top = ext; sc2.bottom = -ext;
      sc2.near = 0.1; sc2.far = 30 * s; sc2.updateProjectionMatrix();
      sun.shadow.normalBias = 0.02 * s;
    }

    // ----- draw: clear the whole canvas, then draw only inside the stage
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, vw, vh);
    renderer.clear();
    var dr = vp || st, yb = vh - (dr.y + dr.h);
    renderer.setViewport(dr.x, yb, dr.w, dr.h);
    renderer.setScissor(dr.x, yb, dr.w, dr.h);
    renderer.setScissorTest(true);
    renderer.render(sc, cam);
    warmScenes(dr, yb);
    placeFloor(st);
    WORLD._stats.frames++;
    WORLD._stats.last = performance.now() - t0;
    WORLD._stats.tris = renderer.info.render.triangles; WORLD._stats.calls = renderer.info.render.calls; WORLD._stats.geos = renderer.info.memory.geometries; WORLD._stats.texs = renderer.info.memory.textures;
    WORLD._stats.time = time;
  }

  // iPad pass (fix 5): the planet's contact shadow. A flat soft ellipse on the field just under the disc, at the
  // planet's lowest point of its float, so it reads as resting a hair above a surface: as the planet floats up the
  // shadow gets a little smaller and lighter. Zoomed out only (it fades in the first moments of a dive), never past
  // the stage's lower edge (anything that would be is hidden under the planet itself), and off on the dark fields.
  var floorBob = 0, floorCol = new T.Color();
  function placeFloor(st) {
    var d = discRaw(), lum = relLum(floorCol.set(FIELD_COL[curStop] || '#BFE7F1'));
    // (off on the first screen: there the planet stands on the name, and a shadow behind the letters read as a smudge)
    var a = (1 - smooth(0, 0.12, diveE)) * (lum < 0.05 ? 0 : 1) * (1 - clamp(bobK, 0, 1));
    if (!d || !st || a < 0.01 || !holder.visible || d.r < 8) {
      if (floorVis) { floorVis = false; floorEl.style.visibility = 'hidden'; }
      return;
    }
    var lift = clamp((2.5 - floorBob) / 5, 0, 1);
    var w = d.w * 0.78 * (1 - 0.07 * lift), h = Math.max(5, d.w * 0.075);
    var floorY = d.cy + d.r - floorBob + 2.5 + d.r * 0.02;
    var cy = Math.min(floorY + h * 0.12, st.y + st.h + 2 - h / 2);
    var op = a * (1 - 0.3 * lift);
    var key = (d.cx - w / 2).toFixed(1) + ',' + (cy - h / 2).toFixed(1) + ',' + (w / 600).toFixed(4) + ',' + (h / 80).toFixed(4) + ',' + op.toFixed(3);
    if (key !== floorKey) {
      floorKey = key;
      floorEl.style.transform = 'translate(' + (d.cx - w / 2).toFixed(1) + 'px,' + (cy - h / 2).toFixed(1) + 'px) scale(' + (w / 600).toFixed(4) + ',' + (h / 80).toFixed(4) + ')';
      floorEl.style.opacity = op.toFixed(3);
    }
    if (!floorVis) { floorVis = true; floorEl.style.visibility = 'visible'; }
  }

  // a place that was just built is drawn once, full size, into a 1 px corner of the canvas (all its buffers and
  // textures go up to the GPU a section early), so its first real frame in the dive does not stall
  function warmScenes(dr, yb) {
    Object.keys(registry).forEach(function (n) {
      var e = registry[n];
      if (!e.built || !e.warm || e.wrap.visible) return;
      e.warm--;
      if (e.warm) return;   // the frame after the build, when its update has run once
      e.wrap.visible = true; e.wrap.scale.setScalar(KS);
      renderer.setScissor(dr.x, yb, 1, 1); renderer.setScissorTest(true);
      try { renderer.render(sc, cam); } catch (err) { /* it uploads on first draw instead */ }
      e.wrap.visible = false; e.wrap.scale.setScalar(0.0001);
    });
  }

  // where YOU stands in the arrived place, in holder space
  var scP = new T.Vector3(), scM = new T.Matrix4(), hInv = new T.Matrix4(), scS = new T.Vector3();
  var plantUp = new T.Vector3(), plantQ = new T.Quaternion(), offQ = new T.Quaternion(), qR = new T.Quaternion();
  function scenePose(outP, outQ) {
    var hasScene = registry[diveStop] && registry[diveStop].built;
    var pl = hasScene ? sceneYou.place : [3.4, 2.2, -0.35], off = hasScene ? sceneYou.off : [0, 0, 0, 0, 0];
    var x = pl[0], z = pl[1];
    var r2 = x * x + z * z, gy = r2 >= SR * SR ? -SR : Math.sqrt(SR * SR - r2) - SR;
    plantUp.set(x, gy + SR, z).normalize();
    plantQ.setFromUnitVectors(UP, plantUp).multiply(qR.setFromAxisAngle(UP, pl[2]));
    eul.set(off[3], 0, off[4], 'YXZ');
    offQ.setFromEuler(eul);
    plantQ.multiply(offQ);
    scP.set(x + off[0], gy + off[1], z + off[2]).multiplyScalar(KS);
    var pm = PLACE[diveStop].mount;
    holder.updateWorldMatrix(true, false);
    pm.updateWorldMatrix(true, false);
    hInv.copy(holder.matrixWorld).invert();
    scM.multiplyMatrices(hInv, pm.matrixWorld);
    scM.decompose(vB, qB, scS);
    outP.copy(scP).applyQuaternion(qB).add(vB);
    outQ.copy(qB).multiply(plantQ);
    return hasScene ? (1.8 * KS) / GUY_H * sceneYou.scale[0] : 0.42;
  }

  // ---------- W4: YOU looks at the work ----------
  // aim: the body turn (yaw, radians about his up; + = toward screen right, 0 = to the camera), the extra head turn
  // and the head pitch (+ = up) that point him at the text beside the stage. Worked out from the stage's place in
  // the window, or from the page's WORLD.setFocus point. It only changes when the stage does (scroll, layout).
  var aim = { yaw: 0, head: 0, pitch: 0, fx: 0, fy: 0, side: '' };
  function textAim(st) {
    var Wd = window.innerWidth || st.w, Hd = window.innerHeight || st.h, fx, fy, side;
    var hx = st.x + st.w / 2, hy = st.y + st.h * 0.15;   // about where his head is (he stands on top of the planet)
    if (focusPt) { fx = focusPt.x; fy = focusPt.y; side = 'page'; }
    else if (Wd >= 600 && Wd / Hd >= 1.3 && Wd >= 900) {
      // wide: the text is in the larger room beside the stage, its headline in the upper part of the window
      var lRoom = st.x, rRoom = Wd - st.x - st.w;
      fx = lRoom >= rRoom ? lRoom * 0.5 : Wd - rRoom * 0.5;
      fy = Math.min(hy, Hd * 0.35);   // level with his head, or up toward the headline when he stands low
      side = lRoom >= rRoom ? 'left' : 'right';
    } else {
      // tall and phone: the planet's band sits above the text (he looks down at it); a stage in the lower half of
      // the window (the phone's first screen) has the text above it
      var below = st.y + st.h / 2 < Hd / 2;
      fx = Wd * 0.25;   // the text starts at the left margin: a slight turn that way
      fy = below ? st.y + st.h + (Hd - st.y - st.h) * 0.4 : st.y * 0.5;
      side = below ? 'below' : 'above';
    }
    var dx = fx - hx, dy = fy - hy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    aim.yaw = clamp(ux * 1.05, -1.1, 1.1);
    aim.head = clamp(ux * 0.4, -0.45, 0.45);
    aim.pitch = clamp(-uy * 0.38, -0.36, 0.3);
    aim.fx = fx; aim.fy = fy; aim.side = side;
  }
  // 1 when the planet stands on a stop, 0 half way through a roll, eased with the roll's own (sprung) progress,
  // so a roll scrolled back turns him back exactly the same way
  function rollAimK() {
    if (Math.abs(rollSpan) < 1e-4) return 1;
    var prog = clamp(wrapPi(angS.x - rollA0) / rollSpan, 0, 1);
    var edge = Math.min(prog, 1 - prog) * Math.abs(rollSpan) / STEP;   // distance from the nearer end, in stops
    return 1 - smooth(0.04, 0.32, edge);
  }
  WORLD._face = function () { return { yaw: +faceS.x.toFixed(3), goal: +faceS.goal.toFixed(3), headYaw: +lookYaw.x.toFixed(3), headPitch: +lookPitch.x.toFixed(3), aimK: +rollAimK().toFixed(3), aim: { yaw: +aim.yaw.toFixed(3), head: +aim.head.toFixed(3), pitch: +aim.pitch.toFixed(3), side: aim.side } }; };

  var gP = new T.Vector3(), gQ = new T.Quaternion(), sP = new T.Vector3(), sQ = new T.Quaternion();
  function stepGuy(dt, dtW, still, groundVel, G, TY, ST, inScene, st) {
    var drop = stepGuyDrop(dt);
    if (!guyActive()) return;
    var zoomedOut = diveE < 0.1;

    // what the visible holder area allows (zoomed out), so YOU never leaves the stage
    var s = holder.scale.x;
    // (0.92: his box sits nearer the camera than the planet centre, so perspective makes it a little bigger)
    var topLim = ((st.h * upp0 / 2) * 0.92 - holder.position.y) / s - (GUY_H + 0.28);
    var xLim = (st.w * upp0 / 2) * 0.92 / s - 0.45;
    var botLim = (-(st.h * upp0 / 2) * 0.97 - holder.position.y) / s;

    // stop toy: he is flung off the top to the side, rolls, gets up; on reset he walks back
    if (mode === 'stop' && !still && !flick) {
      if (stopClock >= WI_AT[2] && !stopFling) { stopFling = 1; playOnce('Roll'); }
      if (stopFling) {
        var p = clamp((stopClock - WI_AT[2]) / 0.95, 0, 1);
        phi.x = 0.62 * outCubic(p); phi.v = 0; phi.goal = phi.x;
        drop = Math.max(drop, 0.55 * Math.sin(Math.PI * Math.min(1, p * 1.6)));
      }
    } else if (!still && !(flick && flick.phase !== 'down')) {
      if (flick && flick.phase === 'down') {
        if (!oneShot) { flick = null; phi.goal = 0; }
        else phi.goal = flick.landPhi;
      }
      phi.step(dtW);
    }
    var walkBack = !still && mode !== 'stop' && !flick && Math.abs(phi.v) > 0.02;
    if (walkBack) groundVel = phi.v * R;
    if (!zoomedOut) groundVel *= 1 - diveE;

    var speed = Math.abs(groundVel);
    // r13 pass D: on the start line a rolling planet means a run, at any scroll speed
    if (runHint > 0 && zoomedOut && speed > walkSpeed * 0.1) speed = Math.max(speed, runSpeed * 0.9 * runHint);
    if (!still) { if (groundVel > 0.25) dirSign = 1; else if (groundVel < -0.25) dirSign = -1; }

    // ----- idle acting zoomed out: look ahead after 4 s, sit after 15 s, stand when the visitor scrolls
    var idleFor = performance.now() - lastScroll;
    if (zoomedOut && !still && intro.done && !mode && !flick && !poke && speed < 0.3) {
      // lead r6 (calm rule): the sit after 15 s idle is off: a whole-body move that starts by itself while text is read
      if (SIT_WHEN_IDLE && idleFor > 15000 && !sitting && !sitAsked && !oneShot) { sitAsked = true; if (playOnce('SitDown', { hold: true })) sitting = true; }
    }
    if (sitting && (idleFor < 400 || mode || flick || !zoomedOut)) { sitting = false; playOnce('StandUp'); }
    if (idleFor < 400) sitAsked = false;
    // W4: the old "look ahead after 4 s idle" turn is gone (a turn on a timer); he keeps facing the text instead
    var lookAhead = false;
    var aimK = rollAimK();
    textAim(st);

    // ----- globe pose (gP, gQ)
    var lavaK = clamp(modeL.x, 0, 1);
    var lift = G * (0.7 + (still ? 0 : 0.1 * Math.sin(time * 0.9))) + drop + lavaK * (still ? 0.15 : 0.32 * Math.abs(Math.sin(time * 5.2)));
    var tumX = still ? G * 0.15 : G * 0.2 * Math.sin(time * 0.7), tumZ = still ? G * 0.1 : G * 0.25 * Math.sin(time * 0.5 + 1);
    var accel = dt > 0 ? (groundVel - lastVel) / dt : 0;
    lastVel = groundVel;
    lean.goal = clamp(-groundVel * 0.025 - accel * 0.004, -0.16, 0.16) - TY * 0.24;
    if (still) lean.snap(lean.goal); else lean.step(dt);

    if (flick && flick.phase !== 'down') {
      flick.t += dtW;
      if (flick.phase === 'fly' && dtW > 0) {
        var pl = flick.p, vv = flick.v, rr = pl.length() || 1;
        vv.x += -pl.x / rr * 15 * dtW; vv.y += -pl.y / rr * 15 * dtW;
        pl.addScaledVector(vv, dtW);
        // soft walls at the stage edges
        if (pl.x > xLim) { pl.x = xLim; vv.x = -Math.abs(vv.x) * 0.45; }
        if (pl.x < -xLim) { pl.x = -xLim; vv.x = Math.abs(vv.x) * 0.45; }
        if (pl.y > topLim) { pl.y = topLim; vv.y = -Math.abs(vv.y) * 0.45; }
        if (pl.y < botLim + 0.2) { pl.y = botLim + 0.2; vv.y = Math.abs(vv.y) * 0.45; }
        flick.rz += flick.rv * dtW;
        flick.rv *= Math.pow(0.4, dtW);
        rr = pl.length();
        if (rr <= GUY_R && pl.dot(vv) < 0) {
          // landed: roll, get up, then walk back to the top
          flick.phase = 'down';
          var lp = Math.atan2(pl.x, pl.y);
          flick.landPhi = lp;
          phi.snap(lp);
          sq.x = 0; sq.v = -4.5;
          playOnce('Roll', { then: 'StandUp' });
        }
      }
      if (flick && flick.phase !== 'down') {
        if (flick.phase === 'held') {
          flick.p.x = clamp(flick.p.x, -xLim, xLim);
          flick.p.y = clamp(flick.p.y, botLim + 0.2, topLim);
          var hv = flick.hist.length > 1 ? flick.hist[flick.hist.length - 1][1] - flick.hist[0][1] : 0;
          flick.rz += (clamp(-hv * 1.5, -0.6, 0.6) - flick.rz) * Math.min(1, dt * 8);
        }
        gP.set(flick.p.x, flick.p.y, GUY_Z);
        eul.set(0, 0, flick.rz, 'YXZ');
        gQ.setFromEuler(eul);
      }
    }
    if (!flick || flick.phase === 'down') {
      lift = Math.min(lift, Math.max(0, topLim - GUY_R - 0.3 * G));
      gP.set(GUY_R * Math.sin(phi.x), GUY_R * Math.cos(phi.x), GUY_Z);
      gP.x += Math.sin(phi.x) * lift; gP.y += Math.cos(phi.x) * lift;
      eul.set(tumX, 0, -phi.x + lean.x + tumZ, 'YXZ');
      gQ.setFromEuler(eul);
    }

    // ----- blend toward the place (scene pose)
    var sScene = 1;
    if (inScene > 0.001) {
      sScene = scenePose(sP, sQ);
      gP.lerp(sP, inScene);
      gQ.slerp(sQ, inScene);
    }
    you.position.copy(gP);
    you.quaternion.copy(gQ);
    you.scale.setScalar(lerp(1, sScene, inScene));

    blob.visible = WORLD.quality === 'low' && you.visible && inScene < 0.5;
    if (blob.visible) {
      vA.set(GUY_R * Math.sin(phi.x), GUY_R * Math.cos(phi.x), GUY_Z).normalize();
      blob.position.copy(vA).multiplyScalar(R + 0.015);
      blob.quaternion.setFromUnitVectors(Z_AXIS, vA);
      blob.scale.setScalar(1 / (1 + lift * 1.2));
    }
    if (still) sq.snap(0); else sq.step(dt);
    squash.scale.set(1 - sq.x * 0.5, 1 + sq.x, 1 - sq.x * 0.5);

    // which way he faces
    // W4: on a stop he faces the text (aim, worked out from the stage); while the planet rolls he faces the way he
    // walks; the blend follows the roll's own progress (aimK), so the turn is eased with the roll, the same both ways
    var faceGoal = lerp(FACE * dirSign + (walkBack ? 0 : RUN_TURN), aim.yaw, aimK);
    var lookExtraYaw = aim.head * aimK;
    if (oneShot && oneShot.name === 'Victory' && !oneShot.fading) faceGoal = 0;
    if (sitting || (oneShot && (oneShot.name === 'SitDown' || oneShot.name === 'StandUp'))) faceGoal = lerp(0.35, aim.yaw, aimK);
    if (lookAhead) { faceGoal = FACE; lookExtraYaw = 0.42; }
    if (glance) {
      if (glance.at < 0 && speed < 0.5 && !oneShot) glance.at = time;
      if (glance.at < 0 && performance.now() - glance.asked > 3000) glance = null;
      else if (glance.at >= 0) {
        if (time - glance.at < 1.15) { faceGoal = -FACE - 0.55; lookExtraYaw = -0.35; }
        else glance = null;
      }
    }
    if (TY > 0.3) faceGoal = FACE;
    if (flick && flick.phase !== 'down') faceGoal = 0.3;
    faceS.goal = faceGoal;
    if (still) faceS.snap(faceGoal); else faceS.step(dt);
    facing.rotation.y = lerp(faceS.x, 0, inScene);

    if (pending.wave && intro.landed) { pending.wave = false; if (!still && !flick) playOnce('Victory'); }

    // ----- animation weights
    var w = {}, kname;
    var base = inScene > 0.5 ? sceneYou.base : null;
    if (base && acts[base]) w[base] = 1;
    else {
      var wWalk = smooth(walkSpeed * 0.12, walkSpeed * 0.5, speed);
      var wRun = smooth(walkSpeed * 1.1, runSpeed * 0.7, speed);
      w.Idle = 1 - wWalk; w.Walk = wWalk * (1 - wRun); w.Run = wWalk * wRun;
      if (TY > 0.02 && !walkBack && zoomedOut) { var kT = clamp(TY, 0, 1); w.Idle *= 1 - kT; w.Run *= 1 - kT; w.Walk = w.Walk * (1 - kT) + kT; }
      if (G > 0.02 && zoomedOut) { var gk = clamp(G, 0, 1); w.Idle *= 1 - gk; w.Walk *= 1 - gk; w.Run *= 1 - gk; w.JumpHold = gk; }
      if (lavaK > 0.02 && zoomedOut) { var lk2 = lavaK * 0.8; w.Idle *= 1 - lk2; w.Walk *= 1 - lk2; w.Run *= 1 - lk2; w.JumpHold = (w.JumpHold || 0) + lk2; }
    }
    if (flick && flick.phase !== 'down') w = { JumpHold: 1 };
    if (!intro.landed) w = { JumpHold: 1 };
    if (oneShot) {
      var oa = oneShot.act, dur = oa.getClip().duration;
      if (!oneShot.fading && !oneShot.hold && oa.time >= dur - 0.18 * Math.max(0.2, oa.timeScale)) {
        oneShot.fading = true;
        if (oneShot.then) { var nx2 = oneShot.then; oneShot.then = null; if (LOOPS[nx2]) sceneYou.base = nx2; else playOnce(nx2); }
      }
      if (oneShot && !oneShot.fading) { w = {}; w[oneShot.name] = 1; }
      else if (oneShot && oneShot.act.w < 0.02) { oneShot.act.paused = true; oneShot = null; }
    }
    var tau = still ? 1 : 1 - Math.exp(-dt / 0.13), sum = 0;
    for (kname in acts) {
      var a = acts[kname], tw = w[kname] || 0;
      a.w = still ? tw : a.w + (tw - a.w) * tau;
      sum += a.w;
    }
    for (kname in acts) acts[kname].setEffectiveWeight(sum > 0 ? acts[kname].w / sum : 0);

    if (acts.Walk) acts.Walk.timeScale = base === 'Walk' ? sceneYou.speed || 1 : TY > 0.3 && !walkBack ? 0.7 : clamp(speed / walkSpeed, 0.6, 2.0);
    if (acts.Run) acts.Run.timeScale = base === 'Run' ? sceneYou.speed || 1 : clamp(speed / runSpeed, 0.65, 2.4);
    mixer.update(still ? 0 : dtW);
    if (base && acts[base] && base !== 'Walk' && base !== 'Run' && !acts[base].paused) acts[base].timeScale = sceneYou.speed || 1;
    stepHeld();
    if (headBone) headBone.scale.setScalar(headRest * lerp(1, sceneYou.scale[1], clamp(inScene, 0, 1)));

    // ----- head: follows the cursor (fine pointers), or what the scene asks him to look at
    if (still || !headBone) return;
    var gy = lookExtraYaw * (1 - inScene), gp = aim.pitch * aimK * (1 - inScene);
    var lookPt = null;
    if (inScene > 0.5 && sceneYou.look && registry[diveStop] && registry[diveStop].built) {
      lookPt = vB.set(sceneYou.look[0], sceneYou.look[1], sceneYou.look[2]);
      registry[diveStop].group.localToWorld(lookPt);
    }
    if (oneShot && oneShot.name === 'Victory') { gy = 0; gp = 0.05; }
    else if (oneShot && !oneShot.fading) { gy = 0; gp = 0; }
    else if (!glance && !lookAhead && !sitting && (lookPt || (fineQ.matches && pointer.seen && inStage(pointer.x, pointer.y)))) {
      you.updateWorldMatrix(true, true);
      headBone.getWorldPosition(vA);
      if (!lookPt) {
        var vr = vp || st;
        vB.set((pointer.x - vr.x) / vr.w * 2 - 1, -((pointer.y - vr.y) / vr.h * 2 - 1), 0.5).unproject(cam).sub(cam.position).normalize();
        var dCam = vA.distanceTo(cam.position) * 0.82;
        vB.multiplyScalar(dCam).add(cam.position);
      }
      vB.sub(vA);
      facing.getWorldQuaternion(qF).invert();
      vB.applyQuaternion(qF);
      gy = clamp(Math.atan2(vB.x, vB.z), -0.62, 0.62);
      gp = clamp(Math.atan2(vB.y, Math.hypot(vB.x, vB.z)), -0.35, 0.4);
    }
    lookYaw.goal = gy; lookPitch.goal = gp;
    lookYaw.step(dt); lookPitch.step(dt);
    if (Math.abs(lookYaw.x) + Math.abs(lookPitch.x) < 1e-3) return;
    you.updateWorldMatrix(true, true);
    facing.getWorldQuaternion(qF);
    [[neckBone, 0.4], [headBone, 0.6]].forEach(function (bp) {
      var b = bp[0]; if (!b) return;
      eul.set(-lookPitch.x * bp[1], lookYaw.x * bp[1], 0, 'YXZ');
      qD.setFromEuler(eul);
      qA.copy(qF).multiply(qD).multiply(qC.copy(qF).invert());
      b.getWorldQuaternion(qB);
      b.parent.getWorldQuaternion(qC);
      b.quaternion.copy(qC.invert().multiply(qA.multiply(qB)));
      b.updateMatrixWorld(true);
    });
  }

  start = function () {
    if (running || dead || paused) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { dirty = true; start(); } });
  if (reduceQ.addEventListener) reduceQ.addEventListener('change', function () { dirty = true; if (reduceQ.matches) finishIntro(); });
  window.addEventListener('scroll', function () { dirty = true; }, { passive: true });
  start();
})();
