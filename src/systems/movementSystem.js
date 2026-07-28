export function updateMovement(state, dt) {
  for (const entity of state.entities) {
    if (entity.dead) continue;
    const pos = entity.components.position;
    const vel = entity.components.velocity;
    if (!pos || !vel) continue;
    pos.x += vel.vx * dt;
    pos.y += vel.vy * dt;
  }
}
