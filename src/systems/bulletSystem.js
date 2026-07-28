import { wrapAngle } from "../core/math.js";
import { getBulletEnvelope } from "../state/playfieldState.js";
import { addEntity, createEntity, removeEntity } from "../entities/entityFactory.js";
import { attack, bulletMotion, collider, lifetime, position, render, velocity } from "../entities/components.js";

export function spawnEnemyBullet(state, x, y, angle, speed, opts = {}) {
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  return addEntity(
    state,
    createEntity("enemyBullet", {
      position: position(x, y),
      velocity: velocity(vx, vy),
      collider: collider(opts.r || 4),
      lifetime: lifetime(opts.life || 12),
      render: render({
        color: opts.color || "#ff6ad5",
        trail: opts.trail || 0.5,
        glow: opts.glow || 1,
      }),
      attack: attack({
        damage: opts.damage ?? 1,
        source: "enemy",
      }),
      bullet: bulletMotion(opts),
    })
  );
}

export function spawnPlayerBullet(state, x, y, angle, speed, opts = {}) {
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  state.shotsFired += 1;
  return addEntity(
    state,
    createEntity("playerBullet", {
      position: position(x, y),
      velocity: velocity(vx, vy),
      collider: collider(opts.r || 3),
      lifetime: lifetime(opts.life || 2.6),
      render: render({
        color: opts.color || "#79ffe1",
        trail: opts.trail || 0.5,
        glow: opts.glow || 1,
      }),
      attack: attack({
        damage: opts.damage ?? 1,
        pierce: opts.pierce ?? 0,
        weaponMode: opts.weaponMode ?? "base",
        bodyDamageMultiplier: opts.bodyDamageMultiplier,
        weakpointDamageMultiplier: opts.weakpointDamageMultiplier,
        weakpointBrandDuration: opts.weakpointBrandDuration,
        source: "player",
      }),
      bullet: bulletMotion({}),
    })
  );
}

export function updateBullets(state, player, dt) {
  for (const entity of state.entities) {
    if (entity.dead) continue;
    if (entity.type !== "enemyBullet" && entity.type !== "playerBullet") continue;
    const vel = entity.components.velocity;
    const bullet = entity.components.bullet;
    const life = entity.components.lifetime;

    if (!vel || !bullet || !life) continue;

    life.age += dt;

    if (bullet.turn) {
      const speed = Math.hypot(vel.vx, vel.vy);
      const ang = Math.atan2(vel.vy, vel.vx) + bullet.turn * dt;
      vel.vx = Math.cos(ang) * speed;
      vel.vy = Math.sin(ang) * speed;
    }

    if (bullet.homing && player && entity.type === "enemyBullet") {
      const desired = Math.atan2(player.y - entity.components.position.y, player.x - entity.components.position.x);
      const ang = Math.atan2(vel.vy, vel.vx);
      const diff = wrapAngle(desired - ang);
      const speed = Math.hypot(vel.vx, vel.vy);
      const newAng = ang + diff * bullet.homing * dt;
      vel.vx = Math.cos(newAng) * speed;
      vel.vy = Math.sin(newAng) * speed;
    }

    if (bullet.wobble) {
      const speed = Math.hypot(vel.vx, vel.vy);
      const ang = Math.atan2(vel.vy, vel.vx);
      const offset = Math.sin(life.age * bullet.wobble + bullet.seed) * 0.6;
      vel.vx = Math.cos(ang + offset * dt) * speed;
      vel.vy = Math.sin(ang + offset * dt) * speed;
    }
  }
}

export function cleanupBullets(state) {
  const margin = 80;
  const height = state.view.height;
  const envelope = getBulletEnvelope(state.playfield, state.view.width);

  for (const entity of state.entities) {
    if (entity.type !== "enemyBullet" && entity.type !== "playerBullet") continue;
    const pos = entity.components.position;
    const life = entity.components.lifetime;
    if (!pos || !life) continue;

    if (
      life.age > life.life ||
      pos.x < envelope.minX ||
      pos.x > envelope.maxX ||
      pos.y < -margin ||
      pos.y > height + margin
    ) {
      removeEntity(entity);
    }
  }
}
