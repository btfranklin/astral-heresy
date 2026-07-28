function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function ratio(value, maximum) {
  return maximum > 0 ? clamp(value / maximum) : 0;
}

export function projectAudioWorld(state, player, stages) {
  const stage = stages[state.stageIndex] ?? stages.at(-1) ?? null;
  const playfield = state.playfield ?? {};
  const minX = Number.isFinite(playfield.minX) ? playfield.minX : 0;
  const maxX = Number.isFinite(playfield.maxX) && playfield.maxX > minX
    ? playfield.maxX
    : Math.max(minX + 1, state.view?.width || 1);
  const boss = state.boss;
  const enemyDensity = ratio(state.density?.liveEnemies || 0, state.density?.maxEnemies || 1);
  const bulletDensity = ratio(
    state.density?.liveEnemyBullets || 0,
    state.density?.maxEnemyBullets || 1
  );

  return Object.freeze({
    active: Boolean(state.started && !state.showcase && !state.over),
    time: Number.isFinite(state.time) ? state.time : 0,
    stageKey: stage?.key ?? "nebula-gate",
    stageIndex: Math.max(0, state.stageIndex || 0),
    loopIndex: Math.max(0, state.loopIndex || 0),
    hull: Math.max(0, player.hp || 0),
    hullRatio: ratio(player.hp || 0, 5),
    bossKey: boss?.key ?? null,
    bossPhaseIndex: boss?.phaseIndex ?? -1,
    bossProgress: boss ? clamp(1 - boss.hp / Math.max(1, boss.maxHp)) : 0,
    chainRatio: ratio(state.chainLevel || 0, 12),
    grazeRatio: ratio(state.grazeCharge || 0, 100),
    densityRatio: Math.max(enemyDensity, bulletDensity),
    playerX: Number.isFinite(player.x) ? player.x : (minX + maxX) / 2,
    playfieldMinX: minX,
    playfieldMaxX: maxX,
  });
}

export function mergeAudioWorld(base, override) {
  if (!override) return base;
  return Object.freeze({ ...base, ...override });
}

export function panForWorldX(world, x) {
  if (!Number.isFinite(x)) return clamp(world?.playerPan || 0, -1, 1);
  const minX = world?.playfieldMinX ?? 0;
  const maxX = Math.max(minX + 1, world?.playfieldMaxX ?? 1);
  return clamp(((x - minX) / (maxX - minX)) * 2 - 1, -1, 1);
}
