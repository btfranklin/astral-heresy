import { removeEntity } from "../entities/entityFactory.js";
import {
  addBonusScore,
  combatTuning,
  extendChain,
  getChainMultiplier,
  getCloseRangeBonus,
  registerGraze,
} from "../core/combat.js";
import {
  absorbShieldHit,
  applyPowerupPickup,
  getCloseRangeBonusMultiplier,
  getPickupAttractionRadius,
  powerupTuning,
} from "../core/powerups.js";
import { getOrbitalOffsets } from "../core/orbitals.js";
import {
  sfxBurst,
  sfxChain,
  sfxEnemyPop,
  sfxGraze,
  sfxPickup,
  sfxPlayerHit,
  sfxWeakpoint,
} from "../audio/sfx.js";

function damagePlayer(state, player, audio, spawnParticle, x, y, intensity = 30) {
  if (absorbShieldHit(state, player)) {
    spawnParticle(state, x, y, "#d8faff", intensity + 18, 300, 0.72, 4);
    return;
  }
  player.hp -= 1;
  player.invuln = 1.2;
  state.shake = Math.max(state.shake, 10);
  sfxPlayerHit(audio);
  spawnParticle(state, x, y, "#ff6ad5", intensity, 260, 0.7, 3);
  if (player.hp <= 0) {
    state.over = true;
  }
}

function spendPlayerBullet(bullet) {
  const attack = bullet.components.attack;
  if (attack && attack.pierce > 0) {
    attack.pierce -= 1;
    return;
  }
  removeEntity(bullet);
}

function rewardKill(
  state,
  player,
  enemy,
  enemyPos,
  enemyHealth,
  audio,
  spawnParticle,
  spawnPickupEntity,
  spawnScoreShardEntities
) {
  const reward = enemy.components.reward;
  spawnParticle(state, enemyPos.x, enemyPos.y, "#79ffe1", 18, 220, 0.9, 3);
  sfxEnemyPop(audio);
  state.kills += 1;
  state.score += enemyHealth.maxHp * 140;
  extendChain(state);

  const chainBonus = Math.round((enemyHealth.maxHp * 140) * (getChainMultiplier(state.chainLevel) - 1));
  addBonusScore(state, "chain", chainBonus, "CHAIN");

  const distance = Math.hypot(player.x - enemyPos.x, player.y - enemyPos.y);
  const closeBonus = getCloseRangeBonus(distance, getCloseRangeBonusMultiplier(player));
  if (closeBonus > 0) {
    addBonusScore(state, "close", closeBonus, "PRESSURE");
    if (player.activePowerups.pointBlankSeal > 0) {
      spawnParticle(state, enemyPos.x, enemyPos.y, "#ffb46e", 20, 250, 0.75, 4);
    }
  }
  if (state.grazeWindow > 0) {
    addBonusScore(state, "close", combatTuning.grazeKillBonus, "FLOW");
  }
  if (reward?.elite) {
    addBonusScore(
      state,
      "elite",
      combatTuning.eliteBonus + (reward.scoreBonus || 0),
      "ELITE"
    );
    if (state.chainLevel % 4 === 0 || state.chainLevel >= combatTuning.chainMax) {
      sfxChain(audio);
    }
  } else if (reward?.scoreBonus) {
    addBonusScore(state, "elite", reward.scoreBonus, reward.label || "REWARD");
  }
  if (reward?.dropKey) {
    spawnPickupEntity(reward.dropKey, enemyPos.x, enemyPos.y, {});
  }
  if (reward?.elite || reward?.risk || reward?.scoreShardCount > 0) {
    spawnScoreShardEntities(enemyPos.x, enemyPos.y, reward?.scoreShardCount || (reward?.elite ? 5 : 4), {
      category: reward?.risk ? "risk" : (reward?.elite ? "weapon" : "utility"),
      label: reward?.label || "Shard",
      color: reward?.risk ? "#ff9a6a" : "#ffd58e",
      accent: reward?.risk ? "#ffdcb7" : "#fff6dd",
    });
  }

  removeEntity(enemy);
}

function damageEnemy(
  state,
  player,
  enemy,
  bullet,
  damage,
  audio,
  spawnParticle,
  spawnPickupEntity,
  spawnScoreShardEntities
) {
  const enemyPos = enemy.components.position;
  const enemyHealth = enemy.components.health;
  if (!enemyPos || !enemyHealth) return;

  state.shotsHit += 1;
  enemyHealth.hp -= damage;
  spendPlayerBullet(bullet);
  spawnParticle(state, enemyPos.x, enemyPos.y, "#ffffff", 6, 120, 0.4, 2);
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
}

