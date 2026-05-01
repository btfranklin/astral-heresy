# Quality Guide

This repo has a fast deterministic validation stack. Use this page as the verification map instead of rediscovering which lane covers which risk.

## Golden Invariants

- `src/core/game.js` is the composition root. New runtime wiring should flow through it, not around it.
- `docs/` is the durable system of record. If a new rule matters across runs, write it down here and link it from [`index.md`](./index.md).
- Desktop combat space is owned by `state.playfield` and the stage director. Authored stage and boss content should use playfield geometry instead of ad hoc viewport math.
- Stage density gating is authoritative within a frame. `gateWave()` decisions budget against live plus reserved capacity, so later waves in the same tick must not assume the original density snapshot still applies.
- Runtime inspection surfaces stay explicit and local: use `window.__astralHeresy`, render-study mode, and the fast Node harnesses instead of one-off debug branches.

## Validation Stack

- `node scripts/validate_fast.mjs`
  - Primary pre-commit gate.
  - Runs the full `node:test` suite, then runs repo-legibility checks for docs, links, generated inventory, and structural boundaries.
- `node scripts/run_fast_tests.mjs all`
  - Runs every deterministic browserless test under `tests/` with Node's built-in test runner.
  - Use this when you want behavioral confidence without the repo-artifact checks.
- `python3 scripts/check_repo_legibility.py`
  - Structural and documentation validation only.
  - Confirms required repo-routing artifacts exist, local markdown links resolve, generated inventory is fresh, and import boundaries still hold.

## Test Layers

- `tests/unit/`
  - Module-level deterministic coverage for helpers, state builders, registries, systems, audio, and rendering logic.
- `tests/contract/`
  - Content and registry invariants that must stay true across authored data changes.
- `tests/scenario/`
  - Small cross-system simulations that replace the old bespoke smoke scripts without turning into browser automation.

## Verification Matrix

Run the smallest lane that actually covers the change, then widen out if the edit crosses multiple concerns.

### Documentation And Structure

- `python3 scripts/check_repo_legibility.py`
  - Run after changing docs structure, generated references, or repository routing.
  - Validates local markdown links, generated inventory freshness, required validation artifacts, and structural boundaries.
- `python3 scripts/check_structure.py`
  - Run when moving code across `src/` areas or changing import direction.

### Content And Authoring

- `node scripts/run_fast_tests.mjs content`
  - Primary fast lane for content registries, stage contracts, boss contracts, and lane-safe authored patterns.
- `node scripts/check_content_contract.mjs`
  - Compatibility wrapper for the `content` fast-test group.
- `python3 scripts/generate_content_inventory.py`
  - Run after changing stages, bosses, phases, or showcase labels, then commit the refreshed generated reference.

### Combat Economy

- `node scripts/run_fast_tests.mjs combat`
  - Primary fast lane for graze, burst, chain, density gating, boss damage rules, loop transitions, and authored encounter fallback behavior.
  - Includes coverage that every authored one-shot stage beat honors the stage director's retry delay before spawning.
- `node scripts/check_combat_smoke.mjs`
  - Compatibility wrapper for the `combat` fast-test group.
- `node scripts/check_powerup_smoke.mjs`
  - Compatibility wrapper for the `powerups` fast-test group.
- `node scripts/run_fast_tests.mjs powerups`
  - Primary fast lane for pickup collection, score shards, active-effect timers, and powerup-specific combat behavior.

### Runtime And UI

- `node scripts/run_fast_tests.mjs runtime`
  - Primary fast lane for start flow, restart behavior, input wiring, blur/visibility handling, HUD sync, render-study mode, and browserless rendering contracts.
- `node scripts/check_runtime_smoke.mjs`
  - Compatibility wrapper for the `runtime` fast-test group.
- `node scripts/check_runtime_browser_smoke.mjs`
  - Optional real-browser pass for browser-visible changes that need screenshot-backed confirmation.

## Repair Expectations

- If a check fails because the contract changed intentionally, update the relevant doc and the checker in the same change set.
- If generated docs are stale, regenerate them immediately instead of explaining the drift in prose.
- If a runtime rule becomes subtle enough to need repeated explanation in review, promote it into a helper, a `node:test` assertion, or both.

## Fast Routing

- Architecture questions: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Runtime repros and manual smoke flow: [`RUNTIME.md`](./RUNTIME.md)
- Stage and boss authoring rules: [`content/stages-bosses.md`](./content/stages-bosses.md)
- Current known hotspots and cleanup priorities: [`TECH-DEBT.md`](./TECH-DEBT.md)
