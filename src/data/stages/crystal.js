import { lerp, rand } from "../../core/math.js";
import { emitAimedBurst, emitRadial, emitSpiral } from "../patterns.js";

export const stageCrystal = {
  key: "crystalline-choir",
  name: "Crystalline Choir",
  duration: 28,
  bossKey: "prism",
  init() {
    return {
      nextShard: 0,
      nextWeaver: 4,
      nextBurst: 2,
      latticeDone: false,
      eliteDone: false,
    };
  },
  update(stageState, t, dt, ctx) {
    const loopScale = ctx.loopIndex > 0 ? 0.87 : 1;
    const inLoopTwo = ctx.loopIndex > 0;

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
      if (t > 7) {
        ctx.spawnEnemy("shard", {
          x: rand(40, ctx.view.width - 40),
          y: -44,
          vx: rand(-44, 44),
          vy: rand(86, 120),
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, 6, 170, {
                r: 3,
                color: "#d8f0ff",
                turn: rand(-0.5, 0.5),
              });
              ai.nextShot = 1.35;
            }
          },
        });
      }
      stageState.nextShard += 1.2 * loopScale;
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
      ctx.spawnEnemy("shard", {
        x: rand(56, ctx.view.width - 56),
        y: -28,
        vx: rand(-42, 42),
        vy: 105,
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, inLoopTwo ? 12 : 8, 165, {
              r: 3,
              color: "#a5d9ff",
              turn: rand(-0.9, 0.9),
            });
            ai.nextShot = 1.45;
          }
        },
      });
      stageState.nextWeaver += 4.8 * loopScale;
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
      if (inLoopTwo) {
        ctx.spawnEnemy("shard", {
          x: sign < 0 ? ctx.view.width + 30 : -30,
          y: rand(100, ctx.view.height * 0.32),
          vx: sign * 130,
          vy: 24,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, 7, 170, {
                r: 3,
                color: "#ffe5ff",
                turn: -0.4,
              });
              ai.nextShot = 1.3;
            }
          },
        });
      }
      stageState.nextBurst += 3.9 * loopScale;
    }

    if (!stageState.latticeDone && t >= 11) {
      stageState.latticeDone = true;
      for (const lane of [0.22, 0.5, 0.78]) {
        ctx.spawnEnemy("weaver", {
          x: ctx.view.width * lane,
          y: -30,
          vx: 0,
          vy: 52,
          hp: inLoopTwo ? 9 : 7,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, inLoopTwo ? 8 : 6, 0.68, 205, {
                r: 3,
                color: "#ff9be8",
                wobble: 3.4,
              });
              ai.nextShot = 1.4;
            }
          },
        });
      }
      for (let i = 0; i < 4; i++) {
        ctx.spawnEnemy("shard", {
          x: (ctx.view.width * (i + 0.5)) / 4,
          y: -48 - i * 22,
          vx: i % 2 === 0 ? -34 : 34,
          vy: 112,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, 9, 170, {
                r: 3,
                color: "#d9f6ff",
                turn: i % 2 === 0 ? 0.65 : -0.65,
              });
              ai.nextShot = 1.7;
            }
          },
        });
      }
    }

    if (!stageState.eliteDone && t >= 18) {
      stageState.eliteDone = true;
      ctx.spawnEnemy("weaver", {
        x: ctx.view.width * 0.5,
        y: -40,
        vx: 0,
        vy: 46,
        hp: inLoopTwo ? 20 : 16,
        r: 24,
        elite: true,
        dropKey: "pierce",
        scoreBonus: 300,
        label: "Refraction Cantor",
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, inLoopTwo ? 8 : 6, 0.62, 225, {
              r: 4,
              color: "#ffd5ff",
              wobble: 4.2,
            });
            emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, inLoopTwo ? 16 : 12, 150, {
              r: 3,
              color: "#9efbff",
              turn: -0.5,
            });
            ai.nextShot = 1.1;
          }
        },
      });
      for (const offset of [-110, 110]) {
        ctx.spawnEnemy("shard", {
          x: ctx.view.width * 0.5 + offset,
          y: -32,
          vx: offset < 0 ? 28 : -28,
          vy: 96,
          hp: inLoopTwo ? 6 : 5,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, 10, 175, {
                r: 3,
                color: "#a5d9ff",
                turn: offset < 0 ? 0.7 : -0.7,
              });
              ai.nextShot = 1.2;
            }
          },
        });
      }
    }
  },
};
