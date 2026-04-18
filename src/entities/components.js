export function position(x, y) {
  return { x, y };
}

export function velocity(vx, vy) {
  return { vx, vy };
}

export function collider(r) {
  return { r };
}

export function health(hp) {
  return { hp, maxHp: hp };
}

export function lifetime(life) {
  return { life, age: 0 };
}

export function render(style) {
  return { ...style };
}

export function attack(options = {}) {
  return {
    damage: options.damage ?? 1,
    pierce: options.pierce ?? 0,
    weaponMode: options.weaponMode ?? "base",
    source: options.source ?? "neutral",
    grazed: false,
  };
}

export function bulletMotion(options) {
  return {
    turn: options.turn || 0,
    homing: options.homing || 0,
    wobble: options.wobble || 0,
    seed: options.seed || Math.random() * Math.PI * 2,
  };
}

export function ai(options = {}) {
  return {
    t: 0,
    behavior: options.behavior || null,
    fire: options.fire || null,
    wobble: options.wobble || 0,
    nextShot: 0,
  };
}

export function pickup(options = {}) {
  return {
    kind: options.kind ?? "base",
    duration: options.duration ?? 0,
    label: options.label ?? options.kind ?? "Pickup",
    t: 0,
  };
}

export function reward(options = {}) {
  return {
    elite: Boolean(options.elite),
    dropKey: options.dropKey ?? null,
    scoreBonus: options.scoreBonus ?? 0,
    label: options.label ?? "",
  };
}
