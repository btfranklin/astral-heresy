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

1. `updateStage`
2. `updatePlayer`
3. `updateCombat`
4. `updateBullets`
5. `updateEnemies`
6. `updateMovement`
7. `updatePickups`
8. `updateParticles`
9. `updateBoss`
10. `handleCollisions`
11. `cleanupBullets`
12. `flushEntities`
13. build render buckets
14. background render
15. canvas/entity render
16. DOM interface sync

If you change ordering, document why here. Collision timing, boss defeat timing, and entity cleanup behavior depend on this sequence.

## State Ownership

- [`../src/state/gameState.js`](../src/state/gameState.js): global run state, input flags, entity list, viewport metrics, scoring, boss/run lifecycle
- [`../src/state/playerState.js`](../src/state/playerState.js): player position, speed, fire cadence, invulnerability, hit points, burst state, weapon mode, and viewport-derived movement bounds
- [`../src/entities/entityFactory.js`](../src/entities/entityFactory.js): entity IDs, lifecycle, and deferred deletion
- [`../src/entities/components.js`](../src/entities/components.js): component payload shapes used by systems and renderers
- [`../src/entities/entityBuckets.js`](../src/entities/entityBuckets.js): frame-local typed views used by collision and rendering

The repo uses a lightweight ECS-style approach:

- State owns `entities`.
- Systems mutate state and entity components.
- Renderers read state and draw.
- The DOM UI mirrors state through [`../src/ui/interfaceController.js`](../src/ui/interfaceController.js).

## Source Areas

- `src/core/`: composition root and shared primitives
- `src/state/`: durable state shapes and reset helpers
- `src/entities/`: entity shell plus component constructors
- `src/systems/`: gameplay mutation logic
- `src/data/`: content factories and reusable bullet-pattern helpers
- `src/rendering/`: WebGL background plus 2D entity/HUD drawing
- `src/audio/`: Web Audio setup and sound recipes
- `src/ui/`: DOM synchronization for overlays and result screens
- `src/debug/`: explicit runtime inspection surfaces such as render-study mode

## Dependency Rules

Current intended direction:

- [`../src/index.js`](../src/index.js) should be the only browser bootstrap entry.
- `core/` may compose across domains. Treat it as the top of the dependency graph, not a place for low-level helpers to reach upward.
- `state/` and `entities/` should stay free of DOM, renderer, and audio concerns.
- `systems/` may depend on `state/`, `entities/`, `core/`, `audio/`, and narrow content helpers. They should not manipulate DOM nodes directly.
- The combat economy now lives mainly in `systems/collisionSystem.js`, `systems/combatSystem.js`, `systems/playerSystem.js`, and `core/combat.js`. Keep graze, burst, chain, and loop-two rules in those seams rather than spreading them into renderers.
- `ui/` should depend on state shape and DOM only.
- `rendering/` should read state and entities; it should not own gameplay mutation beyond transient visual fields already present in state.
- `debug/` is an inspection surface. Keep it callable from the composition root, but avoid making gameplay systems depend on it.

These boundaries are enforced by `python3 scripts/check_structure.py`, which is also run by `python3 scripts/check_repo_legibility.py`.

## Content Boundary

`src/data/` is executable content, not passive data files. The repo now uses registries for enemy archetypes, boss definitions, and ordered stage definitions. Pattern functions remain executable closures, but metadata and showcase/render keys should come from the registries rather than being duplicated across systems. See [`content/stages-bosses.md`](./content/stages-bosses.md) for the authoring contract.

## Known Hotspots

- [`../src/data/stages/`](../src/data/stages): per-stage gameplay definitions
- [`../src/data/enemies.js`](../src/data/enemies.js): enemy archetype registry
- [`../src/data/bosses/`](../src/data/bosses): per-boss phase definitions
- [`../src/data/weapons.js`](../src/data/weapons.js): weapon-mode definitions and pickup reward catalog
- [`../src/rendering/enemyRenderers.js`](../src/rendering/enemyRenderers.js): large visual dispatch surface
- [`../src/core/game.js`](../src/core/game.js): orchestration pressure point
- [`../src/core/runtimeController.js`](../src/core/runtimeController.js): lifecycle and teardown surface

When these areas grow, continue splitting by stage/boss family or renderer family instead of adding more conditional logic in place.

## Safe Extension Paths

- New stage: add a stage definition under `src/data/stages/`, register it in `src/data/stages.js`, point it at a boss key, reuse pattern helpers, and refresh the generated content inventory.
- New boss: add a boss definition under `src/data/bosses/`, register it in `src/data/bosses.js`, add a renderer entry in `src/rendering/bossRenderers.js`, and refresh the generated content inventory.
- New enemy family: add an archetype entry in `src/data/enemies.js`, add a renderer key in `src/rendering/enemyRenderers.js`, and reuse that archetype key from stage content.
- New runtime inspection feature: add it under `src/debug/` and document how to activate it in [`RUNTIME.md`](./RUNTIME.md).
