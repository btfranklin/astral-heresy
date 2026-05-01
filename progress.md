Original prompt: Implement the Astral Heresy Combat HUD Diet plan.

## Progress

- Started HUD diet implementation: compact active-combat DOM, wider playfield, in-world canvas cues, docs/tests updates.
- Implemented the first HUD diet pass: active combat now hides the prose/control/boss/feed/effect-card surfaces, desktop playfield rails are removed, and player-local canvas cues handle graze, burst, chain, and timed effects.
- Added a desktop bottom playfield safety margin so the ship does not disappear behind the compact systems strip.
- Validation passed: runtime, combat, powerup, full fast validation, real-browser smoke, and desktop/mobile/tablet screenshot inspection.

## TODO

- No known follow-up blockers from this pass.
