import { addEntity, createEntity, removeEntity } from "../entities/entityFactory.js";
import { collider, pickup, position, render, reward, scoreShard, velocity } from "../entities/components.js";
import { getPowerupDefinition, getPowerupCategoryStyle } from "../data/powerups.js";
import { getPickupAttractionRadius, powerupTuning } from "../core/powerups.js";
import { clampToLane } from "../state/playfieldState.js";

const referenceFrameRate = 60;

function frameDecay(factor, dt) {
  return factor ** (Math.max(0, dt) * referenceFrameRate);
}

function applyDampedAcceleration(value, factor, acceleration, dt) {
  const decay = frameDecay(factor, dt);
  const referenceFrameAcceleration = acceleration / referenceFrameRate;
  const equilibrium = referenceFrameAcceleration / (1 - factor);
  return equilibrium + (value - equilibrium) * decay;
}

export function spawnPickup(state, kind, x, y, overrides = {}, spawnOptions = {}) {
  const definition = getPowerupDefinition(kind);
  if (!definition) {
    throw new Error(`Unknown pickup kind: ${kind}`);
  }

  const style = getPowerupCategoryStyle(definition.category);
  const radius = overrides.r || 12;
  const laneAware = spawnOptions.laneAware !== false;
  const spawnX = laneAware && state.playfield.active ? clampToLane(state.playfield, x, radius + 10) : x;

  return addEntity(
    state,
    createEntity("pickup", {
      position: position(spawnX, y),
      velocity: velocity(overrides.vx ?? 0, overrides.vy ?? 54),
      collider: collider(radius),
      render: render({
        color: overrides.color || definition.pickupColor,
        accent: overrides.accent || definition.pickupAccent,
        glowColor: overrides.glowColor || definition.glowColor || style.glowColor,
      }),
      pickup: pickup({
        kind,
        duration: definition.duration,
        label: definition.label,
        shortLabel: definition.shortLabel,
        category: definition.category,
        roleTag: definition.roleTag,
        sigil: definition.sigil,
        fallSpeed: overrides.vy ?? 54,
        spawnPause: overrides.spawnPause ?? 0.24,
      }),
      reward: reward({
        elite: false,
        dropKey: kind,
        label: definition.label,
      }),
    })
  );
}

export function spawnScoreShards(state, x, y, count = 4, options = {}, spawnOptions = {}) {
  const shards = [];
  const laneAware = spawnOptions.laneAware !== false;
  const radius = options.r || 8;
  const spawnX = laneAware && state.playfield.active ? clampToLane(state.playfield, x, radius + 6) : x;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / Math.max(1, count) + (options.seedOffset || 0);
    const speed = 52 + i * 12;
    shards.push(
      addEntity(
        state,
        createEntity("scoreShard", {
          position: position(spawnX, y),
          velocity: velocity(Math.cos(angle) * speed, Math.sin(angle) * speed - 20),
          collider: collider(radius),
          render: render({
            color: options.color || "#ffd58e",
            accent: options.accent || "#fff5d9",
            glowColor: "rgba(255, 213, 142, 0.3)",
          }),
          scoreShard: scoreShard({
            value: options.value ?? powerupTuning.scoreShardValue,
            label: options.label || "Shard",
            category: options.category || "utility",
          }),
        })
      )
    );
  }
  return shards;
}

export function updatePickups(state, player, dt) {
  for (const entity of state.entities) {
    if (entity.dead || (entity.type !== "pickup" && entity.type !== "scoreShard")) continue;
    const pos = entity.components.position;
    const vel = entity.components.velocity;
    const item = entity.components.pickup || entity.components.scoreShard;
    if (!pos || !vel || !item) continue;

    item.t += dt;
    if (entity.type === "pickup") {
      vel.vx = Math.sin(item.t * 1.8 + entity.id * 0.14) * 18;
      if (item.spawnPause > 0) {
        const pausedDt = Math.min(item.spawnPause, Math.max(0, dt));
        item.spawnPause = Math.max(0, item.spawnPause - pausedDt);
        vel.vx *= 0.18;
        vel.vy *= frameDecay(0.25, pausedDt);
        if (item.spawnPause === 0) vel.vy = item.fallSpeed;
      }
    } else {
      vel.vx *= frameDecay(0.985, dt);
      vel.vy = applyDampedAcceleration(vel.vy, 0.985, 10, dt);
    }

    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distance = Math.hypot(dx, dy);
    const pullRadius = getPickupAttractionRadius(player);
    if (distance < pullRadius) {
      const pull = Math.max(0, 1 - distance / pullRadius);
      vel.vx += (dx / Math.max(1, distance)) * pull * 180 * dt;
      vel.vy += (dy / Math.max(1, distance)) * pull * 240 * dt;
    }

    const minX = state.playfield.active ? state.playfield.minX - 90 : -80;
    const maxX = state.playfield.active ? state.playfield.maxX + 90 : state.view.width + 80;
    if (pos.y > state.view.height + 90 || pos.x < minX || pos.x > maxX) {
      removeEntity(entity);
    }
  }
}
