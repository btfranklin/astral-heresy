import { rand, TAU } from "../core/math.js";
import { getOrbitalOffsets } from "../core/orbitals.js";
import { powerupTuning } from "../core/powerups.js";
import {
  createGlowSpriteCache,
  createNormalizedSpriteCache,
  drawGlowCircle,
} from "./drawHelpers.js";
import { drawBossByKey } from "./bossRenderers.js";
import {
  createBossHudCache,
  drawBossUI,
  drawBossWeakpoint,
  drawPlayerUI,
} from "./hudRenderer.js";
import { drawEnemy } from "./enemyRenderers.js";

const NORMALIZED_SPRITE_SIZE = 64;
const NORMALIZED_PARTICLE_RADIUS = 8;

function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

function createBulletSpriteCache(createCanvas) {
  const cache = new Map();

  function dispose() {
    for (const canvas of cache.values()) {
      releaseCanvas(canvas);
    }
    cache.clear();
  }

  return {
    get(color, radius) {
      const key = `${color}:${radius}`;
      const cached = cache.get(key);
      if (cached) return cached;

      const size = Math.ceil(radius * 8);
      const sprite = createCanvas();
      sprite.width = size;
      sprite.height = size;
      const spriteCtx = sprite.getContext("2d");
      const cx = size * 0.5;
      const cy = size * 0.5;
      const glow = spriteCtx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 3.2);
      glow.addColorStop(0, color);
      glow.addColorStop(0.35, color);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      spriteCtx.fillStyle = glow;
      spriteCtx.beginPath();
      spriteCtx.arc(cx, cy, radius * 3.1, 0, TAU);
      spriteCtx.fill();

      spriteCtx.globalCompositeOperation = "source-over";
      spriteCtx.fillStyle = color;
      spriteCtx.beginPath();
      spriteCtx.arc(cx, cy, radius, 0, TAU);
      spriteCtx.fill();

      cache.set(key, sprite);
      return sprite;
    },
    dispose,
  };
}

function createParticleSpriteCache(createCanvas) {
  return createNormalizedSpriteCache(createCanvas, {
    maxEntries: 32,
    paint(spriteCtx, color) {
      const center = NORMALIZED_SPRITE_SIZE * 0.5;
      const glow = spriteCtx.createRadialGradient(
        center,
        center,
        NORMALIZED_PARTICLE_RADIUS * 0.2,
        center,
        center,
        NORMALIZED_PARTICLE_RADIUS * 3.2
      );
      glow.addColorStop(0, color);
      glow.addColorStop(0.35, color);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      spriteCtx.fillStyle = glow;
      spriteCtx.beginPath();
      spriteCtx.arc(center, center, NORMALIZED_PARTICLE_RADIUS * 3.1, 0, TAU);
      spriteCtx.fill();

      spriteCtx.globalCompositeOperation = "source-over";
      spriteCtx.fillStyle = color;
      spriteCtx.beginPath();
      spriteCtx.arc(center, center, NORMALIZED_PARTICLE_RADIUS, 0, TAU);
      spriteCtx.fill();
    },
  });
}

function drawBulletTrails(ctx, bullets, detail) {
  if (detail === "minimal") return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const bullet of bullets) {
    const life = bullet.components.lifetime;
    const render = bullet.components.render;
    const pos = bullet.components.position;
    const col = bullet.components.collider;
    const vel = bullet.components.velocity;
    if (!life || !render || !pos || !col || !vel) continue;
    const speed = Math.hypot(vel.vx, vel.vy);
    if (speed < 1) continue;
    const alpha = Math.max(0, 1 - life.age / life.life);
    const tailLength = detail === "high"
      ? col.r * (6 + (render.trail || 0.5) * 10)
      : col.r * 5;
    ctx.globalAlpha = detail === "high" ? alpha * 0.72 : alpha * 0.4;
    ctx.strokeStyle = render.color;
    ctx.lineWidth = detail === "high" ? Math.max(1.5, col.r * 1.25) : Math.max(1, col.r);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x - (vel.vx / speed) * tailLength, pos.y - (vel.vy / speed) * tailLength);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBullets(ctx, bullets, spriteCache, detail) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const bullet of bullets) {
    const life = bullet.components.lifetime;
    const render = bullet.components.render;
    const pos = bullet.components.position;
    const col = bullet.components.collider;
    if (!life || !render || !pos || !col) continue;
    const alpha = Math.max(0, 1 - life.age / life.life);
    ctx.globalAlpha = alpha;
    if (detail === "minimal") {
      ctx.fillStyle = render.color;
      ctx.fillRect(pos.x - col.r, pos.y - col.r, col.r * 2, col.r * 2);
      continue;
    }
    const sprite = spriteCache.get(render.color, col.r);
    ctx.drawImage(sprite, pos.x - sprite.width * 0.5, pos.y - sprite.height * 0.5);
  }
  ctx.restore();
}

