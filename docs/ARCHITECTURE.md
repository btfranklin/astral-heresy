# Architecture

Astral Heresy is a small dependency-free browser game. It runs as ES modules in the browser and is intentionally organized around a central composition root plus domain-focused folders under `src/`.

## Entry Points

- [`../index.html`](../index.html): page shell, canvases, overlays, and module bootstrap
- [`../src/index.js`](../src/index.js): locates DOM nodes, creates the game, and exposes `window.__astralHeresy`
- [`../src/core/game.js`](../src/core/game.js): composition root for state, systems, renderers, UI sync, and the requestAnimationFrame loop
- [`../scripts/play.sh`](../scripts/play.sh): local server helper for manual inspection

## Runtime Model

The main loop is owned by [`../src/core/game.js`](../src/core/game.js).

Initialization order:

1. Create long-lived state objects: game state, player state, audio engine, event bus.
2. Create input, rendering, and UI adapters.
3. Build the narrow runtime content context used by stage and boss patterns.
4. Attach input and UI listeners.
5. Resize canvases and player bounds.
6. Optionally enter render-study mode from URL parameters.
7. Start the `requestAnimationFrame` loop.

Per-frame order:

1. `updateVisualFeedback`
2. refresh stage density budgets and reset stage-director frame reservations
3. `updateStage`
4. `updatePlayer`
5. `updateCombat`
6. `updateBullets`
7. `updateEnemies`
8. `updateMovement`
9. `updatePickups`
10. `updateParticles`
11. `updateBoss`
12. `handleCollisions`
13. `cleanupBullets`
14. `flushEntities`
15. build render buckets
16. project the read-only audio world and update the semantic audio engine
17. background render
18. canvas/entity render
19. DOM interface sync

Transient visual feedback decays in the update phase so its timing follows elapsed
time rather than render-call frequency. If you change ordering, document why
here. Collision timing, boss defeat timing, and entity cleanup behavior depend
on this sequence.

The browser's finite positive device-pixel ratio is retained in `state.view.dpr`.
The gameplay/UI Canvas uses that native ratio, while the procedural WebGL
background uses `min(state.view.dpr, 1.5)`. The background renderer owns its
actual drawing-buffer dimensions and coordinate scales, so background uniforms
do not assume that both canvases share one backing resolution.

During combat, the runtime controller measures the top of `#hull-panel` and sets
`state.playfield.maxY` 32 CSS pixels above it. This leaves about 14 pixels between
the ship body and the HUD. Movement reads this shared bound for both keyboard
and pointer input. The runtime measures after launch and viewport resize. A
`ResizeObserver` updates the bound when HUD content or fonts change its height.
It clamps the player and pointer target and disconnects on disposal. The game
does not read DOM geometry during each movement update. Before combat, bounds
use the viewport edge with the same clearance.

RAF callbacks and the lightweight idle update path remain continuous. Pixel
work is invalidated separately: showcases, active runs, shake, and particles
render continuously; initialization, resize, start, reset, showcase activation,
and debug spawns mark a frame dirty. One trailing frame clears the last
continuous effect before idle drawing settles. The WebGL renderer also skips an
identical scalar render signature, and `advanceTime()` always forces the Canvas
projection synchronously.

The WebGL background renderer owns `webglcontextlost` and
`webglcontextrestored` listeners on its canvas. It prevents the default loss
behavior, skips draws while the context is unavailable, then rebuilds its
program and buffer and reapplies the latest viewport when the browser restores
the context. It clears its render memo and marks the main loop dirty so an idle
game draws the recovered background. Gameplay state stays in the composition
root and does not change during this recovery.

The opt-in Playwright performance lane observes this browser-owned loop from
outside production modules. Timed RAF/CDP sampling and the separate untimed
Canvas/DOM/allocation pass live under `tests/performance/`; production renderers
must not gain benchmark-only branches or counters.

## State Ownership