function damageBoss(
  state,
  player,
  boss,
  bullet,
  damage,
  weakpointHit,
  audio,
  spawnParticle,
  advanceBossPhase,
  defeatBoss
) {
  state.shotsHit += 1;
  boss.hp -= damage;
  boss.phaseHp -= damage;
  spendPlayerBullet(bullet);
  if (weakpointHit) {
    addBonusScore(state, "weakpoint", boss.weakpoint?.bonusScore || combatTuning.weakpointDefaultBonus, "WEAKPOINT");
    state.feedback.weakpoint = Math.max(state.feedback.weakpoint, 0.5);
    state.shake = Math.max(state.shake, 8);
    sfxWeakpoint(audio);
    if (bullet.components.attack?.weakpointBrandDuration > 0) {
      boss.weakpointBrandTimer = Math.max(
        boss.weakpointBrandTimer || 0,
        bullet.components.attack.weakpointBrandDuration
      );
      state.feedback.weakpoint = Math.max(state.feedback.weakpoint, 0.72);
    }
    spawnParticle(state, boss.weakpoint.x, boss.weakpoint.y, "#fff5d6", 16, 180, 0.45, 3);
  } else {
    spawnParticle(state, boss.x, boss.y, "#ffe7f6", 4, 100, 0.3, 2);
  }
  if (boss.phaseHp <= 0) {
    advanceBossPhase(state, boss, spawnParticle, audio);
  }
  if (boss.hp <= 0) {
    defeatBoss(state, player, boss, spawnParticle, audio);
  }
}

function triggerBurst(
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
  player.pendingBurst = false;
  if (state.burstStocks <= 0) return;

  state.burstStocks -= 1;
  player.invuln = Math.max(player.invuln, combatTuning.burstInvuln);
  state.feedback.burst = Math.max(state.feedback.burst, 0.65);
  state.burstOrigin = {
    x: player.x,
    y: player.y,
  };
  state.shake = Math.max(state.shake, 16);
  sfxBurst(audio);
  spawnParticle(state, player.x, player.y, "#9efbff", 48, 260, 0.75, 4);

  let clearedBullets = 0;
  const radiusSq = combatTuning.burstRadius ** 2;

  for (const bullet of buckets.enemyBullets) {
    if (bullet.dead) continue;
    const pos = bullet.components.position;
    if (!pos) continue;
    const dx = pos.x - player.x;
    const dy = pos.y - player.y;
    if (dx * dx + dy * dy <= radiusSq) {
      removeEntity(bullet);
      clearedBullets += 1;
    }
  }

  for (const enemy of buckets.enemies) {
    if (enemy.dead) continue;
    const pos = enemy.components.position;
    const health = enemy.components.health;
    if (!pos || !health) continue;
    const dx = pos.x - player.x;
    const dy = pos.y - player.y;
    if (dx * dx + dy * dy <= radiusSq) {
      health.hp -= combatTuning.burstEnemyDamage;
      spawnParticle(state, pos.x, pos.y, "#9efbff", 10, 150, 0.3, 2);
      if (health.hp <= 0) {
        rewardKill(
          state,
          player,
          enemy,
          pos,
          health,
          audio,
          spawnParticle,
          spawnPickupEntity,
          spawnScoreShardEntities
        );
      }
    }
  }

  if (state.boss) {
    const dx = state.boss.x - player.x;
    const dy = state.boss.y - player.y;
    if (dx * dx + dy * dy <= radiusSq) {
      state.boss.hp -= combatTuning.burstBossDamage;
      state.boss.phaseHp -= combatTuning.burstBossDamage;
      spawnParticle(state, state.boss.x, state.boss.y, "#9efbff", 16, 180, 0.4, 3);
      if (state.boss.phaseHp <= 0) {
        advanceBossPhase(state, state.boss, spawnParticle, audio);
      }
      if (state.boss.hp <= 0) {
        defeatBoss(state, player, state.boss, spawnParticle, audio);
      }
    }
  }

  if (clearedBullets > 0) {
    addBonusScore(state, "burst", clearedBullets * combatTuning.burstBulletScore, "BURST CLEAR");
  }
}

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
      const definition = applyPowerupPickup(state, player, pickupComp.kind, pickupPos.x, pickupPos.y);
      if (definition) {
        sfxPickup(audio, definition.category);
      }
      removeEntity(pickupEntity);
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
      addBonusScore(state, "shard", shardComp.value, "SHARD");
      removeEntity(shard);
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
      if (!bulletAttack?.grazed && distanceSq >= grazeInnerSq && distanceSq <= grazeOuterSq) {
        bulletAttack.grazed = true;
        registerGraze(state, player);
        sfxGraze(audio);
      }
    }
  }

  player.pendingBurst = false;
}
