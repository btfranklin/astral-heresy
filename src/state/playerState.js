import { createPlayfield, getPlayfieldCenter } from "./playfieldState.js";

export function createActivePowerupState() {
  return {
    haloShield: 0,
    chainSigil: 0,
    grazeBloom: 0,
    magnetCore: 0,
    pointBlankSeal: 0,
  };
}

export function getPlayerBounds(width, height) {
  const playfield = createPlayfield(width, height);
  const startX = playfield.active ? getPlayfieldCenter(playfield) : width * 0.5;
  const startY = playfield.compactPortrait
    ? Math.min(height * 0.66, playfield.maxY)
    : Math.min(height * 0.82, playfield.maxY);

  return {
    minX: playfield.minX,
    maxX: playfield.maxX,
    minY: playfield.minY,
    maxY: playfield.maxY,
    startX,
    startY,
  };
}

function createDefaults(width, height) {
  const bounds = getPlayerBounds(width, height);
  return {
    x: bounds.startX,
    y: bounds.startY,
    speed: 320,
    focusSpeed: 160,
    radius: 6,
    hp: 5,
    invuln: 0,
    fireCooldown: 0,
    power: 1,
    weaponMode: "base",
    weaponLabel: "Standard",
    weaponTimer: 0,
    pendingBurst: false,
    burstCooldown: 0,
    burstLatch: false,
    activePowerups: createActivePowerupState(),
  };
}

export function createPlayerState(width, height) {
  return createDefaults(width, height);
}

export function resetPlayerState(player, width, height) {
  Object.assign(player, createDefaults(width, height));
  return player;
}
