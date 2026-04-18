import { addEntity, createEntity, removeEntity } from "../entities/entityFactory.js";
import { ai, collider, health, position, render, reward, velocity } from "../entities/components.js";
import { getEnemyArchetype } from "../data/enemies.js";

export function spawnEnemy(state, archetypeKey, overrides = {}) {
  const archetype = getEnemyArchetype(archetypeKey);
  if (!archetype) {
    throw new Error(`Unknown enemy archetype: ${archetypeKey}`);
  }

  const opts = { ...archetype, ...overrides };
  return addEntity(
    state,
    createEntity("enemy", {
      position: position(opts.x, opts.y),
      velocity: velocity(opts.vx || 0, opts.vy || 40),
      collider: collider(opts.r || 18),
      health: health(opts.hp || 4),
      render: render({
        color: opts.color || "#7ad7ff",
        accent: opts.accent || "#f7ffff",
        renderKey: opts.renderKey || archetype.renderKey,
        glowColor: opts.glowColor || "rgba(120, 255, 230, 0.4)",
      }),
      reward:
        opts.elite || opts.dropKey || opts.scoreBonus
          ? reward({
              elite: opts.elite,
              dropKey: opts.dropKey,
              scoreBonus: opts.scoreBonus,
              label: opts.label,
            })
          : null,
      ai: ai({
        behavior: opts.behavior || null,
        fire: opts.fire || null,
        wobble: opts.wobble || 0,
      }),
    })
  );
}

export function updateEnemies(state, dt) {
  for (const entity of state.entities) {
    if (entity.type !== "enemy") continue;
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

    if (pos.y > state.view.height + 80 || pos.x < -120 || pos.x > state.view.width + 120) {
      removeEntity(entity);
    }
  }
}
