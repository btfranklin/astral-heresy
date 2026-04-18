import { lerp, TAU } from "../core/math.js";

export function emitRadial(spawn, x, y, count, speed, opts = {}) {
  const offset = opts.offset || 0;
  for (let i = 0; i < count; i++) {
    const ang = offset + (i / count) * TAU;
    spawn(x, y, ang, speed, opts);
  }
}

export function emitAimedBurst(spawn, target, x, y, count, spread, speed, opts = {}) {
  const base = Math.atan2(target.y - y, target.x - x);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const ang = base + lerp(-spread, spread, t);
    spawn(x, y, ang, speed, opts);
  }
}

export function emitSpiral(spawn, x, y, count, speed, spin, opts = {}) {
  const offset = opts.offset || 0;
  for (let i = 0; i < count; i++) {
    const ang = offset + i * spin;
    spawn(x, y, ang, speed, opts);
  }
}

export function runCooldown(owner, key, interval, dt, action) {
  const cooldowns = owner.cooldowns || (owner.cooldowns = Object.create(null));
  cooldowns[key] = (cooldowns[key] ?? 0) - dt;
  if (cooldowns[key] <= 0) {
    action();
    cooldowns[key] = interval;
    return true;
  }
  return false;
}

export function resetCooldowns(owner) {
  owner.cooldowns = Object.create(null);
}

export function listPatternHelpers() {
  return ["emitRadial", "emitAimedBurst", "emitSpiral", "runCooldown", "resetCooldowns"];
}
