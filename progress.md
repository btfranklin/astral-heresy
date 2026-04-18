Original prompt: PLEASE IMPLEMENT THIS PLAN:
# Fun Pass Implementation Plan With Roadmap Burn-Down
#
## Summary
- Deliver roadmap items 1-12 in four milestones without rewriting the core loop; keep new behavior inside the existing state, system, content, rendering, and audio seams.
- Treat milestones 1-2 as the next shippable pass, then layer authored stage/elites/weapons work, then ship replay/audio tuning.
- Make `ROADMAP.md` a live backlog, not a historical log: every implemented item is removed from the priority table in the same change set that ships it.
#
## Key Changes
- Add a combat economy to state: `grazeCharge` (0-100), `burstStocks` (start 1, max 2), `chainLevel`, `chainTimer`, `loopIndex`, score-bonus bookkeeping, and short-lived visual feedback flags. Extend `playerState` with `weaponMode`, `weaponTimer`, `pendingBurst`, and `burstCooldown`.
- Add explicit `attack`, `pickup`, and elite/reward metadata components instead of hiding new mechanics in render data. `playerBullet` gains `damage`, `pierce`, and `weaponMode`; enemy bullets gain one-shot graze bookkeeping; entity buckets grow a `pickups` bucket.
- Keep stage and boss function signatures unchanged, but extend the runtime content context with `loopIndex`, `spawnPickup`, and any score/burst helpers authored content needs. Boss phases gain an optional `weakpoint` config with `radius`, `interval`, `duration`, `offset`, `damageMultiplier`, and `bonusScore`.
- Resolve graze, pickup collection, burst clear, weakpoint hits, kill-chain updates, close-range bonuses, and safe-score awards in `handleCollisions` so the current frame order stays intact. Burst fires on `KeyX`, spends one stock, clears enemy bullets within about 180px, chips nearby enemies/boss, and grants about 0.75s invulnerability.
- Refactor player firing into weapon definitions in a dedicated module. Ship three temporary pickup modes, all timed and scripted rather than random: `spread` (10s fan clear), `pierce` (10s focused bolts with pierce), and `beam` (8s high-rate narrow pulse stream rendered like a beam, not a separate hitscan system).
- Expand feedback surfaces: graze ring and burst stock in the HUD, chain meter in telemetry, weakpoint marker on boss render, stronger phase-break flash/shake/audio, new pickup/burst/graze/weakpoint/chain SFX, and procedural WebAudio music layers with stage, boss, and danger crossfades.
#
## Implementation Milestones
- Milestone 1: land `attack`/pickup plumbing, graze detection, graze HUD meter, burst stocks, `X` input, burst VFX/SFX, chain timer/multiplier, and close-range kill bonuses. Seed tuning: graze ring = player radius + 6..18, each unique graze = +5 charge and +20 score, chain timer = 2.25s, chain cap = 12, multiplier = `1 + 0.15 * chainLevel`.
- Milestone 2: give each boss one authored weakpoint window and phase-break bonus. Seraph phase 2 exposes a rotating halo core, Prism phase 2 exposes the central refraction eye during shard alignment, and Cathedral phase 3 exposes the maw eye after lane volleys; weakpoint hits do 3x damage, and body hits remain possible but materially worse during the window.
- Milestone 3: author one setpiece and one elite reward encounter per stage using existing enemy families. Nebula gets a halo corridor squeeze plus a halo-led elite that drops `spread`; Crystal gets a refraction lattice plus a weaver/shard elite that drops `pierce`; Abyss gets a penitent gauntlet plus a throne/fang elite that drops `beam`. Pair enemies deliberately in every stage wave: suppressor + flanker in stage 1, suppressor + screen filler in stage 2, denial anchor + diver in stage 3.
- Milestone 4: add adaptive loop-two content and dynamic music. After the first full clear, immediately restart at stage 1 with `loopIndex = 1`, full heal, and one burst stock; shorten core spawn intervals by roughly 10-15%, inject extra synergy waves, and add one extra boss rule per fight. Only after loop two does the normal victory screen appear.
- Milestone 4 tuning pass: layer safe-score incentives on top of the new economy instead of inventing a separate mode. Award larger bonuses for kills inside about 140px / 90px bands, for maintaining graze activity during chain uptime, and for fast boss phase breaks; keep burst recharge graze-driven so survival and score are no longer the same optimization.
#
## Roadmap Maintenance
- Update `ROADMAP.md` in every feature-shipping change set that closes roadmap work; do not defer backlog cleanup to a later docs-only pass.
- Remove fully implemented items from the `Priority Backlog` table instead of leaving them checked off or duplicating them in a shipped section.
- If a milestone only partially covers a roadmap item, rewrite that row to the remaining player-facing gap with a narrower prototype description instead of deleting it.
- Renumber priorities after each removal so the table stays contiguous and still ordered by remaining impact vs cost.
- Refresh the `Notes` section whenever removals make its priority guidance stale, especially any statements like “items 1 through 4 are the best candidates.”
- Keep README, `AGENTS.md`, and `docs/index.md` linking to `ROADMAP.md` as the live backlog only; do not turn the roadmap into a changelog.
#
## Public Interfaces And Docs
- Update the HUD markup/styling to show graze, burst, chain, weapon, and loop status without replacing the current layout.
- Update `docs/content/stages-bosses.md` for weakpoint config, elite reward conventions, and loop-aware stage authoring; update `docs/RUNTIME.md` with `X` burst control, pickup behavior, and manual repro paths; update `docs/ARCHITECTURE.md` only for the new combat/audio hooks and any added content-context fields.
- Update `ROADMAP.md` as part of each milestone landing to remove or narrow shipped items and keep the remaining backlog accurate.
#
## Test Plan
- Add a new Node smoke script for combat features that directly exercises graze awarding, one-graze-per-bullet behavior, burst clear radius, pickup collection/expiry, chain decay, weakpoint damage math, and loop-two transition.
- Extend `scripts/check_content_contract.mjs` to validate optional boss weakpoint configs, elite reward references, and any new shared encounter/pattern helper exports.
- Extend `scripts/check_runtime_smoke.mjs` to cover the new HUD fields, `KeyX` wiring, and loop label/reset behavior.
- Extend `scripts/check_runtime_browser_smoke.mjs` to capture one normal combat scene, one burst usage, one pickup-active HUD state, and a loop-two scene in addition to the existing launch/restart/showcase checks.
- Manual acceptance: every stage has one memorable beat and one elite reward; graze/burst meaningfully save runs; weakpoints create visible damage windows; weapon pickups change firing feel immediately; boss/stage/danger music shifts are audible; loop two is recognizably denser without becoming unreadable; shipped roadmap items are removed from the backlog immediately.
#
## Assumptions
- The work stays within the current small-repo architecture and does not add a build step, local storage, permanent unlock tree, or external audio assets.
- Pickups are guaranteed scripted rewards from elites and selected phase/setpiece beats, not RNG drops.
- The `beam` weapon is implemented as a beam-like pulse stream so it fits the existing projectile/collision model.
- `ROADMAP.md` is a forward-looking backlog only; shipped work is tracked by git history and PRs, not by retaining completed rows in the roadmap.
- If scope has to compress, the minimum cut is milestones 1-2 plus the stage 2 elite, and the roadmap must still be burned down to reflect exactly what shipped.

