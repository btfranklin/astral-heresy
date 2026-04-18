import { emitAimedBurst, emitRadial, emitSpiral, runCooldown } from "../patterns.js";

export const bossDefinitionCathedral = {
  key: "cathedral",
  name: "Cathedral Maw",
  showcaseLabel: "Boss Study: Cathedral Maw",
  renderKey: "cathedral",
  spawnY: -220,
  r: 110,
  hp: 720,
  phases: [
    {
      name: "Chorus of Fangs",
      hp: 240,
      pattern(boss, dt, ctx) {
        runCooldown(boss, "chorus-of-fangs-radial", 1.3, dt, () => {
          emitRadial(ctx.spawnEnemyBullet, boss.x, boss.y, 26, 170, {
            r: 4,
            color: "#ff8b6a",
            turn: 0.8,
          });
        });
        runCooldown(boss, "chorus-of-fangs-aimed", 1.6, dt, () => {
          emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, boss.x, boss.y, 11, 0.9, 210, {
            r: 3,
            color: "#ffe6a8",
            wobble: 3.8,
          });
        });
      },
    },
    {
      name: "Spine Cathedral",
      hp: 240,
      pattern(boss, dt, ctx) {
        runCooldown(boss, "spine-cathedral-spiral", 0.8, dt, () => {
          emitSpiral(ctx.spawnEnemyBullet, boss.x, boss.y, 18, 190, 0.42, {
            r: 4,
            color: "#ff79b0",
            turn: -0.9,
          });
        });
        runCooldown(boss, "spine-cathedral-arcs", 2.8, dt, () => {
          const arcs = 4;
          for (let i = 0; i < arcs; i++) {
            emitRadial(ctx.spawnEnemyBullet, boss.x, boss.y, 9, 140 + i * 20, {
              r: 3,
              color: "#ffc1f7",
              turn: 0.5 + i * 0.2,
            });
          }
        });
      },
    },
    {
      name: "Maw Singularity",
      hp: 240,
      pattern(boss, dt, ctx) {
        runCooldown(boss, "maw-singularity-radial", 1.8, dt, () => {
          emitRadial(ctx.spawnEnemyBullet, boss.x, boss.y, 30, 150, {
            r: 4,
            color: "#ff6a3d",
            homing: 0.35,
            wobble: 4.6,
          });
        });
        runCooldown(boss, "maw-singularity-lanes", 1.0, dt, () => {
          for (let i = 0; i < 7; i++) {
            const ang = -Math.PI / 2 + (i - 3) * 0.28;
            ctx.spawnEnemyBullet(boss.x, boss.y, ang, 260, {
              r: 5,
              color: "#ffd5ff",
              turn: 0.6,
            });
          }
        });
      },
    },
  ],
};
