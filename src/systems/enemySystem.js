import { addEntity, createEntity, removeEntity } from "../entities/entityFactory.js";
import { ai, collider, health, position, render, reward, velocity } from "../entities/components.js";
import { getEnemyArchetype } from "../data/enemies.js";
import { clampToEnemyEnvelope } from "../state/playfieldState.js";

export function spawnEnemy(state, archetypeKey, overrides = {}, spawnOptions = {}) {
  const archetype = getEnemyArchetype(archetypeKey);
  if (!archetype) {
    throw new Error(`Unknown enemy archetype: ${archetypeKey}`);
  }

  const opts = { ...archetype, ...overrides };
  const laneAware = spawnOptions.laneAware !== false;
  const radius = opts.r ?? 18;
  const spawnX =
    laneAware && state.playfield.active
      ? clampToEnemyEnvelope(state.playfield, opts.x, radius + 40)
      : opts.x;
  return addEntity(
    state,
    createEntity("enemy", {
      position: position(spawnX, opts.y),
      velocity: velocity(opts.vx ?? 0, opts.vy ?? 40),
      collider: collider(radius),
      health: health(opts.hp ?? 4),
      render: render({
        color: opts.color || "#7ad7ff",
        accent: opts.accent || "#f7ffff",
        renderKey: opts.renderKey || archetype.renderKey,
        glowColor: opts.glowColor || "rgba(120, 255, 230, 0.4)",
      }),
      reward:
        opts.elite || opts.risk || opts.dropKey || opts.scoreBonus || opts.scoreShardCount
          ? reward({
              elite: opts.elite,
              risk: opts.risk,
              dropKey: opts.dropKey,
              scoreBonus: opts.scoreBonus,
              scoreShardCount: opts.scoreShardCount,
              label: opts.label,
            })
          : null,
      ai: ai({
        behavior: opts.behavior || null,
        fire: opts.fire || null,
        wobble: opts.wobble ?? 0,
      }),
    })
  );
}

export function updateEnemies(state, dt) {
  for (const entity of state.entities) {
    if (entity.type !== "enemy" || entity.dead) continue;
    const enemyAI = entity.components.ai;
    const pos = entity.components.position;
    const vel = entity.components.velocity;
    if (!enemyAI || !pos || !vel) continue;

    enemyAI.t += dt;

    if (enemyAI.behavior) {
      enemyAI.behavior(entity, dt, state);
    }

    if (enemyAI.fire) {
      enemyAI.fire(entity, dt, state);
    }

    if (state.playfield.active) {
      const lanePadding = Math.max(28, (entity.components.collider?.r || 18) + 14);
      const minX = state.playfield.minX - lanePadding;
      const maxX = state.playfield.maxX + lanePadding;
      if (pos.x < minX) {
        pos.x = minX;
        vel.vx = Math.max(28, Math.abs(vel.vx) * 0.45 + 28);
      } else if (pos.x > maxX) {
        pos.x = maxX;
        vel.vx = -Math.max(28, Math.abs(vel.vx) * 0.45 + 28);
      }
    }

    const minX = state.playfield.active ? state.playfield.minX - 160 : -120;
    const maxX = state.playfield.active ? state.playfield.maxX + 160 : state.view.width + 120;
    if (pos.y > state.view.height + 80 || pos.x < minX || pos.x > maxX) {
      removeEntity(entity);
    }
  }
}
