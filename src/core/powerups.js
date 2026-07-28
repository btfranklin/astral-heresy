import { addBonusScore, addGrazeCharge, combatTuning, pushBonusText } from "./combat.js";
import { getPowerupDefinition, listActiveEffectDefinitions } from "../data/powerups.js";
import { getWeaponDefinition } from "../data/weapons.js";
import { createPowerupNotice } from "../state/gameState.js";

export const powerupTuning = {
  pickupNoticeDuration: 0.9,
  pickupFeedDuration: 2.2,
  pickupRibbonDuration: 0.55,
  shieldGraceInvuln: 0.35,
  chainDecayFactor: 0.15,
  grazeBloomMultiplier: 2,
  magnetRadius: 300,
  basePickupRadius: 140,
  pointBlankMultiplier: 2,
  weakpointBrandDuration: 1.25,
  weakpointBrandBonus: 1.35,
  burstCellGrazeFallback: 35,
  scoreShardValue: 55,
};

export function resetPowerupNotice(state) {
  state.powerupNotice = createPowerupNotice();
}

export function getPickupAttractionRadius(player) {
  return player.activePowerups.magnetCore > 0
    ? powerupTuning.magnetRadius
    : powerupTuning.basePickupRadius;
}

export function getGrazeChargeMultiplier(player) {
  return player.activePowerups.grazeBloom > 0 ? powerupTuning.grazeBloomMultiplier : 1;
}

export function getChainDecayFactor(player) {
  return player.activePowerups.chainSigil > 0 ? powerupTuning.chainDecayFactor : 1;
}

export function getCloseRangeBonusMultiplier(player) {
  return player.activePowerups.pointBlankSeal > 0 ? powerupTuning.pointBlankMultiplier : 1;
}

export function hasHaloShield(player) {
  return player.activePowerups.haloShield > 0;
}

export function announcePowerup(state, definition, x, y) {
  state.powerupNotice = {
    title: definition.label,
    roleTag: definition.roleTag,
    category: definition.category,
    timer: powerupTuning.pickupNoticeDuration,
    hudTimer: powerupTuning.pickupFeedDuration,
    ribbonTimer: powerupTuning.pickupRibbonDuration,
    color: definition.pickupColor,
    sigil: definition.sigil,
    x,
    y,
  };
}

export function decayPowerupState(state, player, dt) {
  if (state.powerupNotice) {
    state.powerupNotice.timer = Math.max(0, state.powerupNotice.timer - dt);
    state.powerupNotice.hudTimer = Math.max(0, state.powerupNotice.hudTimer - dt);
    state.powerupNotice.ribbonTimer = Math.max(0, state.powerupNotice.ribbonTimer - dt);
  }

  for (const key of Object.keys(player.activePowerups)) {
    player.activePowerups[key] = Math.max(0, player.activePowerups[key] - dt);
  }
}

export function listActivePowerups(player) {
  const entries = [];
  if (player.weaponMode !== "base" && player.weaponTimer > 0) {
    const weapon = getWeaponDefinition(player.weaponMode);
    entries.push({
      key: weapon.key,
      label: weapon.shortLabel,
      category: "weapon",
      color: weapon.pickupColor,
      duration: weapon.duration,
      sides: weapon.hudSides,
      timer: player.weaponTimer,
    });
  }

  for (const definition of listActiveEffectDefinitions()) {
    const effectKey = definition.effect.effectKey;
    const timer = player.activePowerups[effectKey] || 0;
    if (timer > 0) {
      entries.push({
        key: definition.key,
        label: definition.shortLabel,
        category: definition.category,
        color: definition.pickupColor,
        duration: definition.duration,
        sides: definition.hudSides,
        timer,
      });
    }
  }

  return entries.sort((a, b) => b.timer - a.timer);
}

export function absorbShieldHit(state, player) {
  if (!hasHaloShield(player)) return false;
  player.activePowerups.haloShield = 0;
  player.invuln = Math.max(player.invuln, powerupTuning.shieldGraceInvuln);
  state.feedback.shield = Math.max(state.feedback.shield, 0.65);
  state.shieldOrigin = {
    x: player.x,
    y: player.y,
  };
  pushBonusText(state, "HALO SHIELD SHATTERED", 1.1);
  return true;
}

export function applyPowerupPickup(state, player, key, x, y) {
  const definition = getPowerupDefinition(key);
  if (!definition) return null;

  const effect = definition.effect;
  if (effect.type === "weapon") {
    const weapon = getWeaponDefinition(effect.weaponMode);
    player.weaponMode = effect.weaponMode;
    player.weaponLabel = weapon.shortLabel;
    player.weaponTimer = weapon.duration;
  } else if (effect.type === "active") {
    player.activePowerups[effect.effectKey] = definition.duration;
  } else if (effect.type === "burst-cell") {
    if (state.burstStocks < combatTuning.maxBurstStocks) {
      state.burstStocks += 1;
      pushBonusText(state, "BURST STOCK +1", 1.2);
    } else {
      addGrazeCharge(state, powerupTuning.burstCellGrazeFallback);
      pushBonusText(state, `BURST CELL +${powerupTuning.burstCellGrazeFallback}%`, 1.2);
    }
  }

  announcePowerup(state, definition, x, y);
  addBonusScore(state, "pickup", combatTuning.pickupScore, definition.shortLabel.toUpperCase());
  return definition;
}
