# Enemy Art

Enemy art uses solid dark bodies, pale edges, and small bright eyes. Keep each
family easy to identify at its normal play size. Decorative wings, rings, limbs,
and debris do not change the circular collision areas.

## Small Enemies

- Cherub: three feathers on each wing, with a folded preparation pose.
- Halo Sentinel: two tilted rings with separate front and rear halves.
- Oracle Sigil: two diamond plates that open around the eye.
- Choir Shard: an uneven crystal with a dark facet and a bright edge.
- Refraction Weaver: six jointed limbs with threads between their tips.
- Hymnal Harp: an open frame with strings that bend before a shot.
- Penitent Spear: a downward point and fins that fold back before a shot.
- Solar Throne: a thick wheel with eight spokes and four smaller eyes.
- Cathedral Fang: two jaws that open before a shot.

The renderer reads `ai.nextShot`. Preparation increases during the last
0.38 seconds before a scheduled shot. The enemy system sets `ai.attackRelease`
when the firing callback resets the countdown. That release lasts 0.18 seconds.
These values control drawing only. They do not delay shots or change movement.
The first shot can occur as soon as an enemy enters, as it did before.

Render-study mode previews preparation and release on a two-second cycle without
creating projectiles. See [Runtime](../RUNTIME.md) for the study URLs.

## Bosses

Each boss has a distinct body and phase shape:

- Seraph uses three separate wing pairs with open gaps between them.
- Prism uses a centered ring of crystal segments with dark facets. Its phases
  use a circle, an ellipse, and a moving wave. Opposite segments keep equal
  sizes and radii so the ring stays centered while it opens or contracts.
- Cathedral uses broken towers, ribs, and a deep doorway mouth.

Phase changes alter the body arrangement. Keep the central target visible and
keep large outer details clear of the boss health bar when possible.

## Defeat Effects

Angelic enemies release feathers. Crystal enemies release crystal fragments.
Cathedral enemies release ribs and ash. Bosses use their matching family.

`particleSystem.js` selects the shapes and creates their motion. The Canvas
renderer draws the shapes from particle age without changing particle state.
Existing movement and lifetime systems remove them. General impact particles
retain their existing glow drawing.

Each ordinary defeat creates 18 particles, including eight shaped fragments.
Each boss defeat creates 120 particles, including 36 shaped fragments. These
are the existing total counts; the new shapes replace part of each burst.
Elite bonus bursts remain separate.

## Verification

Run the fast validation gate and the Chromium browser suite. Inspect all nine
enemies at normal size and each boss in all three phases. Check preparation,
release, contrast over bright clouds, body separation, and visible weakpoints.
