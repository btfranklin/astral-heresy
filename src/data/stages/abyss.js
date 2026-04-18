import { lerp, rand } from "../../core/math.js";
import { emitAimedBurst, emitRadial, emitSpiral } from "../patterns.js";

export const stageAbyss = {
  key: "abyssal-cathedral",
  name: "Abyssal Cathedral",
  duration: 30,
  bossKey: "cathedral",
  init() {
    return {
      nextHarrier: 0,
      nextNova: 3.5,
      nextFang: 6,
      gauntletDone: false,
      eliteDone: false,
    };
  },
  update(stageState, t, dt, ctx) {
    const loopScale = ctx.loopIndex > 0 ? 0.86 : 1;
    const inLoopTwo = ctx.loopIndex > 0;

    if (t > stageState.nextHarrier) {
      const baseX = rand(ctx.view.width * 0.22, ctx.view.width * 0.78);
      ctx.spawnEnemy("spear", {
        x: baseX,
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
      ctx.spawnEnemy("spear", {
        x: Math.max(40, Math.min(ctx.view.width - 40, baseX + rand(-72, 72))),
        y: -54,
        vx: rand(-32, 32),
        vy: rand(104, 142),
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 2, 0.16, 235, {
              r: 3,
              color: "#ffe6a8",
            });
            ai.nextShot = 0.85;
          }
        },
      });
      stageState.nextHarrier += 1.05 * loopScale;
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
      ctx.spawnEnemy("spear", {
        x: rand(ctx.view.width * 0.18, ctx.view.width * 0.82),
        y: -34,
        vx: rand(-70, 70),
        vy: 120,
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 3, 0.22, 240, {
              r: 3,
              color: "#ffdb9a",
            });
            ai.nextShot = 1.05;
          }
        },
      });
      stageState.nextNova += 4.4 * loopScale;
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
      if (inLoopTwo) {
        ctx.spawnEnemy("throne", {
          x: rand(ctx.view.width * 0.18, ctx.view.width * 0.82),
          y: -42,
          vx: 0,
          vy: 48,
          hp: 8,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, 12, 160, {
                r: 3,
                color: "#ffb85b",
                turn: 0.45,
              });
              ai.nextShot = 2.2;
            }
          },
        });
      }
      stageState.nextFang += 5.0 * loopScale;
    }

    if (!stageState.gauntletDone && t >= 11) {
      stageState.gauntletDone = true;
      for (const lane of [0.22, 0.34, 0.5, 0.66, 0.78]) {
        ctx.spawnEnemy("spear", {
          x: ctx.view.width * lane,
          y: -40 - rand(0, 40),
          vx: 0,
          vy: 126,
          hp: inLoopTwo ? 5 : 4,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 2, 0.12, 245, {
                r: 3,
                color: "#ffe1a5",
              });
              ai.nextShot = 0.8;
            }
          },
        });
      }
      ctx.spawnEnemy("throne", {
        x: ctx.view.width * 0.5,
        y: -70,
        vx: 0,
        vy: 42,
        hp: inLoopTwo ? 12 : 10,
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, inLoopTwo ? 20 : 16, 150, {
              r: 4,
              color: "#ff8b6a",
              wobble: 2.2,
            });
            ai.nextShot = 2.0;
          }
        },
      });
    }

    if (!stageState.eliteDone && t >= 20) {
      stageState.eliteDone = true;
      ctx.spawnEnemy("throne", {
        x: ctx.view.width * 0.5,
        y: -68,
        vx: 0,
        vy: 42,
        hp: inLoopTwo ? 24 : 20,
        r: 28,
        elite: true,
        dropKey: "beam",
        scoreBonus: 320,
        label: "Solar Confessor",
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, inLoopTwo ? 22 : 18, 165, {
              r: 4,
              color: "#ffb85b",
              turn: 0.55,
              wobble: 2.6,
            });
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 5, 0.36, 250, {
              r: 3,
              color: "#ffe3b2",
            });
            ai.nextShot = 1.15;
          }
        },
      });
      for (const side of [-1, 1]) {
        ctx.spawnEnemy("fang", {
          x: ctx.view.width * 0.5 + side * 120,
          y: -44,
          vx: side * 18,
          vy: 58,
          hp: inLoopTwo ? 9 : 7,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitSpiral(ctx.spawnEnemyBullet, pos.x, pos.y, 9, 170, side * 0.42, {
                r: 3,
                color: "#ffc1f7",
                turn: -side * 0.4,
              });
              ai.nextShot = 1.3;
            }
          },
        });
      }
    }
  },
};
