import { lerp, rand } from "../../core/math.js";
import { emitAimedBurst, emitRadial, emitSpiral } from "../patterns.js";

export const stageAbyss = {
  key: "abyssal-cathedral",
  name: "Abyssal Cathedral",
  duration: 30,
  bossKey: "cathedral",
  init() {
    return { nextHarrier: 0, nextNova: 3.5, nextFang: 6 };
  },
  update(stageState, t, dt, ctx) {
    if (t > stageState.nextHarrier) {
      ctx.spawnEnemy("spear", {
        x: rand(ctx.view.width * 0.2, ctx.view.width * 0.8),
        y: -30,
        vx: rand(-40, 40),
        vy: rand(90, 130),
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 3, 0.2, 220, {
              r: 3,
              color: "#ffe6a8",
            });
            ai.nextShot = 0.9;
          }
        },
      });
      stageState.nextHarrier += 1.2;
    }

    if (t > stageState.nextNova) {
      ctx.spawnEnemy("throne", {
        x: rand(ctx.view.width * 0.2, ctx.view.width * 0.8),
        y: -30,
        vx: 0,
        vy: 50,
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, 18, 140, {
              r: 4,
              color: "#ff6a3d",
              turn: 0.5,
              wobble: 2.4,
            });
            ai.nextShot = 2.6;
          }
        },
      });
      stageState.nextNova += 4.8;
    }

    if (t > stageState.nextFang) {
      ctx.spawnEnemy("fang", {
        x: rand(ctx.view.width * 0.1, ctx.view.width * 0.9),
        y: -60,
        vx: 0,
        vy: 40,
        behavior(enemy, dtInner) {
          const vel = enemy.components.velocity;
          if (!vel) return;
          vel.vy = lerp(vel.vy, 20, dtInner * 0.5);
        },
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitSpiral(ctx.spawnEnemyBullet, pos.x, pos.y, 12, 160, 0.35, {
              r: 3,
              color: "#ffc1f7",
              turn: -0.6,
              wobble: 3.8,
            });
            ai.nextShot = 1.7;
          }
        },
      });
      stageState.nextFang += 5.4;
    }
  },
};
