import { getWeaponDefinition, listWeaponModes } from "./weapons.js";

const categoryStyles = {
  weapon: {
    color: "#9efbff",
    accent: "#f5ffff",
    glowColor: "rgba(158, 251, 255, 0.36)",
    sigil: "diamond",
  },
  utility: {
    color: "#79ffe1",
    accent: "#fff3c8",
    glowColor: "rgba(121, 255, 225, 0.34)",
    sigil: "hex",
  },
  risk: {
    color: "#ff8f8f",
    accent: "#ffd58e",
    glowColor: "rgba(255, 143, 143, 0.34)",
    sigil: "seal",
  },
};

function weaponPickup(key, roleTag, overrides = {}) {
  const weapon = getWeaponDefinition(key);
  const style = categoryStyles.weapon;
  return {
    key,
    category: "weapon",
    label: weapon.label,
    shortLabel: weapon.shortLabel,
    roleTag,
    duration: weapon.duration,
    sigil: overrides.sigil || style.sigil,
    pickupColor: overrides.pickupColor || weapon.pickupColor || style.color,
    pickupAccent: overrides.pickupAccent || weapon.pickupAccent || style.accent,
    glowColor: overrides.glowColor || style.glowColor,
    effect: {
      type: "weapon",
      weaponMode: key,
    },
  };
}

export const powerupDefinitions = {
  spread: weaponPickup("spread", "CROWD CLEAR"),
  pierce: weaponPickup("pierce", "BOSS PRESSURE"),
  beam: weaponPickup("beam", "BOSS PRESSURE"),
  orbitals: weaponPickup("orbitals", "CROWD CLEAR"),
  amplifier: weaponPickup("amplifier", "WEAKPOINT BURN"),
  "burst-cell": {
    key: "burst-cell",
    category: "utility",
    label: "Burst Cell",
    shortLabel: "Burst Cell",
    roleTag: "BURST STOCK +1",
    duration: 0,
    sigil: "hex",
    pickupColor: "#79ffe1",
    pickupAccent: "#fff1ba",
    glowColor: "rgba(121, 255, 225, 0.34)",
    effect: {
      type: "burst-cell",
    },
  },
  "halo-shield": {
    key: "halo-shield",
    category: "utility",
    label: "Halo Shield",
    shortLabel: "Shield",
    roleTag: "BARRIER READY",
    duration: 12,
    sigil: "hex",
    pickupColor: "#bdfdff",
    pickupAccent: "#fff3d9",
    glowColor: "rgba(189, 253, 255, 0.34)",
    effect: {
      type: "active",
      effectKey: "haloShield",
    },
  },
  "chain-sigil": {
    key: "chain-sigil",
    category: "risk",
    label: "Chain Sigil",
    shortLabel: "Sigil",
    roleTag: "CHAIN LOCK",
    duration: 10,
    sigil: "seal",
    pickupColor: "#ffb356",
    pickupAccent: "#fff3ca",
    glowColor: "rgba(255, 179, 86, 0.34)",
    effect: {
      type: "active",
      effectKey: "chainSigil",
    },
  },
  "graze-bloom": {
    key: "graze-bloom",
    category: "utility",
    label: "Graze Bloom",
    shortLabel: "Bloom",
    roleTag: "GRAZE X2",
    duration: 10,
    sigil: "hex",
    pickupColor: "#ff9fda",
    pickupAccent: "#fff2f9",
    glowColor: "rgba(255, 159, 218, 0.34)",
    effect: {
      type: "active",
      effectKey: "grazeBloom",
    },
  },
  "magnet-core": {
    key: "magnet-core",
    category: "utility",
    label: "Magnet Core",
    shortLabel: "Magnet",
    roleTag: "ROUTE LOCK",
    duration: 10,
    sigil: "hex",
    pickupColor: "#8fe8ff",
    pickupAccent: "#effdff",
    glowColor: "rgba(143, 232, 255, 0.34)",
    effect: {
      type: "active",
      effectKey: "magnetCore",
    },
  },
  "point-blank-seal": {
    key: "point-blank-seal",
    category: "risk",
    label: "Point-Blank Seal",
    shortLabel: "Seal",
    roleTag: "DANGER BONUS",
    duration: 10,
    sigil: "seal",
    pickupColor: "#ff8f8f",
    pickupAccent: "#ffd58e",
    glowColor: "rgba(255, 143, 143, 0.36)",
    effect: {
      type: "active",
      effectKey: "pointBlankSeal",
    },
  },
};

const powerupMap = new Map(Object.values(powerupDefinitions).map((definition) => [definition.key, definition]));

export function getPowerupDefinition(key) {
  return powerupMap.get(key) ?? null;
}

export function listPowerupKeys() {
  return Object.keys(powerupDefinitions);
}

export function listWeaponPickupKeys() {
  return listWeaponModes().filter((key) => key !== "base" && powerupMap.has(key));
}

export function getPowerupCategoryStyle(category) {
  return categoryStyles[category] || categoryStyles.utility;
}
