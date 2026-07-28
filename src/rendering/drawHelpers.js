import { TAU } from "../core/math.js";

const NORMALIZED_SPRITE_SIZE = 64;
const NORMALIZED_GLOW_RADIUS = 32;

function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

export function getUnitCirclePoints(count, resources) {
  const cache = resources?.unitCirclePoints;
  let points = cache?.get(count);
  if (points) return points;

  points = new Float64Array(count * 2);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    points[i * 2] = Math.cos(angle);
    points[i * 2 + 1] = Math.sin(angle);
  }
  cache?.set(count, points);
  return points;
}

export function createNormalizedSpriteCache(createCanvas, { maxEntries, paint }) {
  let disposed = false;
  let dpr = null;
  const entries = new Map();

  function clear() {
    for (const canvas of entries.values()) {
      releaseCanvas(canvas);
    }
    entries.clear();
  }

  function get(color, nextDpr = 1) {
    if (disposed) return null;

    const numericDpr = Number(nextDpr);
    const normalizedDpr = Number.isFinite(numericDpr) && numericDpr > 0 ? numericDpr : 1;
    if (dpr !== normalizedDpr) {
      clear();
      dpr = normalizedDpr;
    }

    const cached = entries.get(color);
    if (cached) return cached;

    if (entries.size >= maxEntries) {
      const oldestKey = entries.keys().next().value;
      releaseCanvas(entries.get(oldestKey));
      entries.delete(oldestKey);
    }

    const canvas = createCanvas();
    const pixelSize = Math.max(1, Math.ceil(NORMALIZED_SPRITE_SIZE * normalizedDpr));
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const spriteCtx = canvas.getContext("2d");
    const spriteScale = pixelSize / NORMALIZED_SPRITE_SIZE;
    spriteCtx.setTransform(spriteScale, 0, 0, spriteScale, 0, 0);
    paint(spriteCtx, color);
    entries.set(color, canvas);
    return canvas;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clear();
  }

  return { get, dispose };
}

export function createGlowSpriteCache(createCanvas) {
  return createNormalizedSpriteCache(createCanvas, {
    maxEntries: 64,
    paint(spriteCtx, color) {
      const gradient = spriteCtx.createRadialGradient(
        NORMALIZED_GLOW_RADIUS,
        NORMALIZED_GLOW_RADIUS,
        0,
        NORMALIZED_GLOW_RADIUS,
        NORMALIZED_GLOW_RADIUS,
        NORMALIZED_GLOW_RADIUS
      );
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      spriteCtx.fillStyle = gradient;
      spriteCtx.beginPath();
      spriteCtx.arc(
        NORMALIZED_GLOW_RADIUS,
        NORMALIZED_GLOW_RADIUS,
        NORMALIZED_GLOW_RADIUS,
        0,
        TAU
      );
      spriteCtx.fill();
    },
  });
}

export function drawGlowCircle(ctx, x, y, r, color, intensity, resources) {
  const sprite = resources?.glowSprites?.get(color, resources.dpr);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = intensity;
  if (sprite) {
    ctx.drawImage(
      sprite,
      0,
      0,
      sprite.width,
      sprite.height,
      x - r,
      y - r,
      r * 2,
      r * 2
    );
  } else {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
