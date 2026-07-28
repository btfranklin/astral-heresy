# Sound Design Manifesto

> Astral Heresy is sounded as a sacred machine. The soundtrack is not an
> accompaniment behind the game; it is one procedural instrument played,
> struck, tuned, scarred, and finally silenced by the state of the run.

## Status And Scope

This document records the sound-design identity implemented by the game. It is
a present-state design contract, not a roadmap.

The composition and lifecycle root is
[`../src/audio/audioEngine.js`](../src/audio/audioEngine.js). The authored
world profiles live in
[`../src/audio/audioProfiles.js`](../src/audio/audioProfiles.js), semantic
event recipes live in [`../src/audio/sfx.js`](../src/audio/sfx.js), and the
optional sample-level memory processor lives in
[`../src/audio/worklets/resonantMemoryProcessor.js`](../src/audio/worklets/resonantMemoryProcessor.js).

## The Core Premise

Music and effects do not occupy unrelated aesthetic worlds. The harmonic
field, weapon reports, grazes, impacts, rewards, bosses, death, and victory all
belong to one instrument.

That instrument has three audible layers:

1. **Glyph:** an immediate foreground cue with a stable gameplay meaning.
2. **Resonance:** the glyph excites the current world's synthetic acoustic
   body.
3. **Memory:** decaying traces of recent action return as part of the field.

The dry glyph keeps play readable. Resonance gives the world material
character. Memory makes a run feel inhabited by what just happened.

## Existing Principles

### Game State Becomes Musical State

The field reads one bounded projection of the live run:

- the current stage selects the root and resonant body
- bosses transform that body instead of replacing it with boss music
- boss phases change motion, spectral shape, and decay
- low hull adds roughness and instability
- chain aligns and brightens upper partials
- graze charge fills a quiet high-frequency reservoir
- aggregate threat density changes pressure and damping
- the second loop sharpens the root and increases acoustic strain

Audio observes gameplay in one direction. It never feeds decisions back into
the simulation.

### Sacred Harmony Through Synthetic Matter

The harmonic foundation remains plain: root, `5/4` major third, and `3/2`
fifth. Open fifths and octave relationships recur in milestone and end-state
cues. These relationships suggest drones, bells, organ pipes, and choral
stability.

Their material is artificial. Sine and triangle waves provide purity; custom
periodic waves expose selected overtones; square and sawtooth waves provide
incision and roughness; filtered noise supplies air, friction, and impact.
Modal filters, delay lines, generated impulse responses, wave shaping, and
controlled feedback turn those sources into an impossible acoustic space.

The celestial world is voiced through circuitry. The tension between
devotional harmony and naked synthesis is the center of the sound.

### Pitch, Motion, Texture, And Space Carry Meaning

The semantic language remains consistent:

- high, short, bright sounds mark precision, proximity, and successful reads
- consonant chords mark acquisition, escalation, and structural transitions
- low, noisy, rough sounds mark injury, force, and danger
- upward motion suggests release, rupture, or overcoming
- downward motion suggests damage, collapse, or severance
- duration and spectral breadth express consequence
- spatial width belongs mainly to resonance, never to critical information

Critical glyphs retain a strong centered component and remain intelligible
when the output is collapsed to mono.

### The Mix Is Player-Centered

The game prioritizes firing, grazing, shield absorption, damage, death, enemy
destruction, chain milestones, burst, weakpoints, pickups, boss structure, and
victory. It does not report every enemy projectile or every score shard.

Aggregate bullet and enemy density may change the pressure of the field, but
bullet-heavy scenes never become a wall of literal trigger sounds.

### Magnitude Is More Than Volume

Small actions are short and narrow. Larger actions occupy more register, excite
more of the acoustic body, and decay for longer.

A graze is a high shimmer. A player hit is a broader low descent. A burst
injects a rising low chord into the current resonator. A boss defeat expands
outward through the world. True player death collapses the field inward and
leaves a memorial tail.

### Silence Defines The Ritual Boundary

The instrument begins only after the launch gesture. It remains absent from
render-study mode. Death and final victory reach silence through authored
endings rather than an instantaneous mute.

Restarting during an ending clears its tail before the next sortie begins.
Disposal stops and disconnects every source, graph, worklet, and context.

## Harmonic Field

The stage roots retain the original identity:

| World | Root |
| --- | --- |
| Nebula Gate | 164.81 Hz, approximately E3 |
| Crystalline Choir | 196.00 Hz, G3 |
| Abyssal Cathedral | 146.83 Hz, D3 |

Root, third, fifth, air, pulse, danger, and loop voices form a persistent
field. Custom periodic spectra distinguish the worlds without turning them
into unrelated soundtracks. Parameter changes use smoothed Web Audio
automation so state transitions breathe rather than step.

Loop II multiplies the root by `1.06`. The familiar world returns roughly one
semitone sharp, with stronger feedback and memory activity. It is the same
instrument under strain.

## Acoustic Bodies

Every semantic event can send energy into one active stage body. A previous
body may remain only long enough to crossfade and release its tail.

Each body combines:

- a bank of tuned modal filters
- four filtered feedback-delay lines
- a deterministic stereo impulse response
- a bounded wet return

Feedback is always clamped below `0.68`; impulse responses never exceed three
seconds.

### Nebula Gate

