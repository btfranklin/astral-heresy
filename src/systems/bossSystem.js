import { lerp } from "../core/math.js";
import { sfxBossDefeat, sfxBossPhase } from "../audio/sfx.js";
import { removeEntity } from "../entities/entityFactory.js";
import { addBonusScore, combatTuning } from "../core/combat.js";
import { resetCooldowns } from "../data/patterns.js";

function resolveWeakpoint(boss, phase) {
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
      state.loopIndex = 1;
      state.stageIndex = 0;
      state.stageTime = 0;
      state.stageState = null;
      state.loopTimer = 2.6;
      state.feedback.loop = Math.max(state.feedback.loop, 1.2);
      state.burstStocks = 1;
      state.grazeCharge = 0;
      player.hp = 5;
      player.invuln = 1.4;
      player.weaponMode = "base";
      player.weaponTimer = 0;
      for (const key of Object.keys(player.activePowerups)) {
        player.activePowerups[key] = 0;
      }
      boss.weakpoint = null;
    } else {
      state.over = true;
      state.victory = true;
    }
  }
}
