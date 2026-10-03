# Stage And Boss Authoring

The files under `src/data/` are executable content factories. They do not just hold configuration constants.

## Primary Files

- [`../../src/data/stages.js`](../../src/data/stages.js): ordered stage registry
- [`../../src/data/enemies.js`](../../src/data/enemies.js): enemy archetype registry
- [`../../src/data/stages/`](../../src/data/stages): per-stage factories and enemy wave timing
- [`../../src/data/stageRuntime.js`](../../src/data/stageRuntime.js): shared stage-wave gating helpers
- [`../../src/data/bosses.js`](../../src/data/bosses.js): boss export surface
- [`../../src/data/bosses/`](../../src/data/bosses): per-boss factories and phase logic
- [`../../src/data/powerups.js`](../../src/data/powerups.js): generic pickup catalog and category metadata
- [`../../src/core/powerups.js`](../../src/core/powerups.js): shared powerup timing/effect rules
- [`../../src/data/patterns.js`](../../src/data/patterns.js): reusable bullet-pattern helpers
- [`../../src/debug/showcase.js`](../../src/debug/showcase.js): render-study keys for enemies and bosses

## Stage Factory Contract

`stageDefinitions` exports the ordered list of stage objects.

Each stage object currently provides:

- `key`
- `name`
- `duration`
- `bossKey`
- optional `densityTiers`
- `init()`
- `update(stageState, t, dt, ctx)`

`ctx` is the narrow runtime content context passed from the composition root:

- `view`
- `player`
- `loopIndex`
- `random()`
- `rand(min, max)`
- `playfield`
- `director`
- `spawnEnemyBullet(x, y, angle, speed, opts)`
- `spawnEnemy(archetypeKey, overrides)`
- `spawnPickup(kind, x, y, overrides)`

Stage `update()` owns:

- enemy spawn timing
- enemy movement/fire closures

Use `ctx.random()` and `ctx.rand(min, max)` for gameplay random values. The
runtime reads the generator owned by game state, including after a restart.
`playfield.randomX(padding)` uses the same sequence. Direct calls to
`Math.random()` in authored content would bypass seeded runs.

The runtime stage system owns the transition into `bossKey` once the accumulated
stage time reaches `duration`; authored `update()` functions only produce the
stage's timed content.

`playfield` is the stage-safe geometry surface for authored content:

- `leftEdge`
- `rightEdge`
- `laneX(fraction)`
- `randomX(padding)`
- `clampX(x, padding)`

Use it instead of raw `view.width * 0.2..0.8` math so authored content follows the current open desktop combat envelope and enemy entries start just outside the safe playfield edge.

`director.gateWave({ enemyCost, bulletCost, priority })` is the shared soft-density gate for stage waves. It returns:

- `allow`
- `delay`
- `bulletScale`
- `escortScale`
- `anchorOnly`

The runtime refreshes live density and resets the director's same-frame reservations once per gameplay frame before stage content runs. Each approved gate reserves against the current frame immediately, so later gates in the same `stage.update()` call budget against `live + reserved`, not only the already-live entity counts.

- `priority="normal"` waves should defer entirely when `allow === false`.
- `priority="elite"` and `priority="setpiece"` should treat `allow === false && anchorOnly === true` as an anchor-only fallback: spawn exactly one authored anchor, skip escorts or secondary anchors, and still honor `bulletScale`.
- `allow === false && anchorOnly === false` means defer the encounter and retry after `delay`.
- Prefer reducing escorts first, then thinning bullet counts. Do not delete active bullets mid-flight.

`densityTiers`, when present, is an ordered array of `{ until, maxEnemies, maxEnemyBullets }` entries used by the runtime stage director. Loop two automatically adds the shared bonus on top of these budgets.

Shared helpers in [`../../src/data/stageRuntime.js`](../../src/data/stageRuntime.js) keep these semantics consistent:

- `gateRecurringWave(stageState, key, t, ctx, options)` retries recurring beats after `delay` when the gate defers them.
- `resolveOneShotWave(stageState, key, t, ctx, options)` collapses one-shot authored encounters into `full` or `anchor` spawn modes. When the gate defers the encounter, it stores `t + delay` on `stageState[key]` and returns `null`, so callers must not mark the encounter done until a wave object is returned.
- `runOneShotEncounter(stageState, t, ctx, config, spawnEncounter)` is the preferred wrapper for authored one-shot elite and setpiece beats. It centralizes start time, retry key, done flag, density gate, anchor mode, and escort gating while leaving the actual enemy/fire closures explicit in the stage file.

## Enemy Archetype Contract

Enemy visuals and default gameplay stats live in [`../../src/data/enemies.js`](../../src/data/enemies.js).

Each archetype currently provides:

