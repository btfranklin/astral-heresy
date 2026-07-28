import { resetGameState } from "./gameState.js";
import { resetPlayerState } from "./playerState.js";

export function resetFreshRunState(state, player) {
  resetGameState(state);
  resetPlayerState(player, state.view.width, state.view.height);
  state.input.pointerX = player.x;
  state.input.pointerY = player.y;
  return { state, player };
}

export function resetLoopTransitionState(state, player) {
  state.loopIndex = 1;
  state.stageIndex = 0;
  state.stageTime = 0;
  state.stageState = null;
  state.loopTimer = 2.6;
  state.feedback.loop = Math.max(state.feedback.loop, 1.2);
  state.burstStocks = 1;
  state.grazeCharge = 0;

  player.hp = 5;
  player.invuln = 1.4;
  player.weaponMode = "base";
  player.weaponLabel = "Standard";
  player.weaponTimer = 0;
  player.pendingBurst = false;
  player.burstCooldown = 0;
  player.burstLatch = Boolean(state.input.KeyX);
  for (const key of Object.keys(player.activePowerups)) {
    player.activePowerups[key] = 0;
  }

  return { state, player };
}
