import { lerp } from "../core/math.js";
import { sfxBossDefeat, sfxBossPhase } from "../audio/sfx.js";
import { removeEntity } from "../entities/entityFactory.js";
import { addBonusScore, combatTuning } from "../core/combat.js";
import { resetCooldowns } from "../data/patterns.js";
import { resetLoopTransitionState } from "../state/runReset.js";
import { resolveWeakpoint } from "./bossInternals.js";

export function updateBoss(state, boss, dt, contentContext) {
  boss.phaseTime += dt;
  boss.weakpointBrandTimer = Math.max(0, (boss.weakpointBrandTimer || 0) - dt);

  const targetY = state.view.height * 0.18;
  boss.y = lerp(boss.y, targetY, dt * 0.6);
  boss.x = state.view.width * 0.5 + Math.sin(state.time * 0.6) * state.view.width * 0.12;

  const phase = boss.phases[boss.phaseIndex];
  if (phase && phase.pattern) {
    phase.pattern(boss, dt, contentContext);
  }
  boss.weakpoint = resolveWeakpoint(boss, phase);
}

export function advanceBossPhase(state, boss, spawnParticle, audio) {
  const speedBonus = Math.max(0, Math.round(780 - boss.phaseTime * 55));
  boss.phaseIndex += 1;
  boss.phaseTime = 0;
  resetCooldowns(boss);
  boss.weakpoint = null;
  if (!boss.phases[boss.phaseIndex]) {
    boss.hp = 0;
    return;
  }
  state.score += combatTuning.phaseBreakBaseScore;
  addBonusScore(state, "phaseBreak", speedBonus, "PHASE BREAK");
  boss.phaseHp = boss.phases[boss.phaseIndex].hp;
  state.pulse = 1;
  state.shake = 12;
  state.feedback.phase = Math.max(state.feedback.phase, 0.65);
  sfxBossPhase(audio);
  spawnParticle(state, boss.x, boss.y, "#ffffff", 80, 280, 1.2, 3);
}

export function defeatBoss(state, player, boss, spawnParticle, audio, stages) {
  if (state.boss !== boss) return;
  sfxBossDefeat(audio);
  state.kills += 1;
  state.score += combatTuning.bossDefeatScore;
  state.boss = null;
  state.stageIndex += 1;
  state.stageTime = 0;
  state.stageState = null;

  for (const entity of state.entities) {
    if (
      entity.type === "enemy" ||
      entity.type === "enemyBullet" ||
      entity.type === "playerBullet" ||
      entity.type === "pickup" ||
      entity.type === "scoreShard"
    ) {
      removeEntity(entity);
    }
  }

  spawnParticle(state, boss.x, boss.y, "#ffffff", 120, 360, 1.4, 4);
  state.pulse = 1;
  state.shake = 18;
  if (state.stageIndex >= stages.length) {
    if (state.loopIndex <= 0) {
      resetLoopTransitionState(state, player);
      boss.weakpoint = null;
    } else {
      state.over = true;
      state.victory = true;
    }
  }
}