- [`../src/state/gameState.js`](../src/state/gameState.js): global run state, input flags, entity list, viewport metrics, scoring, boss/run lifecycle
- [`../src/state/random.js`](../src/state/random.js): random generator owned by each run
- [`../src/state/playerState.js`](../src/state/playerState.js): player position, speed, fire cadence, invulnerability, hit points, burst state, weapon mode, and viewport-derived movement bounds
- [`../src/state/playfieldState.js`](../src/state/playfieldState.js): shared combat-lane geometry for open desktop play, player bounds, and stage-safe playfield helpers
- [`../src/state/runReset.js`](../src/state/runReset.js): shared fresh-run and loop-transition reset helpers
- [`../src/entities/entityFactory.js`](../src/entities/entityFactory.js): state-owned entity IDs, lifecycle, and deferred deletion
- [`../src/entities/components.js`](../src/entities/components.js): component payload shapes used by systems and renderers
- [`../src/entities/entityBuckets.js`](../src/entities/entityBuckets.js): frame-local typed views used by collision and rendering

The repo uses a lightweight ECS-style approach:

- State owns `entities`.
- Systems mutate state and entity components.
- Renderers read state and draw.
- The DOM UI mirrors state through [`../src/ui/interfaceController.js`](../src/ui/interfaceController.js).

## Gameplay Random Values

Each game state owns a random generator and an entity ID counter. A valid
`seed` URL parameter selects a fixed generator. A fresh run resets that
generator and the ID counter. A loop transition continues the same run.

Stage choices, enemy fire variation, random lane positions, and bullet motion
phases use this generator. Content calls `ctx.random()` or
`ctx.rand(min, max)`. These functions read the current generator so a restart
also resets random values in content closures.

Particles, camera shake, and audio use separate random sources. Drawing and
audio scheduling do not consume the gameplay sequence. Repeatable gameplay
requires the same seed, viewport, input, and sequence of update time steps.
The seed does not record input or fix the browser frame rate.

## Source Areas

- `src/core/`: composition root and shared primitives
- `src/state/`: durable state shapes and reset helpers
- `src/entities/`: entity shell plus component constructors
- `src/systems/`: gameplay mutation logic
- `src/data/`: content factories and reusable bullet-pattern helpers
- `src/rendering/`: WebGL background plus 2D entity/HUD drawing
- `src/audio/`: Web Audio setup and sound recipes; their present design
  language is documented in [`SOUND_DESIGN.md`](./SOUND_DESIGN.md)
- `src/ui/`: DOM synchronization for overlays and result screens
- `src/debug/`: explicit runtime inspection surfaces such as render-study mode

## Dependency Rules

Current intended direction:

- [`../src/index.js`](../src/index.js) should be the only browser bootstrap entry.
- `core/` may compose across domains. Treat it as the top of the dependency graph, not a place for low-level helpers to reach upward.
- `state/` and `entities/` should stay free of DOM, renderer, and audio concerns.
- `systems/` may depend on `state/`, `entities/`, `core/`, `audio/`, and narrow content helpers. They should not manipulate DOM nodes directly.
- `audio/` is a one-way observer. [`../src/audio/audioState.js`](../src/audio/audioState.js)
  projects a bounded scalar snapshot at the composition root; the audio engine
  cannot retain or mutate gameplay state.
  [`../src/audio/musicProfiles.js`](../src/audio/musicProfiles.js) owns frozen
  authored functional progressions, conventional phrase subdivisions,
  meter-aware percussion, and chord-indexed accompaniment paths, while
  [`../src/audio/musicSequencer.js`](../src/audio/musicSequencer.js) is a pure
  deterministic planner in integer musical steps. Only the audio engine owns
  Web Audio nodes, AudioParams, score lookahead, voice budgets, and lifecycle.
