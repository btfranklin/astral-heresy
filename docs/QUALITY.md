# Quality Guide

This repo has a fast deterministic validation stack. Use this page as the verification map instead of rediscovering which lane covers which risk.

## Golden Invariants

- `src/core/game.js` is the composition root. New runtime wiring should flow through it, not around it.
- `docs/` is the durable system of record. If a new rule matters across runs, write it down here and link it from [`index.md`](./index.md).
- Desktop combat space is owned by `state.playfield` and the stage director. Authored stage and boss content should use playfield geometry instead of ad hoc viewport math.
- Stage density gating is authoritative within a frame. `gateWave()` decisions budget against live plus reserved capacity, so later waves in the same tick must not assume the original density snapshot still applies.
- Runtime inspection surfaces stay explicit and local: use `window.__astralHeresy`, render-study mode, the deterministic Node harnesses, and the Chromium contract suite instead of one-off debug branches.
- Audio observes a projected scalar world and never mutates gameplay. Native
  Web Audio is the complete baseline; the memory worklet is a graceful
  enhancement.

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
- `node scripts/check_runtime_browser_smoke.mjs`
  - Real Chromium contract suite for browser-owned behavior.
  - One-time setup: `npm install` followed by `npx playwright install chromium`.
  - Starts an isolated local server, uses native Playwright input, checks Canvas/WebGL/Web Audio behavior, exercises visibility and resize lifecycle, verifies teardown, and fails on unexpected browser errors.
- `npm run test:performance`
  - Opt-in Chromium rendering-performance telemetry at DPR 1 and 2.
  - Records fixed-scene animation-frame, CDP, Canvas, DOM, allocation, and optional GPU timing measurements without imposing a numeric budget or joining the default gate.

## Test Layers

- `tests/unit/`
  - Module-level deterministic coverage for helpers, state builders, registries, systems, audio, and rendering logic.
- `tests/contract/`
  - Content and registry invariants that must stay true across authored data changes.
- `tests/scenario/`
  - Small cross-system simulations that replace the old bespoke smoke scripts without turning into browser automation.
- `tests/browser/`
  - Real Chromium coverage for native modules, DOM events and selectors,
    layout, Canvas/WebGL, realtime Web Audio, AudioWorklet, fixed-seed offline
    rendering, animation frames, and browser resource cleanup.
- `tests/performance/`
  - Serial, fixed-scene browser measurements kept separate from correctness assertions and the default validation gate.

Narrow recorders and collaborator spies are valid for orchestration and projection assertions. They are not substitutes for browser event, selector, rendering, audio, layout, or scheduling semantics.

## Verification Matrix

Run the smallest lane that actually covers the change, then widen out if the edit crosses multiple concerns.

### Documentation And Structure

- `python3 scripts/check_repo_legibility.py`
  - Run after changing docs structure, generated references, or repository routing.
  - Validates local markdown links, generated inventory freshness, required validation artifacts, and structural boundaries.
- `node scripts/check_structure.mjs`
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
  - Primary fast lane for lifecycle orchestration, reset and resize math, input-handler state changes, HUD projection, render command intent, audio recipes, and render-study state.
  - These tests deliberately do not claim browser compatibility.
- `node scripts/check_runtime_smoke.mjs`
  - Compatibility wrapper for the `runtime` fast-test group.
- `node scripts/check_runtime_browser_smoke.mjs`
  - Required for changes to startup, DOM/input lifecycle, visibility, viewport geometry, Canvas/WebGL, Web Audio, animation scheduling, or teardown.
  - Captures current-run screenshots for startup and representative render-study scenes while using pixel and browser-error assertions as the automated rendering gate.
- Installed Safari manual smoke
  - Required after changing the native-module graph, local serving path, or startup flow, and when repairing a Safari-reported regression.
  - Launch with `./scripts/play.sh`, click `Launch Sortie`, confirm active gameplay begins, and check Safari's JavaScript console for startup errors.
  - Playwright's Chromium lane remains useful evidence, but it does not substitute for this Safari check.

### Procedural Audio

- `node scripts/run_fast_tests.mjs runtime`
  - Validates acoustic and musical profiles, deterministic harmony/percussion
    planning, distinct functional popular-minor processions, conventional
    bar/half-bar harmonic rhythm, urgent boss rhythms, restrained triad and
    dominant-seventh voicings, chord-aligned sustained accompaniment,
    frame-partition-independent scheduling, quantized state projection,
    delay/frequency/feedback bounds, pan clamping, semantic and score voice
    budgets, body/score crossfade cleanup, ending idempotence, immediate reset,
    disposal, and worklet success/load-failure/processor-error fallback.
- `node scripts/check_structure.mjs`
  - Validates the literal AudioWorklet URL as an exact, reachable runtime-module
    edge.
- `node scripts/check_runtime_browser_smoke.mjs`
  - Confirms a single post-gesture context, `enhanced` worklet status, bounded
    live graph counts, an advancing Canticle transport, audible chord changes
    and distinct rendered signatures for all six encounters,
    main-thread-stall recovery without a rhythmic backlog, gameplay-routed
    lethal death, an audible tail after the results overlay, and cancellation
    by immediate restart.
  - Fixed-seed `OfflineAudioContext` scenarios assert finite samples, low DC,
    peak below `0.98`, audible decaying death/victory tails, mono-safe death
    impact, and measurably distinct stage profiles.
- Installed Safari listening acceptance
  - Required for sound-design changes. Follow the complete matrix in
    [`RUNTIME.md`](./RUNTIME.md), covering all worlds and nine phases, dense cue
    readability, worklet status, death/restart, victory, laptop speakers,
    headphones, clicks, and feedback stability.
  - Compare the six encounter processions as a set: their harmonic rhythm,
    chord color, tempo, and percussion must remain recognizable without
    relying on a lead melody.

### Rendering Performance

- `npm run test:performance`
  - Runs headless Chromium serially at a 1280×720 viewport with DPR 1 and 2 projects.
  - Samples idle, six stationary `halo` enemies with 42 stationary bullets, and the phase-3 Seraph showcase after 60 warmup callbacks.
  - Attaches versioned JSON containing 180 callback-duration and callback-interval samples, CDP task/script duration deltas, backing-store and renderer metadata, and optional GPU timer-query measurements.
  - Runs Canvas command, DOM mutation, and offscreen-allocation counters on a separate untimed page so instrumentation does not distort the timed sample.
  - Fails only for invalid or missing samples, invalid scene construction, or browser errors. It deliberately has no numeric budget, checked-in baseline, golden artifact, new dependency, or place in the default validation gate.

## Repair Expectations

- If a check fails because the contract changed intentionally, update the relevant doc and the checker in the same change set.
- If generated docs are stale, regenerate them immediately instead of explaining the drift in prose.
- If a runtime rule becomes subtle enough to need repeated explanation in review, promote it into a helper, a `node:test` assertion, or both.

## Fast Routing

- Architecture questions: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Sound-design philosophy and audio grammar: [`SOUND_DESIGN.md`](./SOUND_DESIGN.md)
- Runtime repros and manual smoke flow: [`RUNTIME.md`](./RUNTIME.md)
- Stage and boss authoring rules: [`content/stages-bosses.md`](./content/stages-bosses.md)
