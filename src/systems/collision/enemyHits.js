import { combatTuning } from "../../core/combat.js";
import { getOrbitalOffsets } from "../../core/orbitals.js";
import { damageEnemy, rewardKill } from "../collisionInternals.js";

export function resolveOrbitalEnemyHits({
  state,
  player,
  audio,
  spawnParticle,
  spawnPickupEntity,
  spawnScoreShardEntities,
  buckets,
}) {
  if (
    player.weaponMode !== "orbitals" ||
    state.over ||
    !(state.input.KeyZ || state.input.Space || state.input.PointerFire)
  ) {
    return;
  }

  const focus = Boolean(state.input.ShiftLeft || state.input.ShiftRight);
  const orbitals = getOrbitalOffsets(state.time, focus);
  for (const enemy of buckets.enemies) {
    if (enemy.dead) continue;
    const enemyPos = enemy.components.position;
    const enemyCol = enemy.components.collider;
    const enemyHealth = enemy.components.health;
    const enemyAI = enemy.components.ai;
    if (!enemyPos || !enemyCol || !enemyHealth || !enemyAI || enemyCol.r > 20) continue;

    enemyAI.orbitalCooldown = Math.max(0, (enemyAI.orbitalCooldown || 0) - 0.016);
    if (enemyAI.orbitalCooldown > 0) continue;

    for (const orbital of orbitals) {
      const ox = player.x + orbital.x;
      const oy = player.y + orbital.y;
      const dx = enemyPos.x - ox;
      const dy = enemyPos.y - oy;
      if (dx * dx + dy * dy < (enemyCol.r + combatTuning.orbitalContactRadius) ** 2) {
        enemyAI.orbitalCooldown = combatTuning.orbitalContactCooldown;
        enemyHealth.hp -= combatTuning.orbitalContactDamage;
        spawnParticle(state, ox, oy, "#d9fbff", 8, 120, 0.25, 2);
        if (enemyHealth.hp <= 0) {
          rewardKill(
            state,
            player,
            enemy,
            enemyPos,
            enemyHealth,
            audio,
            spawnParticle,
            spawnPickupEntity,
            spawnScoreShardEntities
          );
        }
        break;
      }
    }
  }
}

export function resolvePlayerBulletEnemyHits({
  state,
  player,
  audio,
  spawnParticle,
  spawnPickupEntity,
  spawnScoreShardEntities,
  buckets,
}) {
  if (state.boss) return;

  for (const enemy of buckets.enemies) {
    if (enemy.dead) continue;
    const enemyPos = enemy.components.position;
    const enemyCol = enemy.components.collider;
    const enemyHealth = enemy.components.health;
    if (!enemyPos || !enemyCol || !enemyHealth) continue;

    for (const bullet of buckets.playerBullets) {
      if (bullet.dead) continue;
      const bulletPos = bullet.components.position;
      const bulletCol = bullet.components.collider;
      const bulletAttack = bullet.components.attack;
      if (!bulletPos || !bulletCol) continue;

      const dx = enemyPos.x - bulletPos.x;
      const dy = enemyPos.y - bulletPos.y;
      if (dx * dx + dy * dy < (enemyCol.r + bulletCol.r) ** 2) {
        damageEnemy(
          state,
          player,
          enemy,
          bullet,
          bulletAttack?.damage ?? 1,
          audio,
          spawnParticle,
          spawnPickupEntity,
          spawnScoreShardEntities
        );
        break;
      }
    }
  }
}

export function resolveEnemyHits(context) {
  resolveOrbitalEnemyHits(context);
  resolvePlayerBulletEnemyHits(context);
}
