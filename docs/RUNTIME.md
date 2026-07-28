# Runtime

This repo is easiest to understand by running it. Gameplay flow, render detail, start/end overlays, and render-study mode are all runtime-visible concerns.

## Local Run Commands

Standard helper:

```bash
./scripts/play.sh
```

Manual server without auto-opening a browser:

```bash
python3 scripts/serve_local.py 7666 --directory .
```

Then visit `http://127.0.0.1:7666/`.

`./scripts/play.sh` chooses a fresh local port for each run so Safari cannot reuse native modules from an older source revision. You can pin it when needed with `PORT=8686 ./scripts/play.sh`.
The local server sends `Cache-Control: no-store` and ignores stale conditional validators. Together, the fresh origin and no-store responses prevent Safari from combining native-module files from different source revisions.

## Start Flow

- Load the page.
- The start dialog is visible by default.
- Press `Enter` or click `Launch Sortie` to begin.
- Audio initialization happens on start, not on page load.

## Controls

- Move: pointer first, or `WASD` / arrow keys
- Fire: `Z`, `Space`, or pointer hold
- Focus: `Shift`
- Burst: `X`
- Restart after loss: `Enter` or `R`
- Toggle pointer steering for testing: `M`

Held movement/fire input is cleared on `window.blur` and when the document becomes hidden. Alt-tabbing or switching tabs should never leave the ship drifting or auto-firing when focus returns.

## Debug And Inspection Surfaces

### Global Handle

[`../src/index.js`](../src/index.js) exposes the created game as `window.__astralHeresy`.

Useful console reads:

```js
window.__astralHeresy.state
window.__astralHeresy.player
window.__astralHeresy.resetGame(true)
window.__astralHeresy.debugSpawnEnemy("cherub", { x: 0, y: 180, vx: 0, vy: 0 })
window.__astralHeresy.debugSpawnPickup("halo-shield", window.__astralHeresy.player.x, window.__astralHeresy.player.y)
window.__astralHeresy.debugSpawnScoreShards(window.__astralHeresy.player.x + 120, window.__astralHeresy.player.y, 4)
window.render_game_to_text()
window.advanceTime(1000)
```

Useful fields:

- `state.boss`
- `state.stageIndex`
- `state.stageTime`
- `state.loopIndex`
- `state.grazeCharge`
- `state.burstStocks`
- `state.playfield`
- `state.density`
- `state.powerupNotice`
- `state.over`
- `state.victory`
- `state.renderDetail`
- `state.showcase`

### Render-Study Mode

[`../src/debug/showcase.js`](../src/debug/showcase.js) provides a URL-driven inspection surface.

Enemy study examples:

- `/?mode=render&enemy=cherub`
- `/?mode=render&enemy=weaver`
- `/?mode=render&enemy=fang`

Boss study examples:

- `/?mode=render&boss=seraph&phase=1`
- `/?mode=render&boss=prism&phase=2`
- `/?mode=render&boss=cathedral&phase=3`

Render-study mode:

- skips the normal start flow
- sets `state.showcase`
- spawns a fixed showcase enemy or boss
- is the fastest way to inspect silhouettes and boss phase labeling

See [`generated/content-inventory.md`](./generated/content-inventory.md) for the current valid showcase keys.

## Smoke Test Path

Run this after gameplay, UI, or content edits:

1. Start the local server.
2. Load `/` and confirm the start dialog is visible.
3. Launch a run and confirm the active HUD collapses to compact score, stage, runtime, hull, graze, burst, and weapon instruments.
4. Fire, focus, burst with `X`, and toggle pointer steering with `M`.
5. Confirm the desktop playfield uses most of the viewport while preserving safe edge margins.
6. Confirm graze, burst stock, weapon, chain, and loop cues update without layout breakage.
7. Collect at least one pickup and confirm the in-world acquisition callout appears immediately.
8. Confirm timed weapon and utility/risk effects appear as player-local canvas sigils.
9. Hold movement or fire, blur the window or hide the tab, then return and confirm the ship is idle until new input is pressed.
10. Force-spawn or wait for an enemy near the playfield boundary and confirm it stays inside the playable envelope.
11. Confirm restart behavior after a loss with `Enter` or `R`.
12. Visit at least one enemy render-study URL and one boss render-study URL.
13. Confirm the page still initializes on a browser with WebGL enabled.

For deterministic runtime orchestration and game-state coverage, run:

```bash
node scripts/run_fast_tests.mjs runtime
```

The legacy runtime wrapper is still available:

```bash
node scripts/check_runtime_smoke.mjs
```

For combat-economy-specific verification without a browser, run:

```bash
node scripts/run_fast_tests.mjs combat
```

