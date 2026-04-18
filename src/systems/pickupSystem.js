import { addEntity, createEntity, removeEntity } from "../entities/entityFactory.js";
import { collider, pickup, position, render, reward, velocity } from "../entities/components.js";
import { getPickupDefinition } from "../data/weapons.js";

export function spawnPickup(state, kind, x, y, overrides = {}) {
  const definition = getPickupDefinition(kind);
  if (!definition) {
    throw new Error(`Unknown pickup kind: ${kind}`);
  }

  return addEntity(
    state,
    createEntity("pickup", {
      position: position(x, y),
      velocity: velocity(overrides.vx || 0, overrides.vy || 54),
      collider: collider(overrides.r || 12),
      render: render({
        color: overrides.color || definition.pickupColor,
        accent: overrides.accent || definition.pickupAccent,
        glowColor: overrides.glowColor || "rgba(255, 255, 255, 0.24)",
      }),
      pickup: pickup({
        kind,
        duration: definition.duration,
        label: definition.label,
      }),
      reward: reward({
        elite: false,
        dropKey: kind,
        label: definition.label,
      }),
    })
  );
}

export function updatePickups(state, player, dt) {
  for (const entity of state.entities) {
    if (entity.type !== "pickup") continue;
    const pos = entity.components.position;
    const vel = entity.components.velocity;
    const item = entity.components.pickup;
    if (!pos || !vel || !item) continue;

    item.t += dt;
    vel.vx = Math.sin(item.t * 1.8 + entity.id * 0.14) * 18;

    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 140) {
      const pull = Math.max(0, 1 - distance / 140);
      vel.vx += (dx / Math.max(1, distance)) * pull * 180 * dt;
      vel.vy += (dy / Math.max(1, distance)) * pull * 240 * dt;
    }

    if (pos.y > state.view.height + 90 || pos.x < -80 || pos.x > state.view.width + 80) {
      removeEntity(entity);
    }
  }
}
