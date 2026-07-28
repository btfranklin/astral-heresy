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
  powerupTuning,
} from "../core/powerups.js";
import {
  sfxBurst,
  sfxChain,
  sfxEnemyPop,
  sfxGraze,
  sfxPickup,
  sfxPlayerDeath,
  sfxPlayerHit,
  sfxShieldAbsorb,
  sfxWeakpoint,
} from "../audio/sfx.js";

export function damagePlayer(state, player, audio, spawnParticle, x, y, intensity = 30) {
  if (absorbShieldHit(state, player)) {
    sfxShieldAbsorb(audio, { x });
    spawnParticle(state, x, y, "#d8faff", intensity + 18, 300, 0.72, 4);
    return;
  }
  player.hp -= 1;
  player.invuln = 1.2;
  state.shake = Math.max(state.shake, 10);
  spawnParticle(state, x, y, "#ff6ad5", intensity, 260, 0.7, 3);
  if (player.hp <= 0) {
    state.over = true;
    sfxPlayerDeath(audio, { x, y, hull: 0 });
  } else {
    sfxPlayerHit(audio, { x, y, hull: player.hp });
  }
}

export function spendPlayerBullet(bullet) {
  const attack = bullet.components.attack;
  if (attack && attack.pierce > 0) {
    attack.pierce -= 1;
    return;
  }
  removeEntity(bullet);
}

function registerPlayerBulletHit(state, bullet, targetKey) {
  const attack = bullet.components.attack;
  if (!attack) {
    state.shotsHit += 1;
    return true;
  }

  if (!attack.hitTargetKeys) attack.hitTargetKeys = [];
  if (attack.hitTargetKeys.includes(targetKey)) return false;

  attack.hitTargetKeys.push(targetKey);
  if (!attack.hitCounted) {
    attack.hitCounted = true;
    state.shotsHit += 1;
  }
  return true;
}

function getRemainingBossHp(boss) {
  const futurePhaseHp = boss.phases
    .slice(boss.phaseIndex + 1)
    .reduce((total, phase) => total + phase.hp, 0);
  return Math.max(0, boss.phaseHp) + futurePhaseHp;
}

export function applyBossDamage(
  state,
  player,
  boss,
  damage,
  audio,
  spawnParticle,
  advanceBossPhase,
  defeatBoss
) {
  const requestedDamage = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  const appliedDamage = Math.min(requestedDamage, Math.max(0, boss.phaseHp));
  boss.phaseHp = Math.max(0, boss.phaseHp - appliedDamage);
  boss.hp = getRemainingBossHp(boss);

  const phaseBroken = boss.phaseHp <= 0;
  if (phaseBroken) {
    advanceBossPhase(state, boss, spawnParticle, audio);
    boss.hp = boss.phases[boss.phaseIndex] ? getRemainingBossHp(boss) : 0;
  }

  const defeated = boss.phaseIndex >= boss.phases.length || boss.hp <= 0;
  if (defeated) {
    defeatBoss(state, player, boss, spawnParticle, audio);
  }

  return { appliedDamage, phaseBroken, defeated };
}

export function rewardKill(
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
  sfxEnemyPop(audio, { x: enemyPos.x, y: enemyPos.y });
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
      sfxChain(audio, { x: enemyPos.x, chainLevel: state.chainLevel });
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

export function damageEnemy(
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
  if (!registerPlayerBulletHit(state, bullet, `enemy:${enemy.id}`)) return false;

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
  return true;
}

export function damageBoss(
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
  if (!registerPlayerBulletHit(state, bullet, `boss:${boss.key}`)) return false;

  spendPlayerBullet(bullet);
  if (weakpointHit) {
    addBonusScore(state, "weakpoint", boss.weakpoint?.bonusScore || combatTuning.weakpointDefaultBonus, "WEAKPOINT");
    state.feedback.weakpoint = Math.max(state.feedback.weakpoint, 0.5);
    state.shake = Math.max(state.shake, 8);
    sfxWeakpoint(audio, { x: boss.weakpoint.x, y: boss.weakpoint.y });
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
  applyBossDamage(
    state,
    player,
    boss,
    damage,
    audio,
    spawnParticle,
    advanceBossPhase,
    defeatBoss
  );
  return true;
}

export function triggerBurst(
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
  sfxBurst(audio, { x: player.x, y: player.y });
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
    const boss = state.boss;
    const dx = boss.x - player.x;
    const dy = boss.y - player.y;
    if (dx * dx + dy * dy <= radiusSq) {
      spawnParticle(state, boss.x, boss.y, "#9efbff", 16, 180, 0.4, 3);
      applyBossDamage(
        state,
        player,
        boss,
        combatTuning.burstBossDamage,
        audio,
        spawnParticle,
        advanceBossPhase,
        defeatBoss
      );
    }
  }

  if (clearedBullets > 0) {
    addBonusScore(state, "burst", clearedBullets * combatTuning.burstBulletScore, "BURST CLEAR");
  }
}

export function collectPickup(state, player, audio, pickupEntity) {
  const pickupPos = pickupEntity.components.position;
  const pickupComp = pickupEntity.components.pickup;
  if (!pickupPos || !pickupComp) return null;
  const definition = applyPowerupPickup(state, player, pickupComp.kind, pickupPos.x, pickupPos.y);
  if (definition) {
    sfxPickup(audio, definition.category, { x: pickupPos.x, y: pickupPos.y });
  }
  removeEntity(pickupEntity);
  return definition;
}

export function collectScoreShard(state, shard) {
  const shardComp = shard.components.scoreShard;
  if (!shardComp) return 0;
  const awarded = addBonusScore(state, "shard", shardComp.value, "SHARD");
  removeEntity(shard);
  return awarded;
}

export function maybeGrazeEnemyBullet(state, player, audio, bullet, distanceSq, grazeInnerSq, grazeOuterSq) {
  const bulletAttack = bullet.components.attack;
  if (!bulletAttack?.grazed && distanceSq >= grazeInnerSq && distanceSq <= grazeOuterSq) {
    bulletAttack.grazed = true;
    registerGraze(state, player);
    sfxGraze(audio, { x: bullet.components.position?.x ?? player.x });
    return true;
  }
  return false;
}
