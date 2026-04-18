# Docs Index

This directory is the system of record for repository knowledge that should survive beyond a single run or review thread.

## Start Here

- [`../README.md`](../README.md): quickstart and high-level repo overview
- [`../AGENTS.md`](../AGENTS.md): short task router for coding agents
- [`../ROADMAP.md`](../ROADMAP.md): prioritized player-facing backlog focused on increasing fun
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): domain map, update loop, and dependency rules
- [`RUNTIME.md`](./RUNTIME.md): runbook, debug surfaces, and smoke-test flows
- [`content/stages-bosses.md`](./content/stages-bosses.md): stage and boss authoring contract
- [`generated/content-inventory.md`](./generated/content-inventory.md): generated reference for stages, bosses, phases, showcase keys, and pattern helpers

## Maintenance Rules

- Keep docs additive and linked. Prefer a short index plus targeted documents over one giant page.
- When behavior depends on runtime interaction, add the repro path to [`RUNTIME.md`](./RUNTIME.md).
- When gameplay/content structure changes, refresh [`generated/content-inventory.md`](./generated/content-inventory.md) with `python3 scripts/generate_content_inventory.py`.
- Run `python3 scripts/check_repo_legibility.py` after changing docs structure or generated references.
- Use `python3 scripts/check_structure.py` when changing import boundaries or moving code between `src/` areas.
- Use `node scripts/check_content_contract.mjs` when changing stage factories, boss factories, or phase structure.
- Use `node scripts/check_runtime_smoke.mjs` when changing start flow, restart behavior, render-study behavior, or HUD sync.
- Use `node scripts/check_runtime_browser_smoke.mjs` when changing browser-visible runtime behavior and you want a screenshot-backed real-browser pass.
