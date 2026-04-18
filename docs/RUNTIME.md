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
3. Launch a run and confirm the HUD updates from `Awaiting launch clearance` to active combat text.
4. Fire, focus, burst with `X`, and toggle pointer steering with `M`.
5. Confirm the desktop side bays read as non-playable space and the center lane is visually framed apart from them.
6. Confirm graze, burst stock, weapon, chain, and loop HUD fields update without layout breakage.
7. Collect at least one pickup and confirm the ephemeral acquisition text plus HUD feed entry appear immediately.
8. Confirm the active-effects strip updates with weapon and timed utility/risk effects.
9. Hold movement or fire, blur the window or hide the tab, then return and confirm the ship is idle until new input is pressed.
10. Force-spawn or wait for an enemy near the side boundary and confirm it never lives behind the HUD bay.
11. Confirm restart behavior after a loss with `Enter` or `R`.
12. Visit at least one enemy render-study URL and one boss render-study URL.
13. Confirm the page still initializes on a browser with WebGL enabled.

For a mechanical approximation of these flows without a real browser, run:

```bash
node scripts/check_runtime_smoke.mjs
```

For combat-economy-specific verification without the DOM harness, run:

```bash
node scripts/check_combat_smoke.mjs
```

For dedicated powerup verification without the DOM harness, run:

```bash
node scripts/check_powerup_smoke.mjs
```

That harness validates:

- start-screen visibility before launch
- launch and restart wiring
- playfield geometry for desktop and tablet widths
- interface copy and boss-panel sync
- deterministic step and text-state hooks
- burst input wiring and loop HUD reset
- input reset on blur and visibility loss
- playfield and density text-state coverage
- render-study URL parsing and scene setup

The dedicated powerup lane validates:

- acquisition notice and HUD feed timing
- `Burst Cell`, `Halo Shield`, `Chain Sigil`, `Graze Bloom`, `Magnet Core`
- `Orbitals`, `Weakpoint Amplifier`, and `Point-Blank Seal`
- score-shard routing and weakpoint-brand damage behavior

For a real-browser pass that captures screenshots under `output/playwright/runtime-smoke/`, run:

```bash
node scripts/check_runtime_browser_smoke.mjs
```

That lane validates:

- page boot in a real browser
- launch flow and restart wiring
- side-bay framing and playfield geometry in the real browser
- enemy clamping away from the HUD bay area
- pickup acquisition callout visibility
- active-effect HUD state
- shield-break, orbitals, amplifier-brand, and magnet-core scenes
- one enemy render-study URL
- one boss render-study URL
- screenshot capture into the ignored output folder

## Constraints Worth Remembering

- WebGL is required for the animated background. Failure is surfaced through an alert in the composition root.
- The repo has no build step. Browser-native ES modules are the execution model.
- Randomness is not seeded. If determinism matters, document the intended RNG boundary before changing it.
- `window.__astralHeresy.dispose()` is available for teardown-aware debugging and tests.
