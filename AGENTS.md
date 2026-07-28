# AGENTS.md

Use this file as a router. The durable source of truth for non-trivial repo knowledge lives under `docs/`.

## Start Here

- Product overview and quickstart: [`README.md`](./README.md)
- Docs index: [`docs/index.md`](./docs/index.md)
- Architecture map: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Sound design manifesto: [`docs/SOUND_DESIGN.md`](./docs/SOUND_DESIGN.md)
- Quality and verification map: [`docs/QUALITY.md`](./docs/QUALITY.md)
- Runtime inspection and smoke-test paths: [`docs/RUNTIME.md`](./docs/RUNTIME.md)
- Stage and boss authoring model: [`docs/content/stages-bosses.md`](./docs/content/stages-bosses.md)
- Generated gameplay inventory: [`docs/generated/content-inventory.md`](./docs/generated/content-inventory.md)

## Task Routing

- Gameplay flow, state transitions, or update ordering:
  [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Sound philosophy, cue grammar, synthesis, or audio changes:
  [`docs/SOUND_DESIGN.md`](./docs/SOUND_DESIGN.md)
- Adding or changing stages, bosses, patterns, or enemy content:
  [`docs/content/stages-bosses.md`](./docs/content/stages-bosses.md)
- Visual QA, repros, hidden debug surfaces, or browser inspection:
  [`docs/RUNTIME.md`](./docs/RUNTIME.md)
- Which checks to run for a change:
  [`docs/QUALITY.md`](./docs/QUALITY.md)
- Refreshing generated references:
  `python3 scripts/generate_content_inventory.py`
- Running the default fast validation gate:
  `node scripts/validate_fast.mjs`
- Running the full deterministic behavioral suite:
  `node scripts/run_fast_tests.mjs all`
- Verifying the repo-legibility checks:
  `python3 scripts/check_repo_legibility.py`
- Running only the structural module-graph check:
  `node scripts/check_structure.mjs`
- Running only the stage/boss fast-test group:
  `node scripts/run_fast_tests.mjs content`
- Running only the combat-economy fast-test group:
  `node scripts/run_fast_tests.mjs combat`
- Running only the powerup fast-test group:
  `node scripts/run_fast_tests.mjs powerups`
- Running the runtime fast-test group:
  `node scripts/run_fast_tests.mjs runtime`
- Legacy wrapper for the content group:
  `node scripts/check_content_contract.mjs`
- Legacy wrapper for the combat group:
  `node scripts/check_combat_smoke.mjs`
- Legacy wrapper for the powerup group:
  `node scripts/check_powerup_smoke.mjs`
- Legacy wrapper for the runtime group:
  `node scripts/check_runtime_smoke.mjs`
- Running the real-browser contract lane:
  `node scripts/check_runtime_browser_smoke.mjs`
- Recording the opt-in Chromium rendering-performance telemetry:
  `npm run test:performance`

## Working Rules

- Keep this file short. Put deeper explanations in `docs/` and link them here.
- Treat `src/core/game.js` as the composition root and `docs/ARCHITECTURE.md` as the explanation of why it is wired that way.
- If you add a new durable concept, runtime surface, or authoring rule, document it in `docs/` and update `docs/index.md`.
