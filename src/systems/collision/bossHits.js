import { powerupTuning } from "../../core/powerups.js";
import { damageBoss } from "../collisionInternals.js";

export function resolveBossHits({
  state,
  player,
  audio,
  spawnParticle,
  advanceBossPhase,
  defeatBoss,
  buckets,
}) {
  if (!state.boss) return;

  const boss = state.boss;
  for (const bullet of buckets.playerBullets) {
    if (bullet.dead) continue;
    const bulletPos = bullet.components.position;
    const bulletCol = bullet.components.collider;
    const bulletAttack = bullet.components.attack;
    if (!bulletPos || !bulletCol) continue;

    const weakpoint = boss.weakpoint;
    const hitWeakpoint =
      weakpoint &&
      (weakpoint.x - bulletPos.x) ** 2 + (weakpoint.y - bulletPos.y) ** 2 <
        (weakpoint.radius + bulletCol.r) ** 2;
    const dx = boss.x - bulletPos.x;
    const dy = boss.y - bulletPos.y;
    const hitBody = dx * dx + dy * dy < (boss.r * 0.75 + bulletCol.r) ** 2;

    if (hitWeakpoint || hitBody) {
      const weakpointBonus = hitWeakpoint && boss.weakpointBrandTimer > 0 ? powerupTuning.weakpointBrandBonus : 1;
      const damage = (bulletAttack?.damage ?? 1) *
        (hitWeakpoint
          ? (bulletAttack?.weakpointDamageMultiplier || weakpoint.damageMultiplier) * weakpointBonus
          : (bulletAttack?.bodyDamageMultiplier || 1));
      damageBoss(
        state,
        player,
        boss,
        bullet,
        damage,
        hitWeakpoint,
        audio,
        spawnParticle,
        advanceBossPhase,
        defeatBoss
      );
    }
  }
}
