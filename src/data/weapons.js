import { getOrbitalOffsets } from "../core/orbitals.js";

function emitVolley(spawnBullet, player, count, spread, speed, attack) {
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (i - (count - 1) / 2) * spread;
    spawnBullet(player.x, player.y - 12, angle, speed, attack);
  }
}

const weaponDefinitions = {
  base: {
    key: "base",
    label: "Sanctioned Lances",
    shortLabel: "Standard",
    duration: 0,
    pickupColor: "#79ffe1",
    pickupAccent: "#bff8ff",
    cooldown(focus) {
      return focus ? 0.11 : 0.18;
    },
    fire({ spawnBullet, player, focus }) {
      emitVolley(spawnBullet, player, focus ? 2 : 3, focus ? 0.08 : 0.16, 520, {
        damage: 1,
        pierce: 0,
        weaponMode: "base",
        color: "#79ffe1",
        trail: 0.42,
        glow: 1,
      });
    },
  },
  spread: {
    key: "spread",
    label: "Choir Scatter",
    shortLabel: "Spread",
    duration: 10,
    pickupColor: "#ff8fd8",
    pickupAccent: "#fff0fb",
    cooldown(focus) {
      return focus ? 0.1 : 0.13;
    },
    fire({ spawnBullet, player, focus }) {
      emitVolley(spawnBullet, player, focus ? 5 : 7, focus ? 0.18 : 0.3, 500, {
        damage: 0.9,
        pierce: 0,
        weaponMode: "spread",
        color: "#ff8fd8",
        trail: 0.6,
        glow: 1.05,
      });
    },
  },
  pierce: {
    key: "pierce",
    label: "Psalter Lance",
    shortLabel: "Pierce",
    duration: 10,
    pickupColor: "#ffd58e",
    pickupAccent: "#fff3d2",
    cooldown(focus) {
      return focus ? 0.1 : 0.14;
    },
    fire({ spawnBullet, player, focus }) {
      emitVolley(spawnBullet, player, focus ? 3 : 4, focus ? 0.045 : 0.08, 560, {
        damage: focus ? 1.9 : 1.6,
        pierce: focus ? 3 : 2,
        weaponMode: "pierce",
        color: "#ffd58e",
        trail: 0.82,
        glow: 1.18,
        r: 3.4,
      });
    },
  },
  beam: {
    key: "beam",
    label: "Litany Beam",
    shortLabel: "Beam",
    duration: 8,
    pickupColor: "#9efbff",
    pickupAccent: "#f2ffff",
    cooldown(focus) {
      return focus ? 0.045 : 0.06;
    },
    fire({ spawnBullet, player, focus }) {
      emitVolley(spawnBullet, player, focus ? 3 : 5, focus ? 0.03 : 0.065, 640, {
        damage: focus ? 0.9 : 0.7,
        pierce: 1,
        weaponMode: "beam",
        color: "#9efbff",
        trail: 1.35,
        glow: 1.3,
        r: 3.2,
        life: 1.5,
      });
    },
  },
  orbitals: {
    key: "orbitals",
    label: "Censer Orbitals",
    shortLabel: "Orbitals",
    duration: 10,
    pickupColor: "#9efbff",
    pickupAccent: "#fff7d5",
    cooldown(focus) {
      return focus ? 0.08 : 0.11;
    },
    fire({ spawnBullet, player, focus, state }) {
      const orbitals = getOrbitalOffsets(state.time, focus);
      emitVolley(spawnBullet, player, focus ? 2 : 3, focus ? 0.06 : 0.12, 520, {
        damage: 0.85,
        pierce: 0,
        weaponMode: "orbitals",
        color: "#9efbff",
        trail: 0.5,
        glow: 1.04,
      });
      for (const orbital of orbitals) {
        const sweep = Math.sin(state.time * 3.4 + orbital.angle) * (focus ? 0.08 : 0.18);
        spawnBullet(player.x + orbital.x, player.y + orbital.y, -Math.PI / 2 + sweep, 510, {
          damage: 0.8,
          pierce: 0,
          weaponMode: "orbitals",
          color: "#d9fbff",
          trail: 1.08,
          glow: 1.2,
          r: 3.4,
        });
      }
    },
  },
  amplifier: {
    key: "amplifier",
    label: "Weakpoint Amplifier",
    shortLabel: "Amplify",
    duration: 8,
    pickupColor: "#ffd58e",
    pickupAccent: "#fff7d8",
    cooldown(focus) {
      return focus ? 0.055 : 0.075;
    },
    fire({ spawnBullet, player, focus }) {
      emitVolley(spawnBullet, player, focus ? 2 : 3, focus ? 0.018 : 0.04, 690, {
        damage: focus ? 1.15 : 1,
        pierce: 1,
        weaponMode: "amplifier",
        color: "#fff1ad",
        trail: 1.32,
        glow: 1.4,
        r: 3.1,
        bodyDamageMultiplier: 0.6,
        weakpointDamageMultiplier: 2.8,
        weakpointBrandDuration: 1.25,
      });
    },
  },
};

export function getWeaponDefinition(key) {
  return weaponDefinitions[key] || weaponDefinitions.base;
}

export function listWeaponModes() {
  return Object.keys(weaponDefinitions);
}

export function fireWeapon(key, args) {
  const definition = getWeaponDefinition(key);
  definition.fire(args);
  return definition;
}
