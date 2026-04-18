import { lerp, rand } from "../../core/math.js";
import { emitAimedBurst, emitRadial, emitSpiral } from "../patterns.js";

export const stageNebula = {
  key: "nebula-gate",
  name: "Nebula Gate",
  duration: 26,
  bossKey: "seraph",
  init() {
    return { nextSwoop: 0, nextRing: 3, nextSine: 6 };
  },
  update(stageState, t, dt, ctx) {
    if (t > stageState.nextSwoop) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const startX = side < 0 ? -40 : ctx.view.width + 40;
      ctx.spawnEnemy("cherub", {
        x: startX,
        y: rand(60, ctx.view.height * 0.4),
        vx: side * rand(90, 140),
        vy: rand(20, 50),
        behavior(enemy, dtInner) {
          const vel = enemy.components.velocity;
          if (!vel) return;
          vel.vy = lerp(vel.vy, 20, dtInner * 0.8);
        },
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 4, 0.4, 180, {
              r: 4,
              color: "#ffa7f0",
            });
            ai.nextShot = 1.6 + Math.random() * 0.4;
          }
        },
      });
      stageState.nextSwoop += 1.8;
    }

    if (t > stageState.nextRing) {
      ctx.spawnEnemy("halo", {
        x: rand(ctx.view.width * 0.2, ctx.view.width * 0.8),
        y: -30,
        vx: 0,
        vy: rand(50, 80),
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, 14, 120, {
              r: 3,
              color: "#85c7ff",
              turn: rand(-0.4, 0.4),
            });
            ai.nextShot = 2.4;
          }
        },
      });
      stageState.nextRing += 4.8;
    }

    if (t > stageState.nextSine) {
      ctx.spawnEnemy("oracle", {
        x: rand(ctx.view.width * 0.2, ctx.view.width * 0.8),
        y: -20,
        vx: 0,
        vy: rand(40, 70),
        wobble: rand(1.8, 2.6),
        behavior(enemy, dtInner) {
          const pos = enemy.components.position;
          const ai = enemy.components.ai;
          if (!pos || !ai) return;
          pos.x += Math.sin(ai.t * ai.wobble) * 80 * dtInner;
        },
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitSpiral(ctx.spawnEnemyBullet, pos.x, pos.y, 6, 140, 0.6, {
              r: 3,
              color: "#ffb37f",
              turn: 0.8,
            });
            ai.nextShot = 1.2;
          }
        },
      });
      stageState.nextSine += 3.6;
    }
  },
};
