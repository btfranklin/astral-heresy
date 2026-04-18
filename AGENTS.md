# AGENTS.md

Use this file as a router. The durable source of truth for non-trivial repo knowledge lives under `docs/`.

## Start Here

- Product overview and quickstart: [`README.md`](./README.md)
- Docs index: [`docs/index.md`](./docs/index.md)
- Architecture map: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Runtime inspection and smoke-test paths: [`docs/RUNTIME.md`](./docs/RUNTIME.md)
- Stage and boss authoring model: [`docs/content/stages-bosses.md`](./docs/content/stages-bosses.md)
- Generated gameplay inventory: [`docs/generated/content-inventory.md`](./docs/generated/content-inventory.md)

## Task Routing

- Gameplay flow, state transitions, or update ordering:
  [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Adding or changing stages, bosses, patterns, or enemy content:
  [`docs/content/stages-bosses.md`](./docs/content/stages-bosses.md)
- Visual QA, repros, hidden debug surfaces, or browser inspection:
  [`docs/RUNTIME.md`](./docs/RUNTIME.md)
- Refreshing generated references:
  `python3 scripts/generate_content_inventory.py`
- Verifying the repo-legibility checks:
  `python3 scripts/check_repo_legibility.py`
- Running only the structural boundary check:
  `python3 scripts/check_structure.py`
- Running only the stage/boss content contract check:
  `node scripts/check_content_contract.mjs`
- Running only the combat-economy smoke lane:
  `node scripts/check_combat_smoke.mjs`
- Running only the powerup smoke lane:
  `node scripts/check_powerup_smoke.mjs`
- Running the runtime smoke harness:
  `node scripts/check_runtime_smoke.mjs`
- Running the real-browser smoke lane:
  `node scripts/check_runtime_browser_smoke.mjs`

## Working Rules

- Keep this file short. Put deeper explanations in `docs/` and link them here.
- Treat `src/core/game.js` as the composition root and `docs/ARCHITECTURE.md` as the explanation of why it is wired that way.
- If you add a new durable concept, runtime surface, or authoring rule, document it in `docs/` and update `docs/index.md`.
