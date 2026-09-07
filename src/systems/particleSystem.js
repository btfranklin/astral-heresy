import { rand, TAU } from "../core/math.js";
import { addEntity, createEntity, removeEntity } from "../entities/entityFactory.js";
import { lifetime, position, render, velocity } from "../entities/components.js";

export function spawnParticle(state, x, y, color, count, speed, life, size, shape) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * TAU;
    const spd = rand(speed * 0.4, speed);
    addEntity(
      state,
      createEntity("particle", {
        position: position(x, y),
        velocity: velocity(Math.cos(ang) * spd, Math.sin(ang) * spd),
        lifetime: lifetime(life),
        render: render({
          color,
          ...(shape ? { shape, angle: ang, spin: rand(-3, 3) } : {}),
          size: rand(size * 0.6, size),
        }),
      })
    );
  }
}

export function updateParticles(state, dt) {
  for (const entity of state.entities) {
    if (entity.type !== "particle") continue;
    const life = entity.components.lifetime;
    if (!life) continue;
    life.age += dt;
    if (life.age > life.life) {
      removeEntity(entity);
    }
  }
}

const defeatShapes = {
  cherub: "feather", halo: "feather", oracle: "feather", throne: "feather", seraph: "feather",
  shard: "crystal", weaver: "crystal", harp: "crystal", prism: "crystal",
  spear: "rib", fang: "rib", cathedral: "rib",
};

export function spawnDefeatParticles(state, x, y, key, spawn, isBoss = false) {
  const shape = defeatShapes[key];
  const count = isBoss ? 120 : 18;
  const speed = isBoss ? 360 : 220;
  const life = isBoss ? 1.4 : 0.9;
  if (!shape) {
    spawn(state, x, y, isBoss ? "#ffffff" : "#79ffe1", count, speed, life, isBoss ? 4 : 3);
    return;
  }
  const fragments = isBoss ? 36 : 8;
  const color = shape === "feather" ? "#ffe7f6" : shape === "crystal" ? "#9efbff" : "#dacabb";
  spawn(state, x, y, color, fragments, speed * 0.65, life, isBoss ? 9 : 6, shape);
  spawn(state, x, y, shape === "rib" ? "#9c858a" : color,
    count - fragments, speed, life, isBoss ? 4 : 3, shape === "rib" ? "ash" : undefined);
}
