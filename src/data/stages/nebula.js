import { lerp, rand } from "../../core/math.js";
import { emitAimedBurst, emitRadial, emitSpiral } from "../patterns.js";

export const stageNebula = {
  key: "nebula-gate",
  name: "Nebula Gate",
  duration: 26,
  bossKey: "seraph",
  init() {
    return {
      nextSwoop: 0,
      nextRing: 3,
      nextSine: 6,
      corridorDone: false,
      eliteDone: false,
    };
  },
  update(stageState, t, dt, ctx) {
    const loopScale = ctx.loopIndex > 0 ? 0.88 : 1;
    const inLoopTwo = ctx.loopIndex > 0;

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
      if (t > 8) {
        ctx.spawnEnemy("cherub", {
          x: side < 0 ? ctx.view.width + 36 : -36,
          y: rand(90, ctx.view.height * 0.42),
          vx: -side * rand(110, 150),
          vy: rand(18, 32),
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 3, 0.24, 210, {
                r: 3,
                color: "#ffd5ff",
              });
              ai.nextShot = 1.3;
            }
          },
        });
      }
      stageState.nextSwoop += 1.6 * loopScale;
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
      ctx.spawnEnemy("cherub", {
        x: rand(48, ctx.view.width - 48),
        y: -26,
        vx: rand(-48, 48),
        vy: rand(110, 145),
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 2, 0.12, 200, {
              r: 3,
              color: "#ff92dc",
            });
            ai.nextShot = 1.2;
          }
        },
      });
      stageState.nextRing += 4.4 * loopScale;
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
      if (inLoopTwo) {
        ctx.spawnEnemy("cherub", {
          x: rand(60, ctx.view.width - 60),
          y: -30,
          vx: rand(-70, 70),
          vy: rand(95, 135),
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 3, 0.18, 210, {
                r: 3,
                color: "#ffc1f7",
              });
              ai.nextShot = 1.15;
            }
          },
        });
      }
      stageState.nextSine += 3.2 * loopScale;
    }

    if (!stageState.corridorDone && t >= 10) {
      stageState.corridorDone = true;
      for (const lane of [0.24, 0.38, 0.62, 0.76]) {
        ctx.spawnEnemy("halo", {
          x: ctx.view.width * lane,
          y: -40,
          vx: 0,
          vy: 58,
          hp: inLoopTwo ? 7 : 6,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, 10, 150, {
                r: 3,
                color: "#9efbff",
                turn: lane < 0.5 ? 0.4 : -0.4,
              });
              ai.nextShot = 1.8;
            }
          },
        });
      }
      for (const side of [-1, 1]) {
        ctx.spawnEnemy("cherub", {
          x: side < 0 ? -42 : ctx.view.width + 42,
          y: ctx.view.height * 0.28,
          vx: side * 150,
          vy: 24,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 5, 0.42, 210, {
                r: 3,
                color: "#ff8fd8",
              });
              ai.nextShot = 1.5;
            }
          },
        });
      }
    }

    if (!stageState.eliteDone && t >= 17) {
      stageState.eliteDone = true;
      ctx.spawnEnemy("halo", {
        x: ctx.view.width * 0.5,
        y: -60,
        vx: 0,
        vy: 44,
        hp: inLoopTwo ? 18 : 14,
        r: 26,
        elite: true,
        dropKey: "spread",
        scoreBonus: 260,
        label: "Halo Exarch",
        fire(enemy, dtInner) {
          const ai = enemy.components.ai;
          const pos = enemy.components.position;
          if (!ai || !pos) return;
          ai.nextShot = (ai.nextShot || 0) - dtInner;
          if (ai.nextShot <= 0) {
            emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, inLoopTwo ? 18 : 14, 160, {
              r: 3,
              color: "#b8fbff",
              turn: 0.35,
            });
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, 5, 0.3, 220, {
              r: 4,
              color: "#ffd5ff",
            });
            ai.nextShot = 1.15;
          }
        },
      });
      for (const side of [-1, 1]) {
        ctx.spawnEnemy("cherub", {
          x: ctx.view.width * 0.5 + side * 96,
          y: -30,
          vx: side * 24,
          vy: 88,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, inLoopTwo ? 4 : 3, 0.2, 210, {
                r: 3,
                color: "#ffa7f0",
              });
              ai.nextShot = 1.05;
            }
          },
        });
      }
    }
  },
};
