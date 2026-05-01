import { combatTuning } from "../../core/combat.js";
import { removeEntity } from "../../entities/entityFactory.js";
import { damagePlayer, maybeGrazeEnemyBullet, triggerBurst } from "../collisionInternals.js";

export function resolvePlayerBurst({
  state,
  player,
  audio,
  spawnParticle,
  advanceBossPhase,
  defeatBoss,
  spawnPickupEntity,
  spawnScoreShardEntities,
  buckets,
}) {
  if (!player.pendingBurst || state.over) return;

  triggerBurst(
    state,
    player,
    audio,
    spawnParticle,
    advanceBossPhase,
    defeatBoss,
    spawnPickupEntity,
    spawnScoreShardEntities,
    buckets
  );
}

export function resolveEnemyContactHazards({ state, player, audio, spawnParticle, buckets }) {
  if (player.invuln > 0 || state.over) return;

  for (const enemy of buckets.enemies) {
    if (enemy.dead) continue;
    const enemyPos = enemy.components.position;
    const enemyCol = enemy.components.collider;
    if (!enemyPos || !enemyCol) continue;

    const dx = player.x - enemyPos.x;
    const dy = player.y - enemyPos.y;
    if (dx * dx + dy * dy < (player.radius + enemyCol.r * 0.9) ** 2) {
      removeEntity(enemy);
      damagePlayer(state, player, audio, spawnParticle, enemyPos.x, enemyPos.y, 36);
      break;
    }
  }
}

export function resolveBossContactHazard({ state, player, audio, spawnParticle }) {
  if (player.invuln > 0 || state.over || !state.boss) return;

  const dx = player.x - state.boss.x;
  const dy = player.y - state.boss.y;
  if (dx * dx + dy * dy < (player.radius + state.boss.r * 0.62) ** 2) {
    damagePlayer(state, player, audio, spawnParticle, state.boss.x, state.boss.y, 44);
  }
}

export function resolveEnemyBulletHazards({ state, player, audio, spawnParticle, buckets }) {
  if (player.invuln > 0 || state.over) return;

  for (const bullet of buckets.enemyBullets) {
    if (bullet.dead) continue;
    const bulletPos = bullet.components.position;
    const bulletCol = bullet.components.collider;
    if (!bulletPos || !bulletCol) continue;

    const dx = player.x - bulletPos.x;
    const dy = player.y - bulletPos.y;
    const distanceSq = dx * dx + dy * dy;
    const hitRadiusSq = (player.radius + bulletCol.r) ** 2;
    const grazeInnerSq = (player.radius + combatTuning.grazeInnerOffset + bulletCol.r) ** 2;
    const grazeOuterSq = (player.radius + combatTuning.grazeOuterOffset + bulletCol.r) ** 2;

    if (distanceSq < hitRadiusSq) {
      removeEntity(bullet);
      damagePlayer(state, player, audio, spawnParticle, player.x, player.y, 30);
      break;
    }
    maybeGrazeEnemyBullet(state, player, audio, bullet, distanceSq, grazeInnerSq, grazeOuterSq);
  }
}

export function resolvePlayerHazards(context) {
  resolveEnemyContactHazards(context);
  resolveBossContactHazard(context);
  resolveEnemyBulletHazards(context);
}