- The combat economy now lives mainly in `systems/collisionSystem.js`, `systems/combatSystem.js`, `systems/playerSystem.js`, and `core/combat.js`. Keep graze, burst, chain, and loop-two rules in those seams rather than spreading them into renderers.
- Desktop combat-space ownership now flows through `state.playfield` plus the stage director in `core/director.js`. Keep lane geometry and saturation budgeting centralized there; do not reintroduce per-stage viewport math or ad hoc enemy-count caps. The director's same-frame reservation model is part of that contract: gates are authoritative within a single stage-update pass, not advisory suggestions that later waves can ignore.
- `ui/` should depend on state shape and DOM only.
- `rendering/` should read state and entities. Transient visual-state mutation belongs in systems alongside other elapsed-time updates.
- `debug/` is an inspection surface. Keep it callable from the composition root, but avoid making gameplay systems depend on it.

These boundaries are enforced by `node scripts/check_structure.mjs`, which parses browser-native ECMAScript modules into a dependency graph and is also run by `python3 scripts/check_repo_legibility.py`. The checker validates static imports, re-exports, literal dynamic imports, and literal `new URL("./module.js", import.meta.url)` runtime-module edges with exact path resolution. The last form makes the AudioWorklet module a visible, reachable part of the graph even though the browser loads it outside ordinary ESM import evaluation. The checker reports graph reachability and cycles for visibility, but those observations are not policy failures unless this document defines them as invariants.

## Content Boundary

`src/data/` is executable content, not passive data files. The repo now uses registries for enemy archetypes, boss definitions, and ordered stage definitions. Pattern functions remain executable closures, but metadata and showcase/render keys should come from the registries rather than being duplicated across systems. See [`content/stages-bosses.md`](./content/stages-bosses.md) for the authoring contract.

## Known Hotspots

- `../src/data/stages/` (for example, [nebula.js](../src/data/stages/nebula.js)): per-stage gameplay definitions
- [`../src/data/enemies.js`](../src/data/enemies.js): enemy archetype registry
- `../src/data/bosses/` (for example, [seraph.js](../src/data/bosses/seraph.js)): per-boss phase definitions
- [`../src/data/weapons.js`](../src/data/weapons.js): raw weapon fire definitions, orbital offsets, and temporary weapon firing behavior
- [`../src/data/powerups.js`](../src/data/powerups.js): generic pickup catalog spanning weapon, utility, and risk rewards
- [`../src/core/powerups.js`](../src/core/powerups.js): active-effect timers, pickup notice state, and shared powerup rules
- [`../src/core/director.js`](../src/core/director.js): stage-density budgeting and wave gating for authored stage content
- [`../src/systems/collisionSystem.js`](../src/systems/collisionSystem.js) and `../src/systems/collision/` (for example, [playerHazards.js](../src/systems/collision/playerHazards.js)): ordered collision orchestration plus narrow passes for player hazards and burst resolution, enemy hits and kill rewards, boss hits, and pickup/shard collection
- [`../src/rendering/enemyRenderers.js`](../src/rendering/enemyRenderers.js): large visual dispatch surface
- [`../src/core/game.js`](../src/core/game.js): orchestration pressure point
- [`../src/core/runtimeController.js`](../src/core/runtimeController.js): lifecycle and teardown surface

When these areas grow, continue splitting by stage/boss family or renderer family instead of adding more conditional logic in place.

## Safe Extension Paths

- New stage: add a stage definition under `src/data/stages/`, register it in `src/data/stages.js`, point it at a boss key, reuse pattern helpers, and refresh the generated content inventory.
- New boss: add a boss definition under `src/data/bosses/`, register it in `src/data/bosses.js`, add a renderer entry in `src/rendering/bossRenderers.js`, and refresh the generated content inventory.
- New enemy family: add an archetype entry in `src/data/enemies.js`, add a renderer key in `src/rendering/enemyRenderers.js`, and reuse that archetype key from stage content.
- New runtime inspection feature: add it under `src/debug/` and document how to activate it in [`RUNTIME.md`](./RUNTIME.md).
