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
};

export function getWeaponDefinition(key) {
  return weaponDefinitions[key] || weaponDefinitions.base;
}

export function listWeaponModes() {
  return Object.keys(weaponDefinitions);
}

export function getPickupDefinition(key) {
  if (key === "base") return null;
  return weaponDefinitions[key] || null;
}

export function fireWeapon(key, args) {
  const definition = getWeaponDefinition(key);
  definition.fire(args);
  return definition;
}
