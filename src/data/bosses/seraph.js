import { emitAimedBurst, emitRadial, emitSpiral, runCooldown } from "../patterns.js";

export const bossDefinitionSeraph = {
  key: "seraph",
  name: "Seraph of Orbits",
  showcaseLabel: "Boss Study: Seraph of Orbits",
  renderKey: "seraph",
  spawnY: -160,
  r: 70,
  hp: 480,
  phases: [
    {
      name: "Crown Spiral",
      hp: 160,
      pattern(boss, dt, ctx) {
        runCooldown(boss, "crown-spiral-radial", 1.6, dt, () => {
          emitRadial(ctx.spawnEnemyBullet, boss.x, boss.y, 28, 160, {
            r: 3,
            color: "#86ffe2",
            turn: 0.6,
            offset: boss.phaseTime * 0.6,
          });
        });
        runCooldown(boss, "crown-spiral-aimed", 1.1, dt, () => {
          emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, boss.x, boss.y, 7, 0.5, 220, {
            r: 4,
            color: "#ff7dd6",
            wobble: 3.2,
          });
        });
        if (ctx.loopIndex > 0) {
          runCooldown(boss, "crown-spiral-loop", 2.2, dt, () => {
            emitRadial(ctx.spawnEnemyBullet, boss.x, boss.y, 18, 175, {
              r: 3,
              color: "#ffe8a6",
              turn: -0.45,
            });
          });
        }
      },
    },
    {
      name: "Halo Bloom",
      hp: 160,
      weakpoint: {
        radius: 15,
        interval: 2.7,
        duration: 1.05,
        offset: { x: 0, y: -46 },
        rotationSpeed: 1.7,
        damageMultiplier: 3,
        bonusScore: 22,
        color: "#fff2c7",
      },
      pattern(boss, dt, ctx) {
        runCooldown(boss, "halo-bloom-spiral", 0.8, dt, () => {
          emitSpiral(ctx.spawnEnemyBullet, boss.x, boss.y, 16, 180, 0.45, {
            r: 3,
            color: "#7ad7ff",
            turn: -0.8,
          });
        });
        runCooldown(boss, "halo-bloom-radial", 2.2, dt, () => {
          emitRadial(ctx.spawnEnemyBullet, boss.x, boss.y, 20, 120, {
            r: 5,
            color: "#ffd480",
            wobble: 2.6,
          });
        });
        if (ctx.loopIndex > 0) {
          runCooldown(boss, "halo-bloom-loop", 1.35, dt, () => {
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, boss.x, boss.y - 18, 5, 0.36, 240, {
              r: 3,
              color: "#ffd58e",
            });
          });
        }
      },
    },
    {
      name: "Starfall Rite",
      hp: 160,
      pattern(boss, dt, ctx) {
        runCooldown(boss, "starfall-rite-lanes", 2.6, dt, () => {
          const lanes = 9;
          for (let i = 0; i < lanes; i++) {
            const x = (ctx.view.width * (i + 0.5)) / lanes;
            emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, x, boss.y + 60, 1, 0, 240, {
              r: 4,
              color: "#ffa7f0",
              homing: 0.35,
            });
          }
        });
        if (ctx.loopIndex > 0) {
          runCooldown(boss, "starfall-loop", 1.8, dt, () => {
            emitRadial(ctx.spawnEnemyBullet, boss.x, boss.y, 14, 180, {
              r: 3,
              color: "#86ffe2",
              turn: 0.65,
            });
          });
        }
      },
    },
  ],
};
