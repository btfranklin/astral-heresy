import { removeEntity } from "../entities/entityFactory.js";
import { sfxEnemyPop, sfxPlayerHit } from "../audio/sfx.js";

function damagePlayer(state, player, audio, spawnParticle, x, y, intensity = 30) {
  player.hp -= 1;
  player.invuln = 1.2;
  state.shake = Math.max(state.shake, 10);
  sfxPlayerHit(audio);
  spawnParticle(state, x, y, "#ff6ad5", intensity, 260, 0.7, 3);
  if (player.hp <= 0) {
    state.over = true;
  }
}

export function handleCollisions(
  state,
  player,
  audio,
  spawnParticle,
  advanceBossPhase,
  defeatBoss,
  buckets
) {
  const enemies = buckets.enemies;
  const playerBullets = buckets.playerBullets;
  const enemyBullets = buckets.enemyBullets;

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
        if (!bulletPos || !bulletCol) continue;
        const dx = enemyPos.x - bulletPos.x;
        const dy = enemyPos.y - bulletPos.y;
        if (dx * dx + dy * dy < (enemyCol.r + bulletCol.r) ** 2) {
          state.shotsHit += 1;
          enemyHealth.hp -= 1;
          removeEntity(bullet);
          spawnParticle(state, enemyPos.x, enemyPos.y, "#ffffff", 6, 120, 0.4, 2);
          if (enemyHealth.hp <= 0) {
            spawnParticle(state, enemyPos.x, enemyPos.y, "#79ffe1", 18, 220, 0.9, 3);
            sfxEnemyPop(audio);
            state.kills += 1;
            state.score += enemyHealth.maxHp * 140;
            removeEntity(enemy);
          }
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
      if (!bulletPos || !bulletCol) continue;
      const dx = boss.x - bulletPos.x;
      const dy = boss.y - bulletPos.y;
      if (dx * dx + dy * dy < (boss.r * 0.75 + bulletCol.r) ** 2) {
        state.shotsHit += 1;
        boss.hp -= 1;
        boss.phaseHp -= 1;
        removeEntity(bullet);
        if (boss.phaseHp <= 0) {
          advanceBossPhase(state, boss, spawnParticle, audio);
        }
        if (boss.hp <= 0) {
          defeatBoss(state, boss, spawnParticle, audio);
        }
      }
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
      if (!bulletPos || !bulletCol) continue;
      const dx = player.x - bulletPos.x;
      const dy = player.y - bulletPos.y;
      if (dx * dx + dy * dy < (player.radius + bulletCol.r) ** 2) {
        removeEntity(bullet);
        damagePlayer(state, player, audio, spawnParticle, player.x, player.y, 30);
        break;
      }
    }
  }
}
