# Docs Index

This directory is the system of record for repository knowledge that should survive beyond a single run or review thread.

## Start Here

- [`../README.md`](../README.md): quickstart and high-level repo overview
- [`../AGENTS.md`](../AGENTS.md): short task router for coding agents
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): domain map, update loop, and dependency rules
- [`QUALITY.md`](./QUALITY.md): verification matrix and golden repo invariants
- [`RUNTIME.md`](./RUNTIME.md): runbook, debug surfaces, and smoke-test flows
- [`content/stages-bosses.md`](./content/stages-bosses.md): stage and boss authoring contract
- [`generated/content-inventory.md`](./generated/content-inventory.md): generated reference for stages, bosses, phases, showcase keys, and pattern helpers

## Maintenance Rules

- Keep docs additive and linked. Prefer a short index plus targeted documents over one giant page.
- When behavior depends on runtime interaction, add the repro path to [`RUNTIME.md`](./RUNTIME.md).
- When a new recurring verification rule appears, add it to [`QUALITY.md`](./QUALITY.md).
- When structural pressure is likely to recur, encode the intended boundary in the owning doc, helper, or test instead of leaving it as an external note.
- When gameplay/content structure changes, refresh [`generated/content-inventory.md`](./generated/content-inventory.md) with `python3 scripts/generate_content_inventory.py`.
- Use `node scripts/validate_fast.mjs` as the default fast verification gate before wider manual/browser checks.
- Use `node scripts/run_fast_tests.mjs all` when you want the full deterministic behavioral suite without the repo-artifact pass.
- Run `python3 scripts/check_repo_legibility.py` after changing docs structure or generated references.
- Use `node scripts/check_structure.mjs` when changing import boundaries or moving code between `src/` areas.
- Use `node scripts/run_fast_tests.mjs content` when changing stage factories, boss factories, phase structure, or registry contracts.
- Use `node scripts/run_fast_tests.mjs combat` when changing graze, burst, pickup, weakpoint, chain, or loop-two rules.
- Use `node scripts/run_fast_tests.mjs powerups` when changing powerup collection, active-effect timers, score shards, or pickup-specific combat behavior.
- Use `node scripts/run_fast_tests.mjs runtime` when changing start flow, restart behavior, render-study behavior, or HUD sync.
- The `scripts/check_content_contract.mjs`, `scripts/check_combat_smoke.mjs`, `scripts/check_powerup_smoke.mjs`, and `scripts/check_runtime_smoke.mjs` files remain as compatibility wrappers over those groups.
- Use `node scripts/check_runtime_browser_smoke.mjs` for every change to browser-visible startup, input, visibility, layout, Canvas/WebGL, Web Audio, animation scheduling, or teardown behavior.
- Use `npm run test:performance` when comparing rendering work under fixed Chromium scenes; it is an informational lane, not part of the default gate.
