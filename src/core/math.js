export const TAU = Math.PI * 2;

export function rand(min, max, random = Math.random) {
  return min + random() * (max - min);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function wrapAngle(angle) {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= TAU;
  while (wrapped < -Math.PI) wrapped += TAU;
  return wrapped;
}