For dedicated powerup verification without a browser, run:

```bash
node scripts/run_fast_tests.mjs powerups
```

The deterministic runtime lane validates:

- lifecycle collaborator wiring for init, start, reset, resize, and disposal
- resize and playfield calculations across viewport modes
- fresh-run reset behavior and final-runtime projection
- input handler state transitions and reset orchestration
- HUD projection and explicit Canvas draw-command intent
- audio recipe selection without replacing the Web Audio platform
- render-study URL parsing and scene setup
- idempotent Web Audio and WebGL resource-release logic against narrow recorders

It does not implement a fake DOM, Canvas, WebGL, AudioContext, window, or animation-frame scheduler. Browser-owned behavior belongs to the Chromium lane.

The dedicated powerup lane validates:

- acquisition notice and in-world callout timing
- `Burst Cell`, `Halo Shield`, `Chain Sigil`, `Graze Bloom`, `Magnet Core`
- `Orbitals`, `Weakpoint Amplifier`, and `Point-Blank Seal`
- score-shard routing and weakpoint-brand damage behavior

Install the development tools and Playwright's Chromium build once, then run the
Chromium contract suite:

```bash
npm install
npx playwright install chromium
node scripts/check_runtime_browser_smoke.mjs
```

That lane validates:

- page boot, browser-native module loading, selectors, overlays, and HUD startup
- native keyboard and pointer events, trusted-event/default-prevention behavior, visibility-driven input reset, and restart
- live viewport resize, DPR-scaled Canvas backing sizes, layout rectangles, and coordinate clamping
- real Canvas 2D pixels, WebGL context/shader/draw validity, and representative enemy/boss render-study surfaces
- Web Audio creation only after a real user gesture and context closure during teardown
- native animation-frame progression and cancellation
- idempotent cleanup followed by real input and resize events
- absence of unexpected page exceptions, console errors, failed requests, bad local responses, and dialogs
- current-run screenshots under `output/playwright/`, with traces retained there
  when a test fails

## Rendering Performance Telemetry

Run the opt-in performance lane separately from the correctness suites:

```bash
npm run test:performance
```

The lane uses serial headless Chromium projects at a fixed 1280×720 viewport
with DPR 1 and 2. It measures three controlled surfaces:

- the idle start screen at `/`
- six stationary `halo` enemies with 42 stationary bullets, constructed from
  `/?mode=render&enemy=halo` through the public debug-spawn helpers
- the phase-3 Seraph scene at `/?mode=render&boss=seraph&phase=3`

The exact fixed coordinates, bullet attributes, warm-up, and sampling sequence
live in [`../tests/performance/render-performance.spec.mjs`](../tests/performance/render-performance.spec.mjs);
use that file rather than an ad hoc play session when reproducing a report.

Each timed run warms up for 60 animation-frame callbacks, records the next 180,
and reports callback duration and interval percentiles plus CDP
`TaskDuration`/`ScriptDuration` deltas. It also records canvas backing sizes,
browser and renderer identity, and GPU timer-query data when the active renderer
supports `EXT_disjoint_timer_query`; otherwise the JSON records the reason.

Canvas command counts, DOM mutation counts, and offscreen-canvas allocations are
collected on a separate untimed page. The line reporter prints a compact JSON
summary, and the full raw sample is attached as `render-performance.json` under
the ignored `output/playwright/performance/` tree.

This is an evidence lane, not a pass/fail speed budget. It fails only when the
scene, browser, or measurement itself is invalid. Compare runs only when their
viewport, DPR, user agent, renderer, and backing-store metadata are compatible.
Callback duration covers JavaScript executed inside the RAF callback; callback
interval also reflects delivery and rendering pressure between callbacks. CDP
task/script values are cumulative deltas over the 180-sample window. Canvas,
DOM, and allocation counts come from the warmed untimed pass and must not be
combined arithmetically with the timing sample. Zero warmed offscreen
allocations indicates cache reuse. An unsupported GPU timer is expected on some
headless renderers and is recorded as metadata rather than treated as a failure.

## Constraints Worth Remembering

- WebGL is required for the animated background. Failure is surfaced through an alert in the composition root.
- The repo has no build step. Browser-native ES modules are the execution model.
- Randomness is not seeded. If determinism matters, document the intended RNG boundary before changing it.
- Browser-visible runtime changes must pass the Chromium contract lane; screenshots remain useful for readability judgments beyond its pixel assertions.
- Rendering-performance telemetry is opt-in and informational; do not interpret a green run as proof that a numeric frame budget was met.
- `window.__astralHeresy.dispose()` cancels animation frames, detaches listeners, releases WebGL resources, stops/disconnects Web Audio nodes, and closes the audio context.
