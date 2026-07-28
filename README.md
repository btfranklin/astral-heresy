# Astral Heresy

Astral Heresy is a small browser bullet-hell game built with native ES modules, WebGL for the background, and a 2D canvas overlay for entities and HUD.

## Quickstart

Run the local server helper:

```bash
./scripts/play.sh
```

Or serve the repo manually:

```bash
python3 scripts/serve_local.py 7666 --directory .
```

Then open `http://127.0.0.1:7666/`.

`./scripts/play.sh` chooses a fresh local port for each run so Safari cannot reuse native modules from an older source revision. You can pin it when needed with `PORT=8686 ./scripts/play.sh`.
The local server also disables browser caching so subsequent reloads keep one consistent ES-module graph.

## Repository Map

- [`AGENTS.md`](./AGENTS.md): short task router for coding agents
- [`docs/index.md`](./docs/index.md): documentation index and system of record
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): game loop, domains, and dependency rules
- [`docs/QUALITY.md`](./docs/QUALITY.md): verification matrix and quality invariants
- [`docs/RUNTIME.md`](./docs/RUNTIME.md): runbook, debug surfaces, and smoke-test flow
- [`docs/content/stages-bosses.md`](./docs/content/stages-bosses.md): content authoring contract
- [`docs/generated/content-inventory.md`](./docs/generated/content-inventory.md): generated reference for stages, bosses, phases, and render-study keys

## Source Layout

- `index.html`: page shell and module bootstrap
- `style.css`: UI and overlay styling
- `src/`: game code organized by domain
- `scripts/`: local helper scripts and repo checks

## Maintenance Commands

Refresh the generated gameplay inventory:

```bash
python3 scripts/generate_content_inventory.py
```

Run the default fast validation gate:

```bash
node scripts/validate_fast.mjs
```

Run only the deterministic behavioral suite:

```bash
node scripts/run_fast_tests.mjs all
```

Run the repo-legibility checks:

```bash
python3 scripts/check_repo_legibility.py
```

That command validates docs, local links, generated references, and the structural import-boundary rules for `src/`.

Run only the stage/boss fast-test group:

```bash
node scripts/run_fast_tests.mjs content
```

Run the combat-economy fast-test group:

```bash
node scripts/run_fast_tests.mjs combat
```

Run the dedicated powerup fast-test group:

```bash
node scripts/run_fast_tests.mjs powerups
```

Run the runtime and UI fast-test group:

```bash
node scripts/run_fast_tests.mjs runtime
```

The legacy `check_content_contract`, `check_combat_smoke`, `check_powerup_smoke`, and `check_runtime_smoke` scripts remain as compatibility wrappers over those groups.

Install the development-only parser and browser-test dependencies, then install
the Chromium build used by Playwright:

```bash
npm install
npx playwright install chromium
```

Run the real Chromium contract lane and capture current-run artifacts under `output/playwright/`:

```bash
node scripts/check_runtime_browser_smoke.mjs
```

Record the opt-in Chromium rendering-performance telemetry:

```bash
npm run test:performance
```

This separate lane samples fixed idle, projectile-heavy, and boss render scenes
at DPR 1 and 2. It reports measurements without enforcing numeric budgets or
joining the default validation gate.
