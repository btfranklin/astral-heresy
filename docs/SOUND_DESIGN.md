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
event recipes live in [`../src/audio/sfx.js`](../src/audio/sfx.js), musical
identities live in
[`../src/audio/musicProfiles.js`](../src/audio/musicProfiles.js), deterministic
phrase planning lives in
[`../src/audio/musicSequencer.js`](../src/audio/musicSequencer.js), and the
optional sample-level memory processor lives in
[`../src/audio/worklets/resonantMemoryProcessor.js`](../src/audio/worklets/resonantMemoryProcessor.js).

## The Core Premise

Music and effects do not occupy unrelated aesthetic worlds. The harmonic
field, weapon reports, grazes, impacts, rewards, bosses, death, and victory all
belong to one instrument.

That instrument has five audible layers:

1. **Procession:** a recurring chord progression voiced through the current
   world's synthetic matter.
2. **Ritual pulse:** synthetic percussion that provides a dependable clock and
   a sense of formal progress.
3. **Glyph:** an immediate foreground cue with a stable gameplay meaning.
4. **Resonance:** score and glyphs excite the current world's synthetic acoustic
   body.
5. **Memory:** decaying traces of recent action return as part of the field.

Progression and pulse give the instrument direction without competing with
combat for melodic attention. The dry glyph keeps play readable. Resonance
gives the world material character. Memory makes a run feel inhabited by what
just happened.

## Principles

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

### Authored Harmonic Identity

Every world owns a fixed minor mode, four-bar harmonic cycle, cadence, harmonic
rhythm, meter, and percussion vocabulary. Chords are not required to occupy
equal spans, and encounters are not transpositions of one shared template.
These authored elements return often enough to become familiar.

Procedure changes voicing, density, rhythmic subdivision, and acoustic
excitation. It never improvises a lead line. Harmonic recurrence, not a
procedural melody, carries musical identity; the foreground remains available
to weapons, threats, impacts, and movement.

Every sustained pitched source is part of that recurrence. Pedal, pulse,
danger, and loop voices each follow an authored path through the complete cycle.
They may move independently through chord tones, but they cannot hold an
unrelated ambient pitch. A non-chord tone is permitted only when the musical
profile declares its exact location as a deliberate tension. Air, friction,
pressure, and diffuse motion use unpitched noise and resonant tails instead of
free-running pitched drones.

The score is deterministic in musical time. Gameplay event order cannot alter
the progression, and a delayed browser frame never causes missed strikes to
fire as a backlog.

### Musical State Changes At Musical Boundaries

Within an active stage or boss identity, gameplay changes arrangement rather
than rewriting tempo or harmony. Encounter transitions select the newly
authored tempo, meter, and cycle.

- stage progress develops the four-bar cycle from statement to response to
  threshold
- bosses introduce a darker related progression, a substantial tempo increase,
  and a more threatening drive
- boss phases transform chord voicing, register, and percussion
- chain may open an upper chord voice
- graze charge may admit a high ritual accent
- density admits bounded percussion layers
- low hull adds a restrained heartbeat
- Loop II retains the score under sharpened tuning and firmer subdivision

These changes enter on beats or bars. Frame-by-frame values continue shaping
texture, width, roughness, damping, and pressure without rewriting notes.

### Sacred Harmony Through Synthetic Matter

The home sonority is root, `6/5` minor third, and `3/2` fifth. Moving harmony
uses familiar twelve-tone minor-modal pitches around that pure tonic. Open
fifths, minor thirds, semitone pressure, and octave relationships recur in
milestone and end-state cues. These relationships suggest bells, organ pipes,
choral gravity, and ritual danger.

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

The complete score remains clearly audible, but important glyphs briefly lower
the music bus and retain a four-to-six-decibel foreground advantage. Fire and
graze do not pump the score.

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

A tonic pedal, two alternating four-voice harmony banks, and authored pulse,
danger, and loop paths form the pitched field. Each chord carries the next
note for every one of those persistent voices. The paths can rise, fall, or
hold through different chord members instead of mechanically doubling one
fixed scale degree. Nebula and Seraph retain the tonic pedal against the final
`B7(b9)` as their one declared cadence tension.

Each chord is prepared on the silent bank, then voice-led into place through a
short crossfade. Persistent accompaniment retunes on the same chord boundary.
The outgoing chord is allowed to decay through the resonator instead of
audibly gliding between unrelated targets. The air layer is filtered noise,
not another oscillator.

Custom periodic spectra distinguish the worlds without turning them into
unrelated soundtracks. Parameter changes use smoothed Web Audio automation so
state transitions breathe rather than step.

Loop II multiplies the root by `1.06`. The familiar world returns roughly one
semitone sharp, with firmer percussion, more strained voicing, stronger
feedback, and greater memory activity. It is the same instrument under strain.

