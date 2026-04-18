const DEFAULT_TIERS = [
  { until: Infinity, maxEnemies: 6, maxEnemyBullets: 42 },
];

function createFrameReservations() {
  return {
    enemies: 0,
    enemyBullets: 0,
  };
}

function createDensityState() {
  return {
    liveEnemies: 0,
    liveEnemyBullets: 0,
    maxEnemies: DEFAULT_TIERS[0].maxEnemies,
    maxEnemyBullets: DEFAULT_TIERS[0].maxEnemyBullets,
    saturated: false,
  };
}

function countLiveEntities(state) {
  let liveEnemies = 0;
  let liveEnemyBullets = 0;
  for (const entity of state.entities) {
    if (entity.dead) continue;
    if (entity.type === "enemy") liveEnemies += 1;
    else if (entity.type === "enemyBullet") liveEnemyBullets += 1;
  }
  return { liveEnemies, liveEnemyBullets };
}

function resolveBudget(stage, stageTime, loopIndex) {
  const tiers = Array.isArray(stage?.densityTiers) && stage.densityTiers.length > 0 ? stage.densityTiers : DEFAULT_TIERS;
  const tier = tiers.find((entry) => stageTime < entry.until) || tiers[tiers.length - 1];
  const loopEnemyBonus = loopIndex > 0 ? 1 : 0;
  const loopBulletBonus = loopIndex > 0 ? 8 : 0;
  return {
    maxEnemies: tier.maxEnemies + loopEnemyBonus,
    maxEnemyBullets: tier.maxEnemyBullets + loopBulletBonus,
  };
}

function clampScale(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function reserveWave(frameReservations, enemyCost, bulletCost) {
  frameReservations.enemies += Math.max(0, enemyCost);
  frameReservations.enemyBullets += Math.max(0, bulletCost);
}

export function refreshDensityState(state, stage) {
  const counts = countLiveEntities(state);
  const budget = resolveBudget(stage, state.stageTime, state.loopIndex);
  const saturated =
    counts.liveEnemies >= budget.maxEnemies || counts.liveEnemyBullets >= budget.maxEnemyBullets;
  state.density = {
    liveEnemies: counts.liveEnemies,
    liveEnemyBullets: counts.liveEnemyBullets,
    maxEnemies: budget.maxEnemies,
    maxEnemyBullets: budget.maxEnemyBullets,
    saturated,
  };
  return state.density;
}

export function scaledCount(count, scale, min = 1) {
  if (count <= 0) return 0;
  return Math.max(min, Math.round(count * scale));
}

export function createStageDirector(state) {
  const frameReservations = createFrameReservations();

  return {
    beginFrame() {
      frameReservations.enemies = 0;
      frameReservations.enemyBullets = 0;
    },
    gateWave({ enemyCost = 1, bulletCost = 0, priority = "normal" } = {}) {
      const density = state.density || createDensityState();
      const reservedEnemies = density.liveEnemies + frameReservations.enemies;
      const reservedEnemyBullets = density.liveEnemyBullets + frameReservations.enemyBullets;
      const enemyRatio = density.maxEnemies > 0 ? reservedEnemies / density.maxEnemies : 0;
      const bulletRatio =
        density.maxEnemyBullets > 0 ? reservedEnemyBullets / density.maxEnemyBullets : 0;
      const saturation = Math.max(enemyRatio, bulletRatio);
      const projectedEnemyRatio =
        density.maxEnemies > 0 ? (reservedEnemies + enemyCost) / density.maxEnemies : saturation;
      const projectedBulletRatio =
        density.maxEnemyBullets > 0
          ? (reservedEnemyBullets + bulletCost) / density.maxEnemyBullets
          : saturation;
      const projected = Math.max(projectedEnemyRatio, projectedBulletRatio);

      if (projected < 0.78) {
        reserveWave(frameReservations, enemyCost, bulletCost);
        return { allow: true, delay: 0, bulletScale: 1, escortScale: 1, anchorOnly: false };
      }

      if (projected <= 1) {
        const pressure = clampScale((projected - 0.78) / 0.22, 0, 1);
        const gate = {
          allow: true,
          delay: 0,
          bulletScale: clampScale(0.85 - pressure * 0.15, 0.7, 0.85),
          escortScale: projected >= 0.9 || enemyRatio >= 0.88 ? 0 : 1,
          anchorOnly: false,
        };
        reserveWave(frameReservations, enemyCost, Math.round(bulletCost * gate.bulletScale));
        return gate;
      }

      const overPressure = clampScale((projected - 1) / 0.55, 0, 1);
      const gate = {
        allow: false,
        delay: 0.35 + overPressure * 0.55,
        bulletScale: priority === "normal" ? 0.7 : 0.72,
        escortScale: 0,
        anchorOnly: priority !== "normal" && enemyCost > 0,
      };
      if (gate.anchorOnly) {
        reserveWave(frameReservations, 1, Math.round(bulletCost * gate.bulletScale));
      }
      return gate;
    },
  };
}

export function createInitialDensityState() {
  return createDensityState();
}