2026-04-17
- Started implementing the fun pass. Baseline checks were green: content contract, runtime smoke, browser runtime smoke, and repo legibility.
- First work chunk is focused on systemic plumbing: deterministic hooks, combat state, attacks, pickups, burst handling, chain logic, and loop tracking.
- Added the full combat economy and content pass: graze meter, burst stocks, kill-chain bonuses, pickup-driven weapon modes, boss weakpoints, elite/setpiece encounters in all three stages, loop-two density changes, and procedural music layers.
- Added/extended verification: `check_combat_smoke.mjs`, stronger content contract validation, stronger runtime smoke coverage, stronger browser smoke coverage, and a skill-client Playwright pass with screenshot inspection under `output/web-game/fun-pass/`.
- Fixed a HUD layout regression caught by the skill-client screenshots by converting the telemetry panel to a readable wrapped grid.
- Final verification is green: content contract, combat smoke, runtime smoke, browser runtime smoke, repo legibility, and the web-game skill Playwright client pass all succeeded.
- No known open TODOs remain from this implementation pass. Future roadmap ideas should be added back to `ROADMAP.md` only as new backlog items, not as shipped-history notes.
- Follow-up HUD pass: moved the desktop HUD into left/right rails, updated player bounds to reserve those gutters as non-playable space, and revised the start-screen focus copy to describe concentrated fire instead of dodge precision.
- Follow-up verification is green: `node scripts/check_runtime_smoke.mjs`, `node scripts/check_combat_smoke.mjs`, `node scripts/check_runtime_browser_smoke.mjs`, and `python3 scripts/check_repo_legibility.py` all passed, and a `develop-web-game` Playwright client capture confirmed the ship stays inside the center lane instead of slipping behind the side HUD.
