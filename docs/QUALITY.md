# Quality Guide

This repo already has runnable checks for its most fragile boundaries. Use this page as the verification map instead of rediscovering which lane covers which risk.

## Golden Invariants

- `src/core/game.js` is the composition root. New runtime wiring should flow through it, not around it.
- `docs/` is the durable system of record. If a new rule matters across runs, write it down here and link it from [`index.md`](./index.md).
- Desktop combat space is owned by `state.playfield` and the stage director. Authored stage and boss content should use playfield geometry instead of ad hoc viewport math.
- Stage density gating is authoritative within a frame. `gateWave()` decisions budget against live plus reserved capacity, so later waves in the same tick must not assume the original density snapshot still applies.
- Runtime inspection surfaces stay explicit and local: use `window.__astralHeresy`, render-study mode, and the smoke harnesses instead of one-off debug branches.

## Verification Matrix

Run the smallest lane that actually covers the change, then widen out if the edit crosses multiple concerns.

### Documentation And Structure

- `python3 scripts/check_repo_legibility.py`
  - Run after changing docs structure, generated references, or repository routing.
  - Also validates local markdown links, generated inventory freshness, structural boundaries, and the core smoke lanes.
- `python3 scripts/check_structure.py`
  - Run when moving code across `src/` areas or changing import direction.

### Content And Authoring

- `node scripts/check_content_contract.mjs`
  - Run after changing stage registries, boss registries, phase structure, showcase wiring, or shared pattern helpers.
  - This is the main contract check for content instantiation and lane-safe authored boss patterns.
- `python3 scripts/generate_content_inventory.py`
  - Run after changing stages, bosses, phases, or showcase labels, then commit the refreshed generated reference.

### Combat Economy

- `node scripts/check_combat_smoke.mjs`
  - Run after changing graze, burst, chain, stage density gating, loop pacing, authored encounter fallback behavior, or boss-pattern combat expectations.
- `node scripts/check_powerup_smoke.mjs`
  - Run after changing pickups, score shards, active-effect timers, or pickup-specific combat behavior.

### Runtime And UI

- `node scripts/check_runtime_smoke.mjs`
  - Run after changing start flow, restart behavior, input wiring, blur/visibility handling, HUD sync, render-study activation, or text-state hooks.
- `node scripts/check_runtime_browser_smoke.mjs`
  - Run when a change is browser-visible and screenshots would catch regressions the Node harnesses cannot, especially layout, visual framing, or real-browser input/render behavior.

## Repair Expectations

- If a check fails because the contract changed intentionally, update the relevant doc and the checker in the same change set.
- If generated docs are stale, regenerate them immediately instead of explaining the drift in prose.
- If a runtime rule becomes subtle enough to need repeated explanation in review, promote it into a helper, a smoke assertion, or both.

## Fast Routing

- Architecture questions: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Runtime repros and manual smoke flow: [`RUNTIME.md`](./RUNTIME.md)
- Stage and boss authoring rules: [`content/stages-bosses.md`](./content/stages-bosses.md)
- Current known hotspots and cleanup priorities: [`TECH-DEBT.md`](./TECH-DEBT.md)
