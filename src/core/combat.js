export const combatTuning = {
  maxGrazeCharge: 100,
  maxBurstStocks: 2,
  grazeInnerOffset: 6,
  grazeOuterOffset: 18,
  grazeChargePerBullet: 5,
  grazeScore: 20,
  grazeComboWindow: 1.35,
  chainWindow: 2.25,
  chainMax: 12,
  chainStep: 0.15,
  closeRangeNear: 90,
  closeRangeMid: 140,
  closeRangeNearBonus: 160,
  closeRangeMidBonus: 80,
  grazeKillBonus: 45,
  burstRadius: 180,
  burstEnemyDamage: 10,
  burstBossDamage: 48,
  burstInvuln: 0.75,
  burstCooldown: 0.35,
  burstChargeCost: 100,
  burstBulletScore: 4,
  phaseBreakBaseScore: 800,
  bossDefeatScore: 3200,
  eliteBonus: 450,
  pickupScore: 220,
  weakpointDefaultBonus: 18,
  orbitalContactDamage: 0.6,
  orbitalContactRadius: 10,
  orbitalContactCooldown: 0.14,
};

export function getChainMultiplier(level) {
  return 1 + Math.min(combatTuning.chainMax, Math.max(0, level)) * combatTuning.chainStep;
}

export function pushBonusText(state, text, duration = 1.05) {
  state.bonusText = text;
  state.bonusTimer = Math.max(state.bonusTimer, duration);
}

export function addBonusScore(state, key, amount, label = "") {
  const rounded = Math.max(0, Math.round(amount));
  if (rounded <= 0) return 0;
  state.score += rounded;
  if (key && state.scoreBonuses) {
    state.scoreBonuses[key] = (state.scoreBonuses[key] || 0) + rounded;
  }
  if (label) {
    pushBonusText(state, `${label} +${rounded}`);
  }
  return rounded;
}

export function addGrazeCharge(state, amount) {
  state.grazeCharge = Math.min(combatTuning.maxGrazeCharge, state.grazeCharge + amount);
}

export function maybeRechargeBurst(state) {
  while (
    state.grazeCharge >= combatTuning.burstChargeCost &&
    state.burstStocks < combatTuning.maxBurstStocks
  ) {
    state.grazeCharge -= combatTuning.burstChargeCost;
    state.burstStocks += 1;
    state.feedback.burst = Math.max(state.feedback.burst, 0.55);
    pushBonusText(state, "BURST STOCK +1", 1.15);
  }
}

export function registerGraze(state, player) {
  const grazeMultiplier = player?.activePowerups?.grazeBloom > 0 ? 2 : 1;
  addGrazeCharge(state, combatTuning.grazeChargePerBullet * grazeMultiplier);
  addBonusScore(state, "graze", combatTuning.grazeScore, "GRAZE");
  state.grazeWindow = combatTuning.grazeComboWindow;
  state.feedback.graze = Math.max(state.feedback.graze, 0.45);
  maybeRechargeBurst(state);
}

export function extendChain(state, strength = 1) {
  state.chainLevel = Math.min(combatTuning.chainMax, state.chainLevel + strength);
  state.chainTimer = combatTuning.chainWindow;
  state.feedback.chain = Math.max(state.feedback.chain, 0.45);
}

export function resetChain(state) {
  state.chainLevel = 0;
  state.chainTimer = 0;
}

export function getCloseRangeBonus(distance, multiplier = 1) {
  if (distance <= combatTuning.closeRangeNear) return Math.round(combatTuning.closeRangeNearBonus * multiplier);
  if (distance <= combatTuning.closeRangeMid) return Math.round(combatTuning.closeRangeMidBonus * multiplier);
  return 0;
}
