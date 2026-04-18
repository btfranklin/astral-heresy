# Roadmap

This document tracks the next player-facing improvements for Astral Heresy.
It is intentionally focused on changes that should make the game more fun, more expressive, and more replayable.

Ordering is by expected player impact relative to implementation cost, not by commitment date.

## Priority Backlog

| Priority | Item | Impact | Cost | Why It Should Improve Fun | Smallest Useful Prototype |
| --- | --- | --- | --- | --- | --- |
| 1 | Graze meter | High | Low | Precise dodging becomes rewarding instead of purely defensive. | Award graze charge when enemy bullets pass through a narrow ring around the player, then convert charge into score or a short damage boost. |
| 2 | Panic burst / bomb-lite | High | Medium | Runs get a clutch recovery tool instead of collapsing immediately after one mistake. | Add one rechargeable radial clear tied to graze or score that deletes nearby bullets and briefly stabilizes the screen. |
| 3 | Boss weakpoint windows | High | Medium | Bosses gain more identity than being large HP targets. | Give one phase per boss a temporary exposed weakpoint with bonus damage and stronger hit feedback. |
| 4 | Kill-chain scoring | Medium-High | Low | Aggressive play and route planning become more interesting. | Add a timer-based kill multiplier that rises on rapid kills and falls off when combat pacing breaks. |
| 5 | Stage setpiece beats | Medium-High | Medium | Stages become more memorable and dramatic instead of feeling like a flat stream of waves. | Add one authored event per stage, such as a corridor squeeze or synchronized crossfire formation. |
| 6 | Enemy synergy pairs | Medium-High | Medium | Encounters become more readable and tactical through enemy combinations, not just bullet count. | Pair one suppressor-style enemy with one flanker or area-denial unit in each stage. |
| 7 | Weapon modulation pickups | Medium | Medium | The player attack loop gains short bursts of variety and excitement. | Add temporary spread, pierce, or focused beam variants from drops or scripted rewards. |
| 8 | Stronger hit and phase feedback | Medium | Low | Combat feels more powerful and satisfying moment to moment. | Increase hit flash, phase-break treatment, audio emphasis, and shake shaping without changing balance. |
| 9 | Dynamic music escalation | Medium | Medium | Intensity ramps with gameplay state instead of staying emotionally flat. | Crossfade stage, boss, and low-HP layers based on run state. |
| 10 | Midbosses or elite encounters | Medium | Medium-High | Stage pacing gets an extra crescendo before the main boss. | Add one elite encounter in stage two using an existing visual language and simplified patterns. |
| 11 | Adaptive second-loop variants | Medium | High | Replay value increases after players learn the base content. | Reuse the same stages with denser timing, altered pairings, and one extra boss rule after a clear. |
| 12 | Safe-score tradeoffs | Medium | Medium | Survival and scoring stop being the same optimal path. | Reward close-range kills, graze maintenance, or faster boss phase breaks with bonus score. |

## Notes

- This roadmap assumes the registry/lifecycle refactor is in place and that new fun work should stay player-facing rather than reopening core architecture.
- Items 1 through 4 are the best candidates for the next implementation pass because they promise immediate feel improvements without requiring large new content systems.
- Items 10 through 12 are better treated as follow-on work after the moment-to-moment combat loop is stronger.
