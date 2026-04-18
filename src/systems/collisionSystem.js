import { removeEntity } from "../entities/entityFactory.js";
import { addBonusScore, combatTuning } from "../core/combat.js";
import {
  getPickupAttractionRadius,
  powerupTuning,
} from "../core/powerups.js";
import { getOrbitalOffsets } from "../core/orbitals.js";
import {
  collectPickup,
  collectScoreShard,
  damageBoss,
  damageEnemy,
  damagePlayer,
  maybeGrazeEnemyBullet,
  rewardKill,
  triggerBurst,
} from "./collisionInternals.js";

export function handleCollisions(
  state,
  player,
  audio,
  spawnParticle,
  advanceBossPhase,
  defeatBoss,
  spawnPickupEntity,
  spawnScoreShardEntities,
  buckets
) {
  const enemies = buckets.enemies;
  const playerBullets = buckets.playerBullets;
  const enemyBullets = buckets.enemyBullets;
  const pickups = buckets.pickups;
  const scoreShards = buckets.scoreShards;

  if (player.pendingBurst && !state.over) {
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

  if (
    player.weaponMode === "orbitals" &&
    !state.over &&
    (state.input.KeyZ || state.input.Space || state.input.PointerFire)
  ) {
    const orbitals = getOrbitalOffsets(state.time, Boolean(state.input.ShiftLeft || state.input.ShiftRight));
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const enemyPos = enemy.components.position;
      const enemyCol = enemy.components.collider;
      const enemyHealth = enemy.components.health;
      const enemyAI = enemy.components.ai;
      if (!enemyPos || !enemyCol || !enemyHealth || enemyCol.r > 20) continue;
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

  if (!state.boss) {
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const enemyPos = enemy.components.position;
      const enemyCol = enemy.components.collider;
      const enemyHealth = enemy.components.health;
      if (!enemyPos || !enemyCol || !enemyHealth) continue;

      for (const bullet of playerBullets) {
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

  if (state.boss) {
    const boss = state.boss;
    for (const bullet of playerBullets) {
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

  for (const pickupEntity of pickups) {
    if (pickupEntity.dead) continue;
    const pickupPos = pickupEntity.components.position;
    const pickupCol = pickupEntity.components.collider;
    const pickupComp = pickupEntity.components.pickup;
    if (!pickupPos || !pickupCol || !pickupComp) continue;
    const dx = player.x - pickupPos.x;
    const dy = player.y - pickupPos.y;
    if (dx * dx + dy * dy < (player.radius + pickupCol.r) ** 2) {
      collectPickup(state, player, audio, pickupEntity);
    }
  }

  const shardRadius = getPickupAttractionRadius(player);
  for (const shard of scoreShards) {
    if (shard.dead) continue;
    const pos = shard.components.position;
    const col = shard.components.collider;
    const shardComp = shard.components.scoreShard;
    if (!pos || !col || !shardComp) continue;
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    if (dx * dx + dy * dy < Math.max((player.radius + col.r) ** 2, shardRadius ** 2 * 0.1)) {
      collectScoreShard(state, shard);
    }
  }

  if (player.invuln <= 0 && !state.over) {
    for (const enemy of enemies) {
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

  if (player.invuln <= 0 && !state.over && state.boss) {
    const dx = player.x - state.boss.x;
    const dy = player.y - state.boss.y;
    if (dx * dx + dy * dy < (player.radius + state.boss.r * 0.62) ** 2) {
      damagePlayer(state, player, audio, spawnParticle, state.boss.x, state.boss.y, 44);
    }
  }

  if (player.invuln <= 0 && !state.over) {
    for (const bullet of enemyBullets) {
      if (bullet.dead) continue;
      const bulletPos = bullet.components.position;
      const bulletCol = bullet.components.collider;
      const bulletAttack = bullet.components.attack;
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

  player.pendingBurst = false;
}
