import { rand, TAU } from "../core/math.js";
import { addEntity, createEntity, removeEntity } from "../entities/entityFactory.js";
import { lifetime, position, render, velocity } from "../entities/components.js";

export function spawnParticle(state, x, y, color, count, speed, life, size) {
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
