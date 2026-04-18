# Stage And Boss Authoring

The files under `src/data/` are executable content factories. They do not just hold configuration constants.

## Primary Files

- [`../../src/data/stages.js`](../../src/data/stages.js): ordered stage registry
- [`../../src/data/enemies.js`](../../src/data/enemies.js): enemy archetype registry
- [`../../src/data/stages/`](../../src/data/stages): per-stage factories and enemy wave timing
- [`../../src/data/bosses.js`](../../src/data/bosses.js): boss export surface
- [`../../src/data/bosses/`](../../src/data/bosses): per-boss factories and phase logic
- [`../../src/data/patterns.js`](../../src/data/patterns.js): reusable bullet-pattern helpers
- [`../../src/debug/showcase.js`](../../src/debug/showcase.js): render-study keys for enemies and bosses

## Stage Factory Contract

`stageDefinitions` exports the ordered list of stage objects.

Each stage object currently provides:

- `key`
- `name`
- `duration`
- `bossKey`
- `init()`
- `update(stageState, t, dt, ctx)`

`ctx` is the narrow runtime content context passed from the composition root:

- `view`
- `player`
- `spawnEnemyBullet(x, y, angle, speed, opts)`
- `spawnEnemy(archetypeKey, overrides)`

Stage `update()` owns:

- enemy spawn timing
- enemy movement/fire closures
- transitions into the stage boss via `bossKey` once `t >= duration`

## Enemy Archetype Contract

Enemy visuals and default gameplay stats live in [`../../src/data/enemies.js`](../../src/data/enemies.js).

Each archetype currently provides:

- `key`
- `showcaseLabel`
- `renderKey`
- `r`, `hp`
- `color`, `accent`, `glowColor`

Stages call `spawnEnemy(archetypeKey, overrides)`, which is implemented by [`../../src/systems/enemySystem.js`](../../src/systems/enemySystem.js).

Useful override fields:

- `x`, `y`, `vx`, `vy`
- `wobble`
- `behavior(enemy, dt, state)`
- `fire(enemy, dt, state)`

The concrete entity/component shell is assembled by the enemy system and entity/component helpers. Stage code should define behavior, not entity bookkeeping.

## Boss Factory Contract

Boss definitions are exported from [`../../src/data/bosses.js`](../../src/data/bosses.js) and instantiated at runtime.

Each boss definition currently provides:

- `key`
- `name`
- `showcaseLabel`
- `renderKey`
- `spawnY`, `r`, `hp`
- `phases`

Runtime boss instances expose:

- `key`
- `name`
- `renderKey`
- `x`, `y`, `r`
- `hp`, `maxHp`
- `phaseIndex`, `phaseTime`, `phaseHp`
- `pulseCooldown`
- `cooldowns`
- `phases`

Each phase provides:

- `name`
- `hp`
- `pattern(boss, dt, ctx)`

Boss phase progression and defeat handling live in [`../../src/systems/bossSystem.js`](../../src/systems/bossSystem.js). Boss authoring should not duplicate that lifecycle logic.

## Pattern Helpers

[`../../src/data/patterns.js`](../../src/data/patterns.js) provides the shared helpers used by stages and bosses:

- `emitRadial`
- `emitAimedBurst`
- `emitSpiral`
- `runCooldown`
- `resetCooldowns`

Use these first before inventing one-off projectile loops in stage or boss code. If a pattern becomes reusable across more than one fight, promote it into `patterns.js`.

## Authoring Workflow

### Add A Stage

1. Add or extend a stage definition under `src/data/stages/` and register it in `src/data/stages.js`.
2. Reuse pattern helpers where possible.
3. Point the stage at a `bossKey`.
4. Refresh the generated inventory with `python3 scripts/generate_content_inventory.py`.
5. Run `node scripts/check_content_contract.mjs`.
6. Run `python3 scripts/check_repo_legibility.py`.

### Add A Boss

1. Add a boss definition under `src/data/bosses/` and register it in `src/data/bosses.js`.
2. Add a renderer in `src/rendering/bossRenderers.js` and reference it through `renderKey`.
3. Ensure the boss has a `showcaseLabel`; render-study keys are derived from the registries.
4. Refresh the generated inventory.
5. Run `node scripts/check_content_contract.mjs`.
6. Run the repo checks.

### Add An Enemy Family

1. Add an archetype entry in `src/data/enemies.js`.
2. Add an enemy renderer in `src/rendering/enemyRenderers.js` and reference it through `renderKey`.
3. Spawn it from a stage via `spawnEnemy(archetypeKey, overrides)`.
4. Refresh the generated inventory and run the checks.

## Current Design Constraint

Content should not import renderers directly. Enemy and boss content owns keys and executable pattern logic; rendering owns the renderer lookup maps keyed by `renderKey`. If you change that boundary, update [`../ARCHITECTURE.md`](../ARCHITECTURE.md) first.

## Generated Reference

See [`../generated/content-inventory.md`](../generated/content-inventory.md) for the current stage names, boss names, phases, showcase keys, and pattern helpers.

## Mechanical Enforcement

`node scripts/check_content_contract.mjs` instantiates the registries with a fake runtime context and validates stage ordering, boss instantiation, renderer-key coverage, and showcase coverage directly. If you intentionally change the contract, update this document and the checker together.
