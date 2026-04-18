export function createEntityBuckets() {
  return {
    enemies: [],
    enemyBullets: [],
    playerBullets: [],
    pickups: [],
    particles: [],
  };
}

export function buildEntityBuckets(state) {
  const buckets = createEntityBuckets();

  for (const entity of state.entities) {
    if (entity.dead) continue;

    switch (entity.type) {
      case "enemy":
        buckets.enemies.push(entity);
        break;
      case "enemyBullet":
        buckets.enemyBullets.push(entity);
        break;
      case "playerBullet":
        buckets.playerBullets.push(entity);
        break;
      case "pickup":
        buckets.pickups.push(entity);
        break;
      case "particle":
        buckets.particles.push(entity);
        break;
      default:
        break;
    }
  }

  return buckets;
}
