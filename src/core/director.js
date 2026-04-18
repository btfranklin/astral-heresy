const DEFAULT_TIERS = [
  { until: Infinity, maxEnemies: 6, maxEnemyBullets: 42 },
];

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
  return {
    gateWave({ enemyCost = 1, bulletCost = 0, priority = "normal" } = {}) {
      const density = state.density || createDensityState();
      const enemyRatio = density.maxEnemies > 0 ? density.liveEnemies / density.maxEnemies : 0;
      const bulletRatio =
        density.maxEnemyBullets > 0 ? density.liveEnemyBullets / density.maxEnemyBullets : 0;
      const saturation = Math.max(enemyRatio, bulletRatio);
      const projectedEnemyRatio =
        density.maxEnemies > 0 ? (density.liveEnemies + enemyCost) / density.maxEnemies : saturation;
      const projectedBulletRatio =
        density.maxEnemyBullets > 0
          ? (density.liveEnemyBullets + bulletCost) / density.maxEnemyBullets
          : saturation;
      const projected = Math.max(projectedEnemyRatio, projectedBulletRatio);

      if (projected < 0.78) {
        return { allow: true, delay: 0, bulletScale: 1, escortScale: 1 };
      }

      if (projected <= 1) {
        const pressure = clampScale((projected - 0.78) / 0.22, 0, 1);
        return {
          allow: true,
          delay: 0,
          bulletScale: clampScale(0.85 - pressure * 0.15, 0.7, 0.85),
          escortScale: projected >= 0.9 || enemyRatio >= 0.88 ? 0 : 1,
        };
      }

      const overPressure = clampScale((projected - 1) / 0.55, 0, 1);
      return {
        allow: false,
        delay: 0.35 + overPressure * 0.55,
        bulletScale: priority === "normal" ? 0.7 : 0.72,
        escortScale: 0,
      };
    },
  };
}

export function createInitialDensityState() {
  return createDensityState();
}