function drawPlayfieldFrame(ctx, state) {
  if (!state.playfield.active) return;

  const left = state.playfield.minX;
  const right = state.playfield.maxX;
  const height = state.view.height;

  ctx.save();
  ctx.strokeStyle = "rgba(184, 243, 255, 0.13)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left + 0.5, 0);
  ctx.lineTo(left + 0.5, height);
  ctx.moveTo(right - 0.5, 0);
  ctx.lineTo(right - 0.5, height);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 213, 142, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 52; y < height; y += 104) {
    ctx.moveTo(Math.max(12, left - 20), y);
    ctx.lineTo(left - 4, y + 8);
    ctx.moveTo(right + 4, y + 8);
    ctx.lineTo(Math.min(state.view.width - 12, right + 20), y);
  }
  ctx.stroke();

  ctx.restore();
}

function drawEnemies(ctx, enemies, state, resources) {
  for (const enemy of enemies) {
    drawEnemy(ctx, enemy, state, resources);
  }
}

function drawPickups(ctx, pickups, state, resources) {
  for (const entity of pickups) {
    const pos = entity.components.position;
    const render = entity.components.render;
    const pickup = entity.components.pickup;
    if (!pos || !render || !pickup) continue;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(state.time * 1.6 + pickup.t * 2.8 + entity.id * 0.12);
    if (pickup.spawnPause > 0) {
      ctx.fillStyle = "rgba(4, 8, 18, 0.3)";
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, TAU);
      ctx.fill();
      const beamAlpha = pickup.spawnPause / 0.24;
      ctx.fillStyle = render.glowColor || "rgba(255,255,255,0.2)";
      ctx.globalAlpha = beamAlpha * 0.7;
      ctx.fillRect(-8, -120, 16, 240);
      ctx.globalAlpha = 1;
    }
    drawGlowCircle(ctx, 0, 0, 28, render.color, 0.22, resources);
    ctx.strokeStyle = render.accent;
    ctx.lineWidth = 2;
    if (pickup.category === "weapon") {
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(11, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-11, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = render.color;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
    } else if (pickup.category === "risk") {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (TAU * i) / 8;
        const radius = i % 2 === 0 ? 12 : 6;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = render.color;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (TAU * i) / 6;
        const x = Math.cos(angle) * 11;
        const y = Math.sin(angle) * 11;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = render.color;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawScoreShards(ctx, scoreShards, player, resources) {
  ctx.save();
  for (const entity of scoreShards) {
    const pos = entity.components.position;
    const render = entity.components.render;
    const shard = entity.components.scoreShard;
    if (!pos || !render || !shard) continue;
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distance = Math.hypot(dx, dy);
    if (player.activePowerups.magnetCore > 0 && distance < powerupTuning.magnetRadius) {
      ctx.strokeStyle = "rgba(143, 232, 255, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.quadraticCurveTo(
        pos.x + dx * 0.35 + dy * 0.08,
        pos.y + dy * 0.35 - dx * 0.08,
        player.x,
        player.y
      );
      ctx.stroke();
    }
    drawGlowCircle(ctx, pos.x, pos.y, 12, render.color, 0.18, resources);
    ctx.fillStyle = render.color;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - 6);
    ctx.lineTo(pos.x + 5, pos.y);
    ctx.lineTo(pos.x, pos.y + 6);
    ctx.lineTo(pos.x - 5, pos.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawDebris(ctx, pos, render, age) {
  const size = render.size;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(render.angle + age * render.spin);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = render.color;
  ctx.strokeStyle = render.color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (render.shape === "feather") {
    ctx.moveTo(0, -size * 1.7);
    ctx.quadraticCurveTo(size, -size * 0.3, 0, size);
    ctx.quadraticCurveTo(-size * 0.7, 0, 0, -size * 1.7);
    ctx.fill();
    ctx.strokeStyle = "#827697";
    ctx.moveTo(0, -size);
    ctx.lineTo(0, size * 1.4);
    ctx.stroke();
  } else if (render.shape === "crystal") {
    ctx.moveTo(0, -size * 1.6);
    ctx.lineTo(size * 0.65, size * 0.3);
    ctx.lineTo(-size * 0.3, size);
    ctx.lineTo(-size * 0.65, -size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#476b91";
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.6);
    ctx.lineTo(0, size * 0.3);
    ctx.lineTo(-size * 0.3, size);
    ctx.closePath();
    ctx.fill();
  } else if (render.shape === "rib") {
    ctx.lineWidth = Math.max(1.5, size * 0.35);
    ctx.moveTo(-size * 0.6, size);
    ctx.quadraticCurveTo(-size, -size * 1.5, size * 0.8, -size);
    ctx.stroke();
  } else {
    ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
  }
  ctx.restore();
}

function drawParticles(ctx, particles, spriteCache, detail, dpr) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const particle of particles) {
    const life = particle.components.lifetime;
    const pos = particle.components.position;
    const render = particle.components.render;
    if (!life || !pos || !render) continue;
    const alpha = 1 - life.age / life.life;
    ctx.globalAlpha = Math.max(0, alpha);
    if (render.shape) {
      drawDebris(ctx, pos, render, life.age);
    } else if (detail === "minimal") {
      ctx.fillStyle = render.color;
      ctx.fillRect(pos.x - render.size, pos.y - render.size, render.size * 2, render.size * 2);
    } else {
      const radius = Math.max(1, render.size);
      const sprite = spriteCache.get(render.color, dpr);
      const destinationSize = Math.ceil(radius * 8);
      ctx.drawImage(
        sprite,
        0,
        0,
        sprite.width,
        sprite.height,
        pos.x - destinationSize * 0.5,
        pos.y - destinationSize * 0.5,
        destinationSize,
        destinationSize
      );
    }
  }
  ctx.restore();
}

function drawPlayer(ctx, player, state, resources) {
  ctx.save();
  ctx.translate(player.x, player.y);
  const focused = Boolean(state.input.ShiftLeft || state.input.ShiftRight);
  const pulse = 1 + Math.sin(state.time * 5.2) * 0.04;

  drawGlowCircle(ctx, 0, 15, 30, "rgba(121, 255, 225, 0.55)", 0.42, resources);
  drawGlowCircle(ctx, 0, -2, 24, "rgba(126, 170, 255, 0.35)", 0.28, resources);

  if (focused) {
    drawGlowCircle(ctx, 0, 0, 38, "rgba(120, 255, 225, 0.6)", 0.35, resources);
    ctx.save();
    ctx.rotate(-state.time * 0.8);
    ctx.strokeStyle = "rgba(158,251,255,0.66)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -31);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (player.weaponMode === "orbitals") {
    for (const orbital of getOrbitalOffsets(state.time, focused)) {
      drawGlowCircle(
        ctx,
        orbital.x,
        orbital.y,
        10,
        "rgba(158, 251, 255, 0.4)",
        0.18,
        resources
      );
      ctx.fillStyle = "#d9fbff";
      ctx.beginPath();
      ctx.arc(orbital.x, orbital.y, 4.4, 0, TAU);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const exhaust = 22 + Math.sin(state.time * 12) * 4;
  const exhaustGradient = ctx.createLinearGradient(0, 10, 0, exhaust + 16);
  exhaustGradient.addColorStop(0, "rgba(255,255,255,0.9)");
  exhaustGradient.addColorStop(0.28, "rgba(121,255,225,0.72)");
  exhaustGradient.addColorStop(1, "rgba(105,102,255,0)");
  ctx.fillStyle = exhaustGradient;
  for (const x of [-7, 7]) {
    ctx.beginPath();
    ctx.moveTo(x - 2.4, 9);
    ctx.quadraticCurveTo(x, exhaust, x + Math.sin(state.time * 9 + x) * 2, exhaust + 14);
    ctx.quadraticCurveTo(x + 2.4, exhaust, x + 2.4, 9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.fillStyle = "rgba(7, 19, 39, 0.94)";
  ctx.strokeStyle = "rgba(158, 251, 255, 0.82)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.lineTo(8, -7);
  ctx.lineTo(19, 5);
  ctx.lineTo(11, 17);
  ctx.lineTo(0, 11);
  ctx.lineTo(-11, 17);
  ctx.lineTo(-19, 5);
  ctx.lineTo(-8, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const glass = ctx.createLinearGradient(0, -22, 0, 16);
  glass.addColorStop(0, "rgba(238,255,255,0.98)");
  glass.addColorStop(0.45, "rgba(108,217,255,0.88)");
  glass.addColorStop(1, "rgba(128,107,255,0.62)");
  ctx.fillStyle = glass;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(7, -5);
    ctx.lineTo(16, 5);
    ctx.lineTo(7, 6);
    ctx.lineTo(3, 14);
    ctx.lineTo(0, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = player.weaponMode === "orbitals"
    ? "rgba(255,207,247,0.92)"
    : player.weaponMode === "spread"
      ? "rgba(255,218,142,0.94)"
      : "rgba(121,255,225,0.94)";
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(4.5, 0);
  ctx.lineTo(0, 9);
  ctx.lineTo(-4.5, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(0, -1, 2.4, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

export function createCanvasRenderer(ctx, { createCanvas } = {}) {
  const canvasFactory =
    createCanvas ||
    (typeof document !== "undefined" && typeof document.createElement === "function"
      ? () => document.createElement("canvas")
      : null);
  const bulletSpriteCache = canvasFactory ? createBulletSpriteCache(canvasFactory) : null;
  const particleSpriteCache = canvasFactory ? createParticleSpriteCache(canvasFactory) : null;
  const resources = {
    dpr: 1,
    unitCirclePoints: new Map(),
    glowSprites: canvasFactory ? createGlowSpriteCache(canvasFactory) : null,
    bossHud: canvasFactory ? createBossHudCache(canvasFactory) : null,
  };
  let disposed = false;

  function render(state, player, stages, buckets) {
    if (disposed) return;

    const numericDpr = Number(state.view.dpr);
    resources.dpr = Number.isFinite(numericDpr) && numericDpr > 0 ? numericDpr : 1;
    ctx.setTransform(state.view.dpr, 0, 0, state.view.dpr, 0, 0);
    ctx.clearRect(0, 0, state.view.width, state.view.height);

    if (state.shake > 0) {
      const shake = state.shake;
      ctx.translate(rand(-shake, shake) * 0.3, rand(-shake, shake) * 0.3);
    }

    const bulletCount = buckets.enemyBullets.length + buckets.playerBullets.length;
    const detail = bulletCount > 420 ? "minimal" : bulletCount > 220 ? "medium" : "high";
    state.renderDetail = detail;

    drawPlayfieldFrame(ctx, state);
    if (particleSpriteCache || detail === "minimal") {
      drawParticles(
        ctx,
        buckets.particles,
        particleSpriteCache,
        detail === "minimal" ? "minimal" : "high",
        resources.dpr
      );
    }
    drawBulletTrails(ctx, buckets.enemyBullets, detail);
    if (bulletSpriteCache || detail === "minimal") {
      drawBullets(ctx, buckets.enemyBullets, bulletSpriteCache, detail);
    }
    drawBulletTrails(ctx, buckets.playerBullets, detail === "high" ? "medium" : detail);
    if (bulletSpriteCache || detail === "minimal") {
      drawBullets(ctx, buckets.playerBullets, bulletSpriteCache, detail);
    }
    drawPickups(ctx, buckets.pickups, state, resources);
    drawScoreShards(ctx, buckets.scoreShards, player, resources);
    drawEnemies(ctx, buckets.enemies, state, resources);

    if (state.boss) {
      drawBossByKey(ctx, state, state.boss, resources);
      drawBossWeakpoint(ctx, state.boss, state, resources);
      drawBossUI(ctx, state.boss, state, resources);
    }

    if (!state.over || player.hp > 0) {
      if (player.invuln <= 0 || Math.floor(state.time * 10) % 2 === 0) {
        drawPlayer(ctx, player, state, resources);
      }
    }

    drawPlayerUI(ctx, player, state, stages, resources);

    if (state.over) {
      ctx.save();
      ctx.fillStyle = "rgba(4, 6, 14, 0.42)";
      ctx.fillRect(0, 0, state.view.width, state.view.height);
      ctx.restore();
    }

    if (state.feedback.phase > 0 || state.feedback.loop > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 245, 214, ${state.feedback.phase * 0.08})`;
      ctx.fillRect(0, 0, state.view.width, state.view.height);
      ctx.fillStyle = `rgba(121, 255, 225, ${state.feedback.loop * 0.06})`;
      ctx.fillRect(0, 0, state.view.width, state.view.height);
      ctx.restore();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    bulletSpriteCache?.dispose();
    particleSpriteCache?.dispose();
    resources.glowSprites?.dispose();
    resources.bossHud?.dispose();
    resources.unitCirclePoints.clear();
  }

  return { render, dispose };
}
