import { combatTuning } from "../core/combat.js";

export function resolveWeakpoint(boss, phase) {
  const weakpoint = phase?.weakpoint;
  if (!weakpoint) return null;

  const interval = Math.max(weakpoint.interval || 999, weakpoint.duration || 0.1);
  const offset = weakpoint.offset || { x: 0, y: 0 };
  const windowTime = (boss.phaseTime + (weakpoint.timeOffset || 0)) % interval;
  if (windowTime > (weakpoint.duration || 0)) {
    return null;
  }

  const rotation = (weakpoint.rotationSpeed || 0) * boss.phaseTime;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const ox = (offset.x || 0) * cos - (offset.y || 0) * sin;
  const oy = (offset.x || 0) * sin + (offset.y || 0) * cos;

  return {
    x: boss.x + ox,
    y: boss.y + oy,
    radius: weakpoint.radius || boss.r * 0.2,
    damageMultiplier: weakpoint.damageMultiplier || 2,
    bonusScore: weakpoint.bonusScore || combatTuning.weakpointDefaultBonus,
    color: weakpoint.color || "#fff5d6",
    pulse: weakpoint.pulse || 0,
  };
}
