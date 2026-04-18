import { lerp, rand } from "../../core/math.js";
import { scaledCount } from "../../core/director.js";
import { emitAimedBurst, emitRadial, emitSpiral } from "../patterns.js";
import { gateRecurringWave, resolveOneShotWave } from "../stageRuntime.js";

export const stageCrystal = {
  key: "crystalline-choir",
  name: "Crystalline Choir",
  duration: 28,
  bossKey: "prism",
  densityTiers: [
    { until: 10, maxEnemies: 5, maxEnemyBullets: 36 },
    { until: 20, maxEnemies: 6, maxEnemyBullets: 48 },
    { until: Infinity, maxEnemies: 7, maxEnemyBullets: 58 },
  ],
  init() {
    return {
      nextShard: 0,
      nextWeaver: 4,
      nextBurst: 2,
      latticeDone: false,
      eliteDone: false,
      amplifierEliteDone: false,
      chainSigilDone: false,
    };
  },
  update(stageState, t, dt, ctx) {
    const lane = ctx.playfield;
    const loopScale = ctx.loopIndex > 0 ? 0.87 : 1;
    const inLoopTwo = ctx.loopIndex > 0;

    if (t > stageState.nextShard) {
      const escortActive = t > 7;
      const gate = gateRecurringWave(stageState, "nextShard", t, ctx, {
        enemyCost: escortActive ? 2 : 1,
        bulletCost: escortActive ? 12 : 8,
        priority: "normal",
      });
      if (gate) {
        ctx.spawnEnemy("shard", {
          x: lane.randomX(40),
          y: -40,
          vx: rand(-30, 30),
          vy: rand(70, 110),
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(10, gate.bulletScale, 6), 160, {
                r: 3,
                color: "#a5d9ff",
                turn: rand(-0.8, 0.8),
              });
              ai.nextShot = 1.8 + Math.random() * 0.3;
            }
          },
        });
        if (escortActive && gate.escortScale > 0.5) {
          ctx.spawnEnemy("shard", {
            x: lane.randomX(44),
            y: -44,
            vx: rand(-44, 44),
            vy: rand(86, 120),
            fire(enemy, dtInner) {
              const ai = enemy.components.ai;
              const pos = enemy.components.position;
              if (!ai || !pos) return;
              ai.nextShot = (ai.nextShot || 0) - dtInner;
              if (ai.nextShot <= 0) {
                emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(6, gate.bulletScale, 4), 170, {
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
    }

    if (t > stageState.nextWeaver) {
      const gate = gateRecurringWave(stageState, "nextWeaver", t, ctx, {
        enemyCost: 2,
        bulletCost: 12,
        priority: "normal",
      });
      if (gate) {
        ctx.spawnEnemy("weaver", {
          x: lane.randomX(52),
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
              emitAimedBurst(
                ctx.spawnEnemyBullet,
                ctx.player,
                pos.x,
                pos.y,
                scaledCount(6, gate.bulletScale, 4),
                0.7,
                190,
                {
                  r: 4,
                  color: "#ff95f1",
                  wobble: 3.5,
                }
              );
              ai.nextShot = 1.6;
            }
          },
        });
        if (gate.escortScale > 0.5) {
          ctx.spawnEnemy("shard", {
            x: lane.randomX(56),
            y: -28,
            vx: rand(-42, 42),
            vy: 105,
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
                  scaledCount(inLoopTwo ? 12 : 8, gate.bulletScale, 5),
                  165,
                  {
                    r: 3,
                    color: "#a5d9ff",
                    turn: rand(-0.9, 0.9),
                  }
                );
                ai.nextShot = 1.45;
              }
            },
          });
        }
        stageState.nextWeaver += 4.8 * loopScale;
      }
    }

    if (t > stageState.nextBurst) {
      const burstEscort = inLoopTwo;
      const gate = gateRecurringWave(stageState, "nextBurst", t, ctx, {
        enemyCost: burstEscort ? 2 : 1,
        bulletCost: burstEscort ? 10 : 7,
        priority: "normal",
      });
      if (gate) {
        const sign = Math.random() < 0.5 ? -1 : 1;
        ctx.spawnEnemy("harp", {
          x: sign < 0 ? lane.leftEdge - 40 : lane.rightEdge + 40,
          y: rand(80, ctx.view.height * 0.35),
          vx: sign * rand(80, 120),
          vy: rand(10, 30),
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitSpiral(
                ctx.spawnEnemyBullet,
                pos.x,
                pos.y,
                scaledCount(9, gate.bulletScale, 6),
                150,
                0.45,
                {
                  r: 3,
                  color: "#ff6ad5",
                  turn: -0.5,
                }
              );
              ai.nextShot = 2.2;
            }
          },
        });
        if (burstEscort && gate.escortScale > 0.5) {
          ctx.spawnEnemy("shard", {
            x: sign < 0 ? lane.rightEdge + 30 : lane.leftEdge - 30,
            y: rand(100, ctx.view.height * 0.32),
            vx: sign * 130,
            vy: 24,
            fire(enemy, dtInner) {
              const ai = enemy.components.ai;
              const pos = enemy.components.position;
              if (!ai || !pos) return;
              ai.nextShot = (ai.nextShot || 0) - dtInner;
              if (ai.nextShot <= 0) {
                emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(7, gate.bulletScale, 4), 170, {
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
    }

    if (!stageState.latticeDone && t >= 11) {
      const wave = resolveOneShotWave(ctx, {
        enemyCost: 7,
        bulletCost: 18,
        priority: "setpiece",
      });
      if (wave.mode !== "defer") {
        stageState.latticeDone = true;
        const gate = wave.gate;
        const latticeFractions = wave.mode === "full" ? [0.22, 0.5, 0.78] : [0.5];
        for (const laneFraction of latticeFractions) {
          ctx.spawnEnemy("weaver", {
            x: lane.laneX(laneFraction),
            y: -30,
            vx: 0,
            vy: 52,
            hp: inLoopTwo ? 9 : 7,
            dropKey: laneFraction === 0.5 ? "halo-shield" : undefined,
            scoreBonus: laneFraction === 0.5 ? 180 : 0,
            scoreShardCount: laneFraction === 0.5 ? 4 : 0,
            label: laneFraction === 0.5 ? "Lattice Heart" : "",
            fire(enemy, dtInner) {
              const ai = enemy.components.ai;
              const pos = enemy.components.position;
              if (!ai || !pos) return;
              ai.nextShot = (ai.nextShot || 0) - dtInner;
              if (ai.nextShot <= 0) {
                emitAimedBurst(
                  ctx.spawnEnemyBullet,
                  ctx.player,
                  pos.x,
                  pos.y,
                  scaledCount(inLoopTwo ? 8 : 6, gate.bulletScale, 4),
                  0.68,
                  205,
                  {
                    r: 3,
                    color: "#ff9be8",
                    wobble: 3.4,
                  }
                );
                ai.nextShot = 1.4;
              }
            },
          });
        }
        if (wave.mode === "full" && gate.escortScale > 0.5) {
          for (let i = 0; i < 4; i++) {
            ctx.spawnEnemy("shard", {
              x: lane.laneX((i + 0.5) / 4),
              y: -48 - i * 22,
              vx: i % 2 === 0 ? -34 : 34,
              vy: 112,
              fire(enemy, dtInner) {
                const ai = enemy.components.ai;
                const pos = enemy.components.position;
                if (!ai || !pos) return;
                ai.nextShot = (ai.nextShot || 0) - dtInner;
                if (ai.nextShot <= 0) {
                  emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(9, gate.bulletScale, 5), 170, {
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
      }
    }

    if (!stageState.eliteDone && t >= 18) {
      const wave = resolveOneShotWave(ctx, {
        enemyCost: 3,
        bulletCost: 18,
        priority: "elite",
      });
      if (wave.mode !== "defer") {
        stageState.eliteDone = true;
        const gate = wave.gate;
        ctx.spawnEnemy("weaver", {
          x: lane.laneX(0.5),
          y: -40,
          vx: 0,
          vy: 46,
          hp: inLoopTwo ? 20 : 16,
          r: 24,
          elite: true,
          dropKey: "pierce",
          scoreBonus: 300,
          scoreShardCount: 5,
          label: "Refraction Cantor",
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitAimedBurst(
                ctx.spawnEnemyBullet,
                ctx.player,
                pos.x,
                pos.y,
                scaledCount(inLoopTwo ? 8 : 6, gate.bulletScale, 4),
                0.62,
                225,
                {
                  r: 4,
                  color: "#ffd5ff",
                  wobble: 4.2,
                }
              );
              emitRadial(
                ctx.spawnEnemyBullet,
                pos.x,
                pos.y,
                scaledCount(inLoopTwo ? 16 : 12, gate.bulletScale, 8),
                150,
                {
                  r: 3,
                  color: "#9efbff",
                  turn: -0.5,
                }
              );
              ai.nextShot = 1.1;
            }
          },
        });
        if (wave.mode === "full" && gate.escortScale > 0.5) {
          for (const offset of [-110, 110]) {
            ctx.spawnEnemy("shard", {
              x: lane.laneX(0.5) + offset,
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
                  emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(10, gate.bulletScale, 6), 175, {
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
      }
    }

    if (!stageState.amplifierEliteDone && t >= 23) {
      const wave = resolveOneShotWave(ctx, {
        enemyCost: 3,
        bulletCost: 16,
        priority: "elite",
      });
      if (wave.mode !== "defer") {
        stageState.amplifierEliteDone = true;
        const gate = wave.gate;
        ctx.spawnEnemy("harp", {
          x: lane.laneX(0.5),
          y: -46,
          vx: 0,
          vy: 38,
          hp: inLoopTwo ? 16 : 13,
          r: 24,
          elite: true,
          dropKey: "amplifier",
          scoreBonus: 290,
          scoreShardCount: 5,
          label: "Refraction Harrow",
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitSpiral(
                ctx.spawnEnemyBullet,
                pos.x,
                pos.y,
                scaledCount(inLoopTwo ? 11 : 9, gate.bulletScale, 6),
                158,
                0.4,
                {
                  r: 3,
                  color: "#ffe7ad",
                  turn: 0.58,
                }
              );
              emitAimedBurst(
                ctx.spawnEnemyBullet,
                ctx.player,
                pos.x,
                pos.y,
                scaledCount(5, gate.bulletScale, 3),
                0.22,
                225,
                {
                  r: 3,
                  color: "#ff9be8",
                  wobble: 4,
                }
              );
              ai.nextShot = 1.08;
            }
          },
        });
        if (wave.mode === "full" && gate.escortScale > 0.5) {
          for (const offset of [-132, 132]) {
            ctx.spawnEnemy("shard", {
              x: lane.laneX(0.5) + offset,
              y: -38,
              vx: offset < 0 ? 36 : -36,
              vy: 104,
              fire(enemy, dtInner) {
                const ai = enemy.components.ai;
                const pos = enemy.components.position;
                if (!ai || !pos) return;
                ai.nextShot = (ai.nextShot || 0) - dtInner;
                if (ai.nextShot <= 0) {
                  emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(8, gate.bulletScale, 5), 172, {
                    r: 3,
                    color: "#d9f6ff",
                    turn: offset < 0 ? 0.75 : -0.75,
                  });
                  ai.nextShot = 1.15;
                }
              },
            });
          }
        }
      }
    }

    if (inLoopTwo && !stageState.chainSigilDone && t >= 24.6) {
      const wave = resolveOneShotWave(ctx, {
        enemyCost: 3,
        bulletCost: 14,
        priority: "setpiece",
      });
      if (wave.mode !== "defer") {
        stageState.chainSigilDone = true;
        const gate = wave.gate;
        ctx.spawnEnemy("harp", {
          x: lane.laneX(0.5),
          y: -42,
          vx: 0,
          vy: 46,
          hp: 10,
          r: 22,
          risk: true,
          dropKey: "chain-sigil",
          scoreBonus: 180,
          scoreShardCount: 6,
          label: "Exposed Sigil",
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitSpiral(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(12, gate.bulletScale, 7), 165, 0.52, {
                r: 3,
                color: "#ff8f8f",
                turn: -0.68,
              });
              ai.nextShot = 1.2;
            }
          },
        });
        if (wave.mode === "full" && gate.escortScale > 0.5) {
          for (const offset of [-150, 150]) {
            ctx.spawnEnemy("shard", {
              x: lane.laneX(0.5) + offset,
              y: ctx.view.height * 0.18,
              vx: offset < 0 ? 66 : -66,
              vy: 26,
              fire(enemy, dtInner) {
                const ai = enemy.components.ai;
                const pos = enemy.components.position;
                if (!ai || !pos) return;
                ai.nextShot = (ai.nextShot || 0) - dtInner;
                if (ai.nextShot <= 0) {
                  emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, scaledCount(7, gate.bulletScale, 4), 178, {
                    r: 3,
                    color: "#ffe5ff",
                    turn: offset < 0 ? -0.48 : 0.48,
                  });
                  ai.nextShot = 1.15;
                }
              },
            });
          }
        }
      }
    }
  },
};
