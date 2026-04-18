import { lerp, rand } from "../../core/math.js";
import { scaledCount } from "../../core/director.js";
import { emitAimedBurst, emitRadial, emitSpiral } from "../patterns.js";
import { gateRecurringWave, resolveOneShotWave } from "../stageRuntime.js";

export const stageNebula = {
  key: "nebula-gate",
  name: "Nebula Gate",
  duration: 26,
  bossKey: "seraph",
  densityTiers: [
    { until: 8, maxEnemies: 4, maxEnemyBullets: 24 },
    { until: 16, maxEnemies: 5, maxEnemyBullets: 34 },
    { until: Infinity, maxEnemies: 6, maxEnemyBullets: 42 },
  ],
  init() {
    return {
      nextSwoop: 1.2,
      nextRing: 5.4,
      nextSine: 8.5,
      corridorDone: false,
      eliteDone: false,
      orbitalsEliteDone: false,
    };
  },
  update(stageState, t, dt, ctx) {
    const lane = ctx.playfield;
    const loopScale = ctx.loopIndex > 0 ? 0.88 : 1;
    const inLoopTwo = ctx.loopIndex > 0;

    if (t > stageState.nextSwoop) {
      const escortActive = t > 10;
      const gate = gateRecurringWave(stageState, "nextSwoop", t, ctx, {
        enemyCost: escortActive ? 2 : 1,
        bulletCost: escortActive ? 8 : 3,
        priority: "normal",
      });
      if (gate) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const startX = side < 0 ? lane.leftEdge - 42 : lane.rightEdge + 42;
        const primaryBurst = t < 10 ? 2 : scaledCount(4, gate.bulletScale, 2);
        ctx.spawnEnemy("cherub", {
          x: startX,
          y: rand(90, ctx.view.height * 0.34),
          vx: side * rand(86, 132),
          vy: rand(20, 44),
          behavior(enemy, dtInner) {
            const vel = enemy.components.velocity;
            if (!vel) return;
            vel.vy = lerp(vel.vy, 18, dtInner * 0.8);
          },
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, pos.x, pos.y, primaryBurst, 0.34, 180, {
                r: 4,
                color: "#ffa7f0",
              });
              ai.nextShot = 1.7 + Math.random() * 0.35;
            }
          },
        });
        if (escortActive && gate.escortScale > 0.5) {
          ctx.spawnEnemy("cherub", {
            x: side < 0 ? lane.rightEdge + 38 : lane.leftEdge - 38,
            y: rand(110, ctx.view.height * 0.36),
            vx: -side * rand(108, 144),
            vy: rand(16, 28),
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
                  scaledCount(3, gate.bulletScale, 2),
                  0.2,
                  206,
                  {
                    r: 3,
                    color: "#ffd5ff",
                  }
                );
                ai.nextShot = 1.4;
              }
            },
          });
        }
        stageState.nextSwoop += (t < 10 ? 2.1 : 1.6) * loopScale;
      }
    }

    if (t > stageState.nextRing) {
      const gate = gateRecurringWave(stageState, "nextRing", t, ctx, {
        enemyCost: t > 9 ? 2 : 1,
        bulletCost: t < 12 ? 7 : 14,
        priority: "normal",
      });
      if (gate) {
        const haloCount = t < 12 ? scaledCount(7, gate.bulletScale, 5) : scaledCount(14, gate.bulletScale, 9);
        ctx.spawnEnemy("halo", {
          x: lane.randomX(48),
          y: -30,
          vx: 0,
          vy: rand(50, 78),
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, haloCount, 120, {
                r: 3,
                color: "#85c7ff",
                turn: t < 12 ? rand(-0.26, 0.26) : rand(-0.4, 0.4),
              });
              ai.nextShot = 2.45;
            }
          },
        });
        if (t > 9 && gate.escortScale > 0.5) {
          ctx.spawnEnemy("cherub", {
            x: lane.randomX(52),
            y: -26,
            vx: rand(-40, 40),
            vy: rand(98, 132),
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
                  scaledCount(2, gate.bulletScale, 2),
                  0.12,
                  200,
                  {
                    r: 3,
                    color: "#ff92dc",
                  }
                );
                ai.nextShot = 1.25;
              }
            },
          });
        }
        stageState.nextRing += 4.6 * loopScale;
      }
    }

    if (t > stageState.nextSine) {
      const gate = gateRecurringWave(stageState, "nextSine", t, ctx, {
        enemyCost: inLoopTwo && t > 12 ? 2 : 1,
        bulletCost: t < 12 ? 6 : 9,
        priority: "normal",
      });
      if (gate) {
        const spiralCount = t < 12 ? scaledCount(5, gate.bulletScale, 4) : scaledCount(6, gate.bulletScale, 4);
        ctx.spawnEnemy("oracle", {
          x: lane.randomX(56),
          y: -20,
          vx: 0,
          vy: rand(40, 68),
          wobble: rand(1.8, 2.6),
          behavior(enemy, dtInner) {
            const pos = enemy.components.position;
            const ai = enemy.components.ai;
            if (!pos || !ai) return;
            pos.x += Math.sin(ai.t * ai.wobble) * 72 * dtInner;
          },
          fire(enemy, dtInner) {
            const ai = enemy.components.ai;
            const pos = enemy.components.position;
            if (!ai || !pos) return;
            ai.nextShot = (ai.nextShot || 0) - dtInner;
            if (ai.nextShot <= 0) {
              emitSpiral(ctx.spawnEnemyBullet, pos.x, pos.y, spiralCount, 140, 0.58, {
                r: 3,
                color: "#ffb37f",
                turn: 0.7,
              });
              ai.nextShot = 1.3;
            }
          },
        });
        if (inLoopTwo && t > 12 && gate.escortScale > 0.5) {
          ctx.spawnEnemy("cherub", {
            x: lane.randomX(60),
            y: -28,
            vx: rand(-60, 60),
            vy: rand(92, 128),
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
                  scaledCount(3, gate.bulletScale, 2),
                  0.18,
                  210,
                  {
                    r: 3,
                    color: "#ffc1f7",
                  }
                );
                ai.nextShot = 1.18;
              }
            },
          });
        }
        stageState.nextSine += 3.6 * loopScale;
      }
    }

    if (!stageState.corridorDone && t >= 12) {
      const wave = resolveOneShotWave(ctx, {
        enemyCost: 6,
        bulletCost: 18,
        priority: "setpiece",
      });
      if (wave.mode !== "defer") {
        stageState.corridorDone = true;
        const gate = wave.gate;
        const corridorCount = scaledCount(10, gate.bulletScale, 7);
        const corridorFractions = wave.mode === "full" ? [0.24, 0.38, 0.62, 0.76] : [0.38];
        for (const laneFraction of corridorFractions) {
          ctx.spawnEnemy("halo", {
            x: lane.laneX(laneFraction),
            y: -40,
            vx: 0,
            vy: 58,
            hp: inLoopTwo ? 7 : 6,
            dropKey: laneFraction === 0.38 ? "burst-cell" : undefined,
            scoreBonus: laneFraction === 0.38 ? 180 : 0,
            scoreShardCount: laneFraction === 0.38 ? 4 : 0,
            label: laneFraction === 0.38 ? "Corridor Anchor" : "",
            fire(enemy, dtInner) {
              const ai = enemy.components.ai;
              const pos = enemy.components.position;
              if (!ai || !pos) return;
              ai.nextShot = (ai.nextShot || 0) - dtInner;
              if (ai.nextShot <= 0) {
                emitRadial(ctx.spawnEnemyBullet, pos.x, pos.y, corridorCount, 150, {
                  r: 3,
                  color: "#9efbff",
                  turn: laneFraction < 0.5 ? 0.34 : -0.34,
                });
                ai.nextShot = 1.85;
              }
            },
          });
        }
        if (wave.mode === "full" && gate.escortScale > 0.5) {
          for (const side of [-1, 1]) {
            ctx.spawnEnemy("cherub", {
              x: side < 0 ? lane.leftEdge - 44 : lane.rightEdge + 44,
              y: ctx.view.height * 0.28,
              vx: side * 142,
              vy: 24,
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
                    scaledCount(4, gate.bulletScale, 3),
                    0.36,
                    210,
                    {
                      r: 3,
                      color: "#ff8fd8",
                    }
                  );
                  ai.nextShot = 1.55;
                }
              },
            });
          }
        }
      }
    }

    if (!stageState.eliteDone && t >= 17.5) {
      const wave = resolveOneShotWave(ctx, {
        enemyCost: 3,
        bulletCost: 16,
        priority: "elite",
      });
      if (wave.mode !== "defer") {
        stageState.eliteDone = true;
        const gate = wave.gate;
        ctx.spawnEnemy("halo", {
          x: lane.laneX(0.5),
          y: -60,
          vx: 0,
          vy: 44,
          hp: inLoopTwo ? 18 : 14,
          r: 26,
          elite: true,
          dropKey: "spread",
          scoreBonus: 260,
          scoreShardCount: 5,
          label: "Halo Exarch",
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
                scaledCount(inLoopTwo ? 18 : 14, gate.bulletScale, 9),
                160,
                {
                  r: 3,
                  color: "#b8fbff",
                  turn: 0.35,
                }
              );
              emitAimedBurst(
                ctx.spawnEnemyBullet,
                ctx.player,
                pos.x,
                pos.y,
                scaledCount(5, gate.bulletScale, 3),
                0.28,
                220,
                {
                  r: 4,
                  color: "#ffd5ff",
                }
              );
              ai.nextShot = 1.18;
            }
          },
        });
        if (wave.mode === "full" && gate.escortScale > 0.5) {
          for (const side of [-1, 1]) {
            ctx.spawnEnemy("cherub", {
              x: lane.laneX(0.5) + side * 96,
              y: -30,
              vx: side * 24,
              vy: 88,
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
                    scaledCount(inLoopTwo ? 4 : 3, gate.bulletScale, 2),
                    0.2,
                    210,
                    {
                      r: 3,
                      color: "#ffa7f0",
                    }
                  );
                  ai.nextShot = 1.08;
                }
              },
            });
          }
        }
      }
    }

    if (!stageState.orbitalsEliteDone && t >= 22) {
      const wave = resolveOneShotWave(ctx, {
        enemyCost: 3,
        bulletCost: 14,
        priority: "elite",
      });
      if (wave.mode !== "defer") {
        stageState.orbitalsEliteDone = true;
        const gate = wave.gate;
        ctx.spawnEnemy("oracle", {
          x: lane.laneX(0.5),
          y: -54,
          vx: 0,
          vy: 42,
          hp: inLoopTwo ? 18 : 14,
          r: 25,
          elite: true,
          dropKey: "orbitals",
          scoreBonus: 280,
          scoreShardCount: 5,
          label: "Aurora Regent",
          wobble: 2.2,
          behavior(enemy, dtInner) {
            const pos = enemy.components.position;
            const ai = enemy.components.ai;
            if (!pos || !ai) return;
            pos.x += Math.sin(ai.t * 1.5) * 92 * dtInner;
          },
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
                scaledCount(inLoopTwo ? 8 : 6, gate.bulletScale, 4),
                150,
                0.5,
                {
                  r: 3,
                  color: "#9efbff",
                  turn: 0.95,
                }
              );
              emitAimedBurst(
                ctx.spawnEnemyBullet,
                ctx.player,
                pos.x,
                pos.y,
                scaledCount(4, gate.bulletScale, 2),
                0.18,
                220,
                {
                  r: 3,
                  color: "#ffd5ff",
                }
              );
              ai.nextShot = 1.08;
            }
          },
        });
        if (wave.mode === "full" && gate.escortScale > 0.5) {
          for (const side of [-1, 1]) {
            ctx.spawnEnemy("cherub", {
              x: lane.laneX(0.5) + side * 132,
              y: -34,
              vx: side * 34,
              vy: 86,
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
                    scaledCount(3, gate.bulletScale, 2),
                    0.16,
                    210,
                    {
                      r: 3,
                      color: "#ffc1f7",
                    }
                  );
                  ai.nextShot = 1.12;
                }
              },
            });
          }
        }
      }
    }
  },
};
