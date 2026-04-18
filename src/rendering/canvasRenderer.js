import { rand, TAU } from "../core/math.js";
import { drawGlowCircle } from "./drawHelpers.js";
import { drawBossByKey } from "./bossRenderers.js";
import { drawBossUI, drawPlayerUI } from "./hudRenderer.js";
import { drawEnemy } from "./enemyRenderers.js";

function createSpriteCache() {
  const cache = new Map();
  return {
    get(color, radius) {
      const key = `${color}:${radius}`;
      if (cache.has(key)) return cache.get(key);

      const size = Math.ceil(radius * 8);
      const sprite = document.createElement("canvas");
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
  };
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

function drawEnemies(ctx, enemies, state) {
  for (const enemy of enemies) {
    drawEnemy(ctx, enemy, state);
  }
}

function drawParticles(ctx, particles, spriteCache, detail) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const particle of particles) {
    const life = particle.components.lifetime;
    const pos = particle.components.position;
    const render = particle.components.render;
    if (!life || !pos || !render) continue;
    const alpha = 1 - life.age / life.life;
    ctx.globalAlpha = Math.max(0, alpha);
    if (detail === "minimal") {
      ctx.fillStyle = render.color;
      ctx.fillRect(pos.x - render.size, pos.y - render.size, render.size * 2, render.size * 2);
    } else {
      const sprite = spriteCache.get(render.color, Math.max(1, render.size));
      ctx.drawImage(sprite, pos.x - sprite.width * 0.5, pos.y - sprite.height * 0.5);
    }
  }
  ctx.restore();
}

function drawPlayer(ctx, player, input) {
  ctx.save();
  ctx.translate(player.x, player.y);

  drawGlowCircle(ctx, 0, 20, 18, "rgba(121, 255, 225, 0.5)", 0.45);

  if (input.ShiftLeft || input.ShiftRight) {
    drawGlowCircle(ctx, 0, 0, 34, "rgba(120, 255, 225, 0.6)", 0.35);
  }

  ctx.fillStyle = "rgba(126, 212, 255, 0.92)";
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(13, 12);
  ctx.lineTo(0, 8);
  ctx.lineTo(-13, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(190, 247, 255, 0.84)";
  ctx.beginPath();
  ctx.moveTo(-16, 6);
  ctx.lineTo(-3, -2);
  ctx.lineTo(-6, 15);
  ctx.closePath();
  ctx.moveTo(16, 6);
  ctx.lineTo(3, -2);
  ctx.lineTo(6, 15);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, TAU);
  ctx.fill();

  ctx.restore();
}

export function createCanvasRenderer(ctx) {
  const bulletSpriteCache = createSpriteCache();
  const particleSpriteCache = createSpriteCache();

  function render(state, player, stages, buckets) {
    ctx.setTransform(state.view.dpr, 0, 0, state.view.dpr, 0, 0);
    ctx.clearRect(0, 0, state.view.width, state.view.height);

    if (state.shake > 0) {
      const shake = state.shake;
      ctx.translate(rand(-shake, shake) * 0.3, rand(-shake, shake) * 0.3);
      state.shake = Math.max(0, state.shake - 0.7);
    }

    const bulletCount = buckets.enemyBullets.length + buckets.playerBullets.length;
    const detail = bulletCount > 420 ? "minimal" : bulletCount > 220 ? "medium" : "high";
    state.renderDetail = detail;

    drawParticles(ctx, buckets.particles, particleSpriteCache, detail === "minimal" ? "minimal" : "high");
    drawBulletTrails(ctx, buckets.enemyBullets, detail);
    drawBullets(ctx, buckets.enemyBullets, bulletSpriteCache, detail);
    drawBulletTrails(ctx, buckets.playerBullets, detail === "high" ? "medium" : detail);
    drawBullets(ctx, buckets.playerBullets, bulletSpriteCache, detail);
    drawEnemies(ctx, buckets.enemies, state);

    if (state.boss) {
      drawBossByKey(ctx, state, state.boss);
      drawBossUI(ctx, state.boss, state);
    }

    if (!state.over || player.hp > 0) {
      if (player.invuln <= 0 || Math.floor(state.time * 10) % 2 === 0) {
        drawPlayer(ctx, player, state.input);
      }
    }

    drawPlayerUI(ctx, player, state, stages);

    if (state.over) {
      ctx.save();
      ctx.fillStyle = "rgba(4, 6, 14, 0.42)";
      ctx.fillRect(0, 0, state.view.width, state.view.height);
      ctx.restore();
    }
  }

  return { render };
}