- `key`
- `showcaseLabel`
- `renderKey`
- `r`, `hp`
- `color`, `accent`, `glowColor`

Stages call `spawnEnemy(archetypeKey, overrides, spawnOptions?)`, which is implemented by [`../../src/systems/enemySystem.js`](../../src/systems/enemySystem.js).

Useful override fields:

- `x`, `y`, `vx`, `vy`
- `wobble`
- `behavior(enemy, dt, state)`
- `fire(enemy, dt, state)`
- `elite`
- `risk`
- `dropKey`
- `scoreBonus`
- `scoreShardCount`
- `label`

`spawnOptions.laneAware` defaults to `true` in normal runtime content. Only debug/showcase paths should disable it.

Weapon pickups should stay attached to elite encounters through `dropKey`. Utility and risk pickups can also be attached to non-elite setpiece anchors or exposed danger beats, but they should remain authored and non-random. `dropKey` values now come from [`../../src/data/powerups.js`](../../src/data/powerups.js), not only `src/data/weapons.js`.

Balance tuning currently lives in authored content and smoke expectations, not in a formal tuning spec. If tuning rules become unstable across stages, add a dedicated design note under `docs/content/` before spreading balance policy through stage files.

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
- optional `weakpoint`
- `pattern(boss, dt, ctx)`

Definition-level `hp` must equal the sum of all phase `hp` values. Each phase is
a damage barrier: a hit can consume only the current `phaseHp`, and overkill is
discarded instead of skipping health in a later phase.

Boss pattern `ctx` includes the runtime geometry surface used by stage content:

- `view`
- `player`
- `loopIndex`
- `playfield`
- `spawnEnemyBullet(x, y, angle, speed, opts)`

`weakpoint`, when present, currently supports:

- `radius`
- `interval`
- `duration`
- `offset`
- `damageMultiplier`
- `bonusScore`
- optional `rotationSpeed`
- optional `timeOffset`
- optional `color`

Boss phase progression and defeat handling live in [`../../src/systems/bossSystem.js`](../../src/systems/bossSystem.js). Boss authoring should not duplicate that lifecycle logic.

When a boss attack is authored as desktop lanes, use `ctx.playfield.laneX(...)` instead of raw viewport-width spacing. Raw `ctx.view.width` math is only a fallback for contexts that truly do not provide playfield geometry.

## Pattern Helpers

[`../../src/data/patterns.js`](../../src/data/patterns.js) provides the shared helpers used by stages and bosses:

- `emitRadial`
- `emitAimedBurst`
- `emitSpiral`
- `runCooldown`
- `resetCooldowns`

Use these first before inventing one-off projectile loops in stage or boss code. If a pattern becomes reusable across more than one fight, promote it into `patterns.js`.

For player-facing pickup rewards, use the generic powerup definitions in [`../../src/data/powerups.js`](../../src/data/powerups.js). Weapon-fire behavior still lives in [`../../src/data/weapons.js`](../../src/data/weapons.js), but stages should not duplicate pickup duration, category, or labeling rules in content files.

Timed-effect HUD metadata is registry-owned as well. Weapon and active-powerup
definitions provide their `duration`, `pickupColor`, and `hudSides`; both the
DOM effect strip and player-local canvas sigils project from those definitions
instead of maintaining renderer-local copies.

## Authoring Workflow

### Add A Stage

1. Add or extend a stage definition under `src/data/stages/` and register it in `src/data/stages.js`.
2. Reuse pattern helpers where possible.
3. Point the stage at a `bossKey`.
4. Refresh the generated inventory with `python3 scripts/generate_content_inventory.py`.
5. Run `node scripts/check_content_contract.mjs`.
6. Run `node scripts/check_combat_smoke.mjs` if the stage changes graze, burst, chain, weakpoint, or loop-two rules.
7. Run `node scripts/check_powerup_smoke.mjs` if the stage changes pickup rewards, score shards, or active-effect timing.
8. Run `python3 scripts/check_repo_legibility.py`.

### Add A Boss

1. Add a boss definition under `src/data/bosses/` and register it in `src/data/bosses.js`.
2. Add a renderer in `src/rendering/bossRenderers.js` and reference it through `renderKey`.
3. Ensure the boss has a `showcaseLabel`; render-study keys are derived from the registries.
4. Refresh the generated inventory.
5. Run `node scripts/check_content_contract.mjs`.
6. Run `node scripts/check_combat_smoke.mjs` if weakpoints or bonus-score behavior change.
7. Run the repo checks.

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

`node scripts/check_content_contract.mjs` instantiates the registries with a fake runtime context and validates stage ordering, boss instantiation, renderer-key coverage, showcase coverage, and lane-authored boss attacks against the desktop bullet envelope directly. If you intentionally change the contract, update this document and the checker together.
