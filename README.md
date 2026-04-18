# Astral Heresy

Astral Heresy is a small browser bullet-hell game built with native ES modules, WebGL for the background, and a 2D canvas overlay for entities and HUD.

## Quickstart

Run the local server helper:

```bash
./scripts/play.sh
```

Or serve the repo manually:

```bash
python3 -m http.server 7666 --directory .
```

Then open `http://127.0.0.1:7666/`.

`./scripts/play.sh` prefers `7666` and falls back to other free ports if needed. You can also override it with `PORT=8686 ./scripts/play.sh`.

## Repository Map

- [`AGENTS.md`](./AGENTS.md): short task router for coding agents
- [`docs/index.md`](./docs/index.md): documentation index and system of record
- [`ROADMAP.md`](./ROADMAP.md): live player-facing backlog focused on future fun work
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): game loop, domains, and dependency rules
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

Run the repo-legibility checks:

```bash
python3 scripts/check_repo_legibility.py
```

That command also runs the structural import-boundary check for `src/`.

Run only the executable stage/boss contract check:

```bash
node scripts/check_content_contract.mjs
```

Run the runtime smoke harness:

```bash
node scripts/check_runtime_smoke.mjs
```

Run the combat-economy smoke harness:

```bash
node scripts/check_combat_smoke.mjs
```

Run the real-browser smoke lane and capture screenshots under `output/playwright/`:

```bash
node scripts/check_runtime_browser_smoke.mjs
```
