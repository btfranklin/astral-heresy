import { addBonusScore, addGrazeCharge, combatTuning, pushBonusText } from "./combat.js";
import { getPowerupDefinition } from "../data/powerups.js";
import { getWeaponDefinition } from "../data/weapons.js";

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

export function createActivePowerupState() {
  return {
    haloShield: 0,
    chainSigil: 0,
    grazeBloom: 0,
    magnetCore: 0,
    pointBlankSeal: 0,
  };
}

export function createPowerupNotice() {
  return {
    title: "",
    roleTag: "",
    category: "utility",
    timer: 0,
    hudTimer: 0,
    ribbonTimer: 0,
    color: "#79ffe1",
    sigil: "hex",
    x: 0,
    y: 0,
  };
}

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
  if (player.weaponMode !== "base") {
    entries.push({
      key: player.weaponMode,
      label: getWeaponDefinition(player.weaponMode).shortLabel,
      category: "weapon",
      timer: player.weaponTimer,
    });
  }

  const catalogMap = {
    haloShield: "halo-shield",
    chainSigil: "chain-sigil",
    grazeBloom: "graze-bloom",
    magnetCore: "magnet-core",
    pointBlankSeal: "point-blank-seal",
  };

  for (const [effectKey, powerupKey] of Object.entries(catalogMap)) {
    if (player.activePowerups[effectKey] > 0) {
      const definition = getPowerupDefinition(powerupKey);
      entries.push({
        key: powerupKey,
        label: definition?.shortLabel || powerupKey,
        category: definition?.category || "utility",
        timer: player.activePowerups[effectKey],
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
