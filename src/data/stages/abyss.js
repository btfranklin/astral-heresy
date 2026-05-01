import { lerp, rand } from "../../core/math.js";
import { scaledCount } from "../../core/director.js";
import { emitAimedBurst, emitRadial, emitSpiral } from "../patterns.js";
import { gateRecurringWave, runOneShotEncounter } from "../stageRuntime.js";

export const stageAbyss = {
  key: "abyssal-cathedral",
  name: "Abyssal Cathedral",
  duration: 30,
  bossKey: "cathedral",
  densityTiers: [
    { until: 10, maxEnemies: 6, maxEnemyBullets: 44 },
    { until: 20, maxEnemies: 7, maxEnemyBullets: 58 },
    { until: Infinity, maxEnemies: 8, maxEnemyBullets: 70 },
  ],
  init() {
    return {
      nextHarrier: 0,
      nextNova: 3.5,
      nextFang: 6,
      gauntletDone: false,
      eliteDone: false,
      singularityDone: false,
      sealDone: false,
    };
  },
  update(stageState, t, dt, ctx) {
    const lane = ctx.playfield;
    const loopScale = ctx.loopIndex > 0 ? 0.86 : 1;
    const inLoopTwo = ctx.loopIndex > 0;

    if (t > stageState.nextHarrier) {
      const gate = gateRecurringWave(stageState, "nextHarrier", t, ctx, {
        enemyCost: 2,
        bulletCost: 6,
        priority: "normal",
      });
      if (gate) {
        const baseX = lane.randomX(48);
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
              emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, scaledCount(3, gate.bulletScale, 2), 0.2, 220, {
                r: 3,
                color: "#ffe6a8",
              });
              ai.nextShot = 0.9;
            }
          },
        });
        if (gate.escortScale > 0.5) {
          ctx.spawnEnemy("spear", {
            x: lane.clampX(baseX + rand(-72, 72), 40),
            y: -54,
            vx: rand(-32, 32),
            vy: rand(104, 142),
            fire(enemy, dtInner) {
              const ai = enemy.components.ai;
              const pos = enemy.components.position;
              if (!ai || !pos) return;
              ai.nextShot = (ai.nextShot || 0) - dtInner;
              if (ai.nextShot <= 0) {
                emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, scaledCount(2, gate.bulletScale, 2), 0.16, 235, {
                  r: 3,
                  color: "#ffe6a8",
                });
                ai.nextShot = 0.85;
              }
            },
          });
        }
        stageState.nextHarrier += 1.05 * loopScale;
      }
    }

    if (t > stageState.nextNova) {
      const gate = gateRecurringWave(stageState, "nextNova", t, ctx, {
        enemyCost: 2,
        bulletCost: 14,
        priority: "normal",
      });
      if (gate) {
        ctx.spawnEnemy("throne", {
          x: lane.randomX(52),
          y: -30,
          vx: 0,
          vy: 50,
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(18, gate.bulletScale, 10), 140, {
                r: 4,
                color: "#ff6a3d",
                turn: 0.5,
                wobble: 2.4,
              });
              ai.nextShot = 2.6;
            }
          },
        });
        if (gate.escortScale > 0.5) {
          ctx.spawnEnemy("spear", {
            x: lane.randomX(56),
            y: -34,
            vx: rand(-70, 70),
            vy: 120,
            fire(enemy, dtInner) {
              const ai = enemy.components.ai;
              const pos = enemy.components.position;
              if (!ai || !pos) return;
              ai.nextShot = (ai.nextShot || 0) - dtInner;
              if (ai.nextShot <= 0) {
                emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, scaledCount(3, gate.bulletScale, 2), 0.22, 240, {
                  r: 3,
                  color: "#ffdb9a",
                });
                ai.nextShot = 1.05;
              }
            },
          });
        }
        stageState.nextNova += 4.4 * loopScale;
      }
    }

    if (t > stageState.nextFang) {
      const fangEscort = inLoopTwo;
      const gate = gateRecurringWave(stageState, "nextFang", t, ctx, {
        enemyCost: fangEscort ? 2 : 1,
        bulletCost: fangEscort ? 16 : 10,
        priority: "normal",
      });
      if (gate) {
        ctx.spawnEnemy("fang", {
          x: lane.randomX(64),
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
              emitSpiral(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(12, gate.bulletScale, 7), 160, 0.35, {
                r: 3,
                color: "#ffc1f7",
                turn: -0.6,
                wobble: 3.8,
              });
              ai.nextShot = 1.7;
            }
          },
        });
        if (fangEscort && gate.escortScale > 0.5) {
          ctx.spawnEnemy("throne", {
            x: lane.randomX(56),
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
                emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(12, gate.bulletScale, 7), 160, {
                  r: 3,
                  color: "#ffb85b",
                  turn: 0.45,
                });
                ai.nextShot = 2.2;
              }
            },
          });
        }
        stageState.nextFang += 5 * loopScale;
      }
    }

    runOneShotEncounter(stageState, t, ctx, {
      doneKey: "gauntletDone",
      retryKey: "nextGauntletRetry",
      startTime: 11,
      gate: {
        enemyCost: 6,
        bulletCost: 20,
        priority: "setpiece",
      },
    }, ({ gate, isFull }) => {
        if (isFull) {
          for (const laneFraction of [0.22, 0.34, 0.5, 0.66, 0.78]) {
            ctx.spawnEnemy("spear", {
              x: lane.laneX(laneFraction),
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
                  emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, scaledCount(2, gate.bulletScale, 2), 0.12, 245, {
                    r: 3,
                    color: "#ffe1a5",
                  });
                  ai.nextShot = 0.8;
                }
              },
            });
          }
        }
        ctx.spawnEnemy("throne", {
          x: lane.laneX(0.5),
          y: -70,
          vx: 0,
          vy: 42,
          hp: inLoopTwo ? 12 : 10,
          dropKey: "graze-bloom",
          scoreBonus: 190,
          scoreShardCount: 4,
          label: "Gauntlet Heart",
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(
                ctx.spawnEnemyBullet,
                pos.x,
                pos.y,
                scaledCount(inLoopTwo ? 20 : 16, gate.bulletScale, 10),
                150,
                {
                  r: 4,
                  color: "#ff8b6a",
                  wobble: 2.2,
                }
              );
              ai.nextShot = 2;
            }
          },
        });
    });

    runOneShotEncounter(stageState, t, ctx, {
      doneKey: "singularityDone",
      retryKey: "nextSingularityRetry",
      startTime: 16,
      gate: {
        enemyCost: 3,
        bulletCost: 16,
        priority: "setpiece",
      },
    }, ({ gate, spawnEscorts }) => {
        ctx.spawnEnemy("throne", {
          x: lane.laneX(0.5),
          y: -54,
          vx: 0,
          vy: 38,
          hp: inLoopTwo ? 16 : 13,
          r: 24,
          dropKey: "magnet-core",
          scoreBonus: 210,
          scoreShardCount: 5,
          label: "Magnet Shrine",
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(14, gate.bulletScale, 8), 156, {
                r: 4,
                color: "#8fe8ff",
                turn: 0.62,
                wobble: 2.6,
              });
              ai.nextShot = 1.55;
            }
          },
        });
        if (spawnEscorts) {
          for (const side of [-1, 1]) {
            ctx.spawnEnemy("fang", {
              x: lane.laneX(0.5) + side * 132,
              y: -58,
              vx: side * 18,
              vy: 54,
              fire(enemy, dtInner) {
                const ai = enemy.components.ai;
                const pos = enemy.components.position;
                if (!ai || !pos) return;
                ai.nextShot = (ai.nextShot || 0) - dtInner;
                if (ai.nextShot <= 0) {
                  emitSpiral(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(8, gate.bulletScale, 5), 168, side * 0.4, {
                    r: 3,
                    color: "#ffc1f7",
                    turn: -side * 0.42,
                  });
                  ai.nextShot = 1.15;
                }
              },
            });
          }
        }
    });

    runOneShotEncounter(stageState, t, ctx, {
      doneKey: "eliteDone",
      retryKey: "nextEliteRetry",
      startTime: 20,
      gate: {
        enemyCost: 3,
        bulletCost: 20,
        priority: "elite",
      },
    }, ({ gate, spawnEscorts }) => {
        ctx.spawnEnemy("throne", {
          x: lane.laneX(0.5),
          y: -68,
          vx: 0,
          vy: 42,
          hp: inLoopTwo ? 24 : 20,
          r: 28,
          elite: true,
          dropKey: "beam",
          scoreBonus: 320,
          scoreShardCount: 5,
          label: "Solar Confessor",
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(
                ctx.spawnEnemyBullet,
                pos.x,
                pos.y,
                scaledCount(inLoopTwo ? 22 : 18, gate.bulletScale, 11),
                165,
                {
                  r: 4,
                  color: "#ffb85b",
                  turn: 0.55,
                  wobble: 2.6,
                }
              );
              emitAimedBurst(
                ctx.spawnEnemyBullet,
                ctx.player,
                pos.x,
                pos.y,
                scaledCount(5, gate.bulletScale, 3),
                0.36,
                250,
                {
                  r: 3,
                  color: "#ffe3b2",
                }
              );
              ai.nextShot = 1.15;
            }
          },
        });
        if (spawnEscorts) {
          for (const side of [-1, 1]) {
            ctx.spawnEnemy("fang", {
              x: lane.laneX(0.5) + side * 120,
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
                  emitSpiral(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(9, gate.bulletScale, 5), 170, side * 0.42, {
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
    });

    runOneShotEncounter(stageState, t, ctx, {
      doneKey: "sealDone",
      retryKey: "nextSealRetry",
      startTime: 25.2,
      gate: {
        enemyCost: 3,
        bulletCost: 14,
        priority: "setpiece",
      },
    }, ({ gate, spawnEscorts }) => {
        ctx.spawnEnemy("spear", {
          x: lane.laneX(0.5),
          y: -40,
          vx: 0,
          vy: 98,
          hp: inLoopTwo ? 11 : 9,
          r: 20,
          risk: true,
          dropKey: "point-blank-seal",
          scoreBonus: 220,
          scoreShardCount: 6,
          label: "Seal Warden",
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, scaledCount(4, gate.bulletScale, 2), 0.18, 250, {
                r: 3,
                color: "#ff9a6a",
              });
              ai.nextShot = 0.72;
            }
          },
        });
        if (spawnEscorts) {
          for (const side of [-1, 1]) {
            ctx.spawnEnemy("throne", {
              x: lane.laneX(0.5) + side * 160,
              y: ctx.view.height * 0.2,
              vx: 0,
              vy: 26,
              hp: 8,
              fire(enemy, dtInner) {
                const ai = enemy.components.ai;
                const pos = enemy.components.position;
                if (!ai || !pos) return;
                ai.nextShot = (ai.nextShot || 0) - dtInner;
                if (ai.nextShot <= 0) {
                  emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(10, gate.bulletScale, 6), 170, {
                    r: 3,
                    color: "#ff8b6a",
                    turn: side * 0.38,
                  });
                  ai.nextShot = 1.1;
                }
              },
            });
          }
        }
    });
  },
};
