import { lerp, rand } from "../../core/math.js";
import { emitAimedBurst, emitRadial, emitSpiral } from "../patterns.js";

export const stageCrystal = {
  key: "crystalline-choir",
  name: "Crystalline Choir",
  duration: 28,
  bossKey: "prism",
  init() {
    return { nextShard: 0, nextWeaver: 4, nextBurst: 2 };
  },
  update(stageState, t, dt, ctx) {
    if (t > stageState.nextShard) {
      ctx.spawnEnemy("shard", {
        x: rand(40, ctx.view.width - 40),
        y: -40,
        vx: rand(-30, 30),
        vy: rand(70, 110),
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, 10, 160, {
              r: 3,
              color: "#a5d9ff",
              turn: rand(-0.8, 0.8),
            });
            ai.nextShot = 1.8 + Math.random() * 0.3;
          }
        },
      });
      stageState.nextShard += 1.4;
    }

    if (t > stageState.nextWeaver) {
      ctx.spawnEnemy("weaver", {
        x: rand(ctx.view.width * 0.2, ctx.view.width * 0.8),
        y: -30,
        vx: 0,
        vy: 60,
        behavior(enemy, dtInner) {
          const vel = enemy.components.velocity;
          const ai = enemy.components.ai;
          if (!vel || !ai) return;
          vel.vx = Math.sin(ai.t * 1.4) * 90;
          vel.vy = lerp(vel.vy, 10, dtInner * 0.6);
        },
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 6, 0.7, 190, {
              r: 4,
              color: "#ff95f1",
              wobble: 3.5,
            });
            ai.nextShot = 1.6;
          }
        },
      });
      stageState.nextWeaver += 5.2;
    }

    if (t > stageState.nextBurst) {
      const sign = Math.random() < 0.5 ? -1 : 1;
      ctx.spawnEnemy("harp", {
        x: sign < 0 ? -40 : ctx.view.width + 40,
        y: rand(80, ctx.view.height * 0.35),
        vx: sign * rand(80, 120),
        vy: rand(10, 30),
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitSpiral(ctx.spawnEnemyBullet, pos.x, pos.y, 9, 150, 0.45, {
              r: 3,
              color: "#ff6ad5",
              turn: -0.5,
            });
            ai.nextShot = 2.2;
          }
        },
      });
      stageState.nextBurst += 4.2;
    }
  },
};
