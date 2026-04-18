import { lerp } from "../core/math.js";
import { sfxBossDefeat, sfxBossPhase } from "../audio/sfx.js";
import { removeEntity } from "../entities/entityFactory.js";
import { resetCooldowns } from "../data/patterns.js";

export function updateBoss(state, boss, dt, contentContext) {
  boss.phaseTime += dt;

  const targetY = state.view.height * 0.18;
  boss.y = lerp(boss.y, targetY, dt * 0.6);
  boss.x = state.view.width * 0.5 + Math.sin(state.time * 0.6) * state.view.width * 0.12;

  const phase = boss.phases[boss.phaseIndex];
  if (phase && phase.pattern) {
    phase.pattern(boss, dt, contentContext);
  }
}

export function advanceBossPhase(state, boss, spawnParticle, audio) {
  boss.phaseIndex += 1;
  boss.phaseTime = 0;
  resetCooldowns(boss);
  if (!boss.phases[boss.phaseIndex]) {
    boss.hp = 0;
    return;
  }
  state.score += 800;
  boss.phaseHp = boss.phases[boss.phaseIndex].hp;
  state.pulse = 1;
  state.shake = 12;
  sfxBossPhase(audio);
  spawnParticle(state, boss.x, boss.y, "#ffffff", 80, 280, 1.2, 3);
}

export function defeatBoss(state, boss, spawnParticle, audio, stages) {
  if (state.boss !== boss) return;
  sfxBossDefeat(audio);
  state.kills += 1;
  state.score += 3200;
  state.boss = null;
  state.stageIndex += 1;
  state.stageTime = 0;
  state.stageState = null;

  for (const entity of state.entities) {
    if (entity.type === "enemy" || entity.type === "enemyBullet" || entity.type === "playerBullet") {
      removeEntity(entity);
    }
  }

  spawnParticle(state, boss.x, boss.y, "#ffffff", 120, 360, 1.4, 4);
  state.pulse = 1;
  state.shake = 18;
  if (state.stageIndex >= stages.length) {
    state.over = true;
    state.victory = true;
  }
}
