import { getPlayerBounds } from "../state/playerState.js";
import { createBossInstance, listBossShowcaseEntries } from "../data/bosses.js";
import { getEnemyArchetype, listEnemyShowcaseEntries } from "../data/enemies.js";
import { spawnEnemy } from "../systems/enemySystem.js";

const enemyEntries = new Map(listEnemyShowcaseEntries().map((entry) => [entry.key, entry]));
const bossEntries = new Map(listBossShowcaseEntries().map((entry) => [entry.key, entry]));
const defaultEnemyKey = listEnemyShowcaseEntries()[0]?.key || "cherub";

function clampPhase(requestedPhase, totalPhases) {
  return Math.max(0, Math.min(totalPhases - 1, requestedPhase - 1));
}

export function getShowcaseConfig(searchString = window.location.search) {
  const params = new URLSearchParams(searchString);
  if (params.get("mode") !== "render") return null;

  const enemy = params.get("enemy");
  if (enemy && enemyEntries.has(enemy)) {
    return {
      type: "enemy",
      key: enemy,
      label: enemyEntries.get(enemy).label,
    };
  }

  const boss = params.get("boss");
  if (boss && bossEntries.has(boss)) {
    const phase = Number.parseInt(params.get("phase") || "1", 10);
    return {
      type: "boss",
      key: boss,
      phase: Number.isFinite(phase) ? phase : 1,
      label: bossEntries.get(boss).label,
    };
  }

  return {
    type: "enemy",
    key: defaultEnemyKey,
    label: enemyEntries.get(defaultEnemyKey)?.label || "Enemy Study",
  };
}

export function createShowcaseScene(state, player, config) {
  const playerBounds = getPlayerBounds(state.view.width, state.view.height);
  state.showcase = config;
  state.started = true;
  state.entities = [];
  state.boss = null;
  state.over = false;
  state.victory = false;
  state.stageTime = 0;
  player.x = playerBounds.startX;
  player.y = playerBounds.startY;
  state.input.pointerX = player.x;
  state.input.pointerY = player.y;

  if (config.type === "enemy") {
    const preset = getEnemyArchetype(config.key) || getEnemyArchetype(defaultEnemyKey);
    spawnEnemy(state, preset.key, {
      x: state.view.width * 0.5,
      y: state.view.height * 0.34,
      vx: 0,
      vy: 0,
      hp: 999,
      behavior(entity, dt) {
        const ai = entity.components.ai;
        const pos = entity.components.position;
        const vel = entity.components.velocity;
        if (!ai || !pos || !vel) return;
        pos.x = state.view.width * 0.5 + Math.sin(ai.t * 0.7) * state.view.width * 0.06;
        pos.y = state.view.height * 0.34 + Math.sin(ai.t * 1.5) * 12;
        vel.vx = 0;
        vel.vy = 0;
      },
    });
    return;
  }

  const bossKey = bossEntries.has(config.key) ? config.key : listBossShowcaseEntries()[0]?.key;
  const boss = createBossInstance(bossKey, {
    view: state.view,
    player,
    spawnEnemyBullet() {},
    spawnEnemy() {},
  });
  boss.phaseIndex = clampPhase(config.phase || 1, boss.phases.length);
  boss.phaseHp = boss.phases[boss.phaseIndex].hp;
  boss.hp = boss.maxHp;
  boss.x = state.view.width * 0.5;
  boss.y = state.view.height * 0.3;
  state.boss = boss;
}

export function updateShowcaseScene(state, dt) {
  if (!state.showcase) return;

  if (state.showcase.type === "enemy") {
    for (const entity of state.entities) {
      if (entity.type !== "enemy") continue;
      const ai = entity.components.ai;
      if (ai) ai.t += dt;
      if (ai?.behavior) {
        ai.behavior(entity, dt, state);
      }
    }
    return;
  }

  if (state.boss) {
    state.boss.phaseTime += dt;
    state.boss.x = state.view.width * 0.5 + Math.sin(state.time * 0.45) * state.view.width * 0.05;
    state.boss.y = state.view.height * 0.28 + Math.sin(state.time * 0.9) * 10;
  }
}
