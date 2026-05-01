# Tech Debt

This is the short, durable backlog for structural cleanup and agent-legibility work. Keep it prioritized and concrete. Remove items when they are actually fixed; do not turn this page into a changelog.

## Current Strengths

- `AGENTS.md` is short and routes into a small docs surface instead of trying to teach the whole repo inline.
- The content model is explicit: stage, enemy, boss, and showcase registries are versioned and mechanically checked.
- The runtime is locally inspectable through the smoke harnesses, render-study mode, and `window.__astralHeresy`.

## Highest-Leverage Debt

### 1. `collisionSystem.js` is still the main combat hotspot

Why it matters:
- It mixes player damage, burst clearing, enemy kill rewards, pickup routing, score-shard collection, boss hit handling, and weakpoint logic in one file.
- That makes review, testing, and future balance edits harder than they need to be.

Preferred split seams:
- player damage and burst resolution
- enemy kill rewards and score bookkeeping
- pickup and score-shard collection
- boss hit and weakpoint resolution

### 2. Stage authoring is still large and repetitive

Why it matters:
- [`../src/data/stages/nebula.js`](../src/data/stages/nebula.js), [`../src/data/stages/crystal.js`](../src/data/stages/crystal.js), and [`../src/data/stages/abyss.js`](../src/data/stages/abyss.js) remain long even after extracting shared gating helpers.
- The recurring structure is clearer and one-shot retry behavior is now centralized, but encounter scaffolding and author closures can still drift between stages.

Preferred next step:
- Extract one more layer of shared authored-wave helpers for repeated elite/setpiece escort patterns without flattening the stages into opaque data tables.

### 3. State reset logic has duplication risk

Why it matters:
- Some reset/setup knowledge is split between state constructors and runtime/combat helpers, so future edits can drift if only one path gets updated.

Preferred next step:
- Consolidate state-reset helpers around the state modules or a clearly named reset layer, then make the call sites delegate instead of reconstructing pieces ad hoc.

## Legibility Priorities

The next best investments for agent autonomy are:

1. Split `collisionSystem.js` along the seams above and give each extracted path a narrow smoke assertion.
2. Add one more shared stage-authoring helper layer so repeated escort behavior cannot drift across stages.
3. Keep `docs/QUALITY.md` and this file current whenever new runtime surfaces or recurring debt appear.

## Off-Repo Knowledge That Should Stay Visible

- Visual taste still depends partly on runtime inspection. When a UI or gameplay framing change is subtle, prefer a real-browser smoke pass instead of trying to encode the judgment only in prose.
- Balance tuning still lives mostly in authored content and smoke expectations, not in a formal tuning spec. If that becomes unstable, add a dedicated design note under `docs/`.