## Processions And Ritual Pulse

Every stage develops one recurring four-bar cycle through three statements:
foundation, response, and threshold. Chord boundaries move independently of
bar lines, so a fleeting harmonic facet can interrupt a long-held body or a
dominant can occupy the weight of several ordinary changes. Boss cycles state
their identity in the first bar because their duration depends on player
performance.

| Encounter | Tempo and meter | Mode and progression; eighth-note spans |
| --- | --- | --- |
| Nebula Gate | 96 BPM, 6/8 | E natural minor: `Em(add9) [9] – Cmaj7/E [3] – Am(add9)/E [6] – B7(b9) [6]` |
| Seraph of Orbits | 138 BPM, 4/4 | E Phrygian: `Em(add b9) [8] – Fmaj7/E [4] – Bbm/E [12] – B7(b9) [8]` |
| Crystalline Choir | 118 BPM, 4/4 | G harmonic-minor facets: `Gm(add9) [8] – G5(add2,4,b7) [4] – G+(maj7) [12] – D7sus(b9) [8]` |
| Prism Leviathan | 152 BPM, 4/4 | G altered-diminished: `Gm(add b9) [6] – Ab+/G [6] – Db7(#11)/G [4] – D7(b9) [8] – Ebm/G [4] – D7sus(b9) [4]` |
| Abyssal Cathedral | 82 BPM, 12/8 | D descending abyssal minor: `Dm(add9) [12] – Cm(add9)/D [6] – Bbm(add6)/D [12] – A7(b9)/D [18]` |
| Cathedral Maw | 136 BPM, 4/4 | D Phrygian dominant: `Dm(add b9) [12] – Ebmaj7/D [4] – Cm/D [8] – A7(b9)/D [4] – Dm [4]` |

Stage progress develops orchestration around the same cycle. Boss entry changes
the mode, harmonic rhythm, voicing pressure, register, tempo, meter, and pulse
on a primary beat.
Boss phases retain their progression while rotating inversions, opening or
contracting the chord body, and changing the percussion ritual. No score voice
states a melody above it, and no acoustic layer introduces an independent
ambient pitch.

Percussion is generated from the same materials as the rest of the instrument:
decaying sine pitch drops, filtered noise impacts, tuned modal knocks,
metallic partials, and high-passed ticks. Low pulse remains centered and dry
enough to define time. Wider placement and stronger acoustic excitation belong
to selected high accents and tails.

Stage percussion leaves room for semantic glyphs and for the world to breathe.
Every boss is materially faster and more forceful. Seraph uses an explicit
four-on-the-floor orbital assault; Prism uses a syncopated `0–3–4–6` fractured
motor; Cathedral Maw uses a heavy `3+3+2` asymmetric procession. Their upper
strikes, fills, and phase accents grow denser without allowing percussion to
displace critical cues.

Individual projectiles never become percussion triggers. Fire and every other
semantic glyph remain immediate and unquantized.

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
generated excitation field, including quiet fragments of harmony and
percussion.
Preallocated, windowed grain voices return traces according to the active
world, graze, chain, density, boss phase, and ending state.

The processor performs no allocation or logging in its render callback. If the
worklet is unavailable, fails to load, or raises a processor error, the native
field and acoustic bodies continue. Diagnostics report whether memory is
loading, enhanced, or in fallback mode.

## Mix, Safety, And Lifecycle

The engine owns dry-glyph, harmony, percussion, combined-music, harmonic-field,
excitation-send, resonant-return, protected-ending, and master buses. A soft
waveshaper, compressor, and analyser terminate the mix.

The following rules are part of the design:

- semantic glyphs remain above their wet tails
- score voices have independent hard budgets and can never displace glyphs
- critical information keeps a centered component
- important glyphs briefly duck the combined music bus
- feedback, tails, and active voices are bounded
- generated noise and impulse buffers are cached
- at most one active and one fading acoustic body may exist
- no end-state transition can fire twice
- reset clears old resonance before a new run
- worklet failure never becomes a gameplay failure
- disposal is complete and idempotent

## Inspection And Verification

`window.__astralHeresy` exposes narrow audio and score diagnostics, a temporary
audio-only scene override, score-bus solo and arrangement controls, a
validated semantic cue trigger, and methods to clear the overrides. These
surfaces do not mutate gameplay.

Deterministic tests own score planning, profile, recipe, scheduling, and
lifecycle contracts. Real Chromium owns native Web Audio, worklet,
rendered-signal, transport, tail, and stress behavior. Installed Safari remains
the manual listening gate for musical balance and browser-specific audio
quality. See [`QUALITY.md`](./QUALITY.md) and [`RUNTIME.md`](./RUNTIME.md).