Nebula Gate uses long, lightly fed delays, an airy impulse, slowly precessing
partials, filtered noise clouds, and diffuse orbital motion. Events leave
luminous traces rather than obvious room reverberation.

Seraph of Orbits transforms this body:

- **Crown Spiral:** the pulse takes on clear orbital motion
- **Halo Bloom:** upper partials open and spread
- **Starfall Rite:** descending fragments enter the memory field

### Crystalline Choir

Crystalline Choir uses very short feedback paths, bright modal ringing,
spectral symmetry, and refracted stereo reflections. Precision play assembles a
clearer glass-like chord.

Prism Leviathan transforms this body:

- **Crystal Lattice:** modal symmetry and definition increase
- **Refraction Choir:** controlled sidebands split the field
- **Prismatic Tide:** wavefolding and alternating spectral dispersion deepen

### Abyssal Cathedral

Abyssal Cathedral uses the longest dark impulse, formant-like choir bands,
subharmonic weight, and a vast filtered decay.

Cathedral Maw transforms this body:

- **Chorus of Fangs:** vocal formant bands emerge
- **Spine Cathedral:** comb resonance lengthens and hardens
- **Maw Singularity:** the field narrows around a subharmonic center and memory
  capture increases

## Current Event Grammar

| Event | Foreground glyph | Resonant role |
| --- | --- | --- |
| Fire | Filtered noise, rising triangle, falling high sine | Small repeating electrical excitation |
| Graze | High noise and a tiny sine rise | Adds air and a glass-like trace |
| Shield absorbed | Bright suspended chord and a soft downward sheen | Deflects energy outward without implying hull damage |
| Enemy destroyed | Midrange noise with opposed pitch motion | Compact broadband impulse |
| Chain milestone | Detuned root–fifth–octave chord | Aligns and brightens harmonic memory |
| Player hit | Strong noise with low saw and sine descents | Injects rough low-frequency instability |
| Burst | Broad noise and a rising low saw chord | Discharges energy through the whole body |
| Boss arrival | Long open chord and noise accent | Seizes the stage body for a boss |
| Boss phase | Related ceremonial chord | Reconfigures the current boss transformation |
| Weakpoint hit | Rising square incision and high falling sine | Focused high-frequency flare |
| Boss defeated | Long low rupture and ascending chord | Expands through the outgoing world |
| Powerup collected | Category-specific chord and identifying tone | Adds a colored acquisition resonance |
| Sortie started | Open sine chord and small rise | Admits the player into the sounding state |

Fire and graze are coalesced inside the audio engine. Temporary voices have a
hard budget; critical cues may reclaim lower-priority voices, while repeating
cues may be skipped. Density never creates unbounded synthesis.

## True Death: The Severance Requiem

Lethal damage does not reuse the ordinary hit glyph.

The Severance Requiem begins with a unique broadband fracture and low physical
blow. The current harmonic field holds briefly, then its root, third, and fifth
fall one octave while upper partials disappear and the stereo field collapses
inward. It resolves into the open subharmonic set
`[root / 2, root * 3 / 4, root]` and decays through the existing results
screen for approximately 3.2 seconds.

The foreground requiem has a protected ending bus into the master chain. The
field and resonant return may collapse without muting that authored glyph.
Restart is the only early exit: it fades both the run graph and ending bus in
30 ms.

When advanced memory processing is available, a short trace of recent sound is
frozen and returned as descending granular fragments. The native requiem
remains complete without that layer.

The game-over overlay and final runtime appear immediately. Restart remains
immediately available and clears the requiem before the new launch chord.

## Final Victory

The last boss defeat remains outward and ascending. The field then converges
to root and fifth, accumulated resonance drains for approximately three
seconds, and the choir reaches silence.

Ordinary boss defeats are not endings. Their resonance is allowed to enter the
crossfade toward the next world or Loop II.

## Memory Processing

The optional AudioWorklet retains a bounded four-second stereo history of the
generated excitation field. Preallocated, windowed grain voices return quiet
fragments according to the active world, graze, chain, density, boss phase, and
ending state.

The processor performs no allocation or logging in its render callback. If the
worklet is unavailable, fails to load, or raises a processor error, the native
field and acoustic bodies continue. Diagnostics report whether memory is
loading, enhanced, or in fallback mode.

## Mix, Safety, And Lifecycle

The engine owns dry-glyph, harmonic-field, excitation-send, resonant-return,
and master buses. A soft waveshaper, compressor, and analyser terminate the
mix.

The following rules are part of the design:

- semantic glyphs remain above their wet tails
- critical information keeps a centered component
- feedback, tails, and active voices are bounded
- generated noise and impulse buffers are cached
- at most one active and one fading acoustic body may exist
- no end-state transition can fire twice
- reset clears old resonance before a new run
- worklet failure never becomes a gameplay failure
- disposal is complete and idempotent

## Inspection And Verification

`window.__astralHeresy` exposes narrow audio diagnostics, a temporary
audio-only scene override, a validated semantic cue trigger, and a method to
clear the override. These surfaces do not mutate gameplay.

Deterministic tests own profile and recipe contracts. Real Chromium owns native
Web Audio, worklet, rendered-signal, lifecycle, tail, and stress behavior.
Installed Safari remains the manual listening gate for browser-specific audio
quality. See [`QUALITY.md`](./QUALITY.md) and [`RUNTIME.md`](./RUNTIME.md).
