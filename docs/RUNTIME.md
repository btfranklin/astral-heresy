# Runtime

This repo is easiest to understand by running it. Gameplay flow, render detail, start/end overlays, and render-study mode are all runtime-visible concerns.

## Local Run Commands

Standard helper:

```bash
./scripts/play.sh
```

Manual server without auto-opening a browser:

```bash
python3 -m http.server 7666 --directory .
```

Then visit `http://127.0.0.1:7666/`.

`./scripts/play.sh` prefers `7666` and falls back to other free ports if needed. You can also override it with `PORT=8686 ./scripts/play.sh`.

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

## Debug And Inspection Surfaces

### Global Handle

[`../src/index.js`](../src/index.js) exposes the created game as `window.__astralHeresy`.

Useful console reads:

```js
window.__astralHeresy.state
window.__astralHeresy.player
window.__astralHeresy.resetGame(true)
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
3. Launch a run and confirm the HUD updates from `Awaiting launch clearance` to active combat text.
4. Fire, focus, burst with `X`, and toggle pointer steering with `M`.
5. Confirm graze, burst stock, weapon, chain, and loop HUD fields update without layout breakage.
6. Collect at least one elite pickup and confirm the weapon label/timer update.
7. Confirm restart behavior after a loss with `Enter` or `R`.
8. Visit at least one enemy render-study URL and one boss render-study URL.
9. Confirm the page still initializes on a browser with WebGL enabled.

For a mechanical approximation of these flows without a real browser, run:

```bash
node scripts/check_runtime_smoke.mjs
```

For combat-economy-specific verification without the DOM harness, run:

```bash
node scripts/check_combat_smoke.mjs
```

That harness validates:

- start-screen visibility before launch
- launch and restart wiring
- interface copy and boss-panel sync
- deterministic step and text-state hooks
- burst input wiring and loop HUD reset
- render-study URL parsing and scene setup

For a real-browser pass that captures screenshots under `output/playwright/runtime-smoke/`, run:

```bash
node scripts/check_runtime_browser_smoke.mjs
```

That lane validates:

- page boot in a real browser
- launch flow and restart wiring
- one enemy render-study URL
- one boss render-study URL
- screenshot capture into the ignored output folder

## Constraints Worth Remembering

- WebGL is required for the animated background. Failure is surfaced through an alert in the composition root.
- The repo has no build step. Browser-native ES modules are the execution model.
- Randomness is not seeded. If determinism matters, document the intended RNG boundary before changing it.
- `window.__astralHeresy.dispose()` is available for teardown-aware debugging and tests.
