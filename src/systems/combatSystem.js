import { combatTuning, resetChain } from "../core/combat.js";
import { getWeaponDefinition } from "../data/weapons.js";

function decayTimer(owner, key, dt) {
  owner[key] = Math.max(0, owner[key] - dt);
}

export function updateCombat(state, player, dt) {
  decayTimer(state, "grazeWindow", dt);
  decayTimer(state, "bonusTimer", dt);
  decayTimer(state, "loopTimer", dt);

  for (const key of Object.keys(state.feedback)) {
    state.feedback[key] = Math.max(0, state.feedback[key] - dt);
  }

  decayTimer(player, "burstCooldown", dt);

  if (player.weaponMode !== "base") {
    player.weaponTimer = Math.max(0, player.weaponTimer - dt);
    if (player.weaponTimer <= 0) {
      player.weaponMode = "base";
    }
  } else {
    player.weaponTimer = 0;
  }

  if (state.chainTimer > 0) {
    state.chainTimer = Math.max(0, state.chainTimer - dt);
    if (state.chainTimer <= 0) {
      resetChain(state);
    }
  }

  if (state.input.KeyX) {
    if (!player.burstLatch && player.burstCooldown <= 0 && state.burstStocks > 0 && !state.over) {
      player.pendingBurst = true;
      player.burstCooldown = combatTuning.burstCooldown;
      player.burstLatch = true;
    }
  } else {
    player.burstLatch = false;
  }

  if (player.weaponMode === "base") {
    player.weaponLabel = getWeaponDefinition("base").shortLabel;
  } else {
    player.weaponLabel = getWeaponDefinition(player.weaponMode).shortLabel;
  }
}
