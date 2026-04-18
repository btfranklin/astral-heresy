import { emitAimedBurst, emitRadial, emitSpiral, runCooldown } from "../patterns.js";

export const bossDefinitionPrism = {
  key: "prism",
  name: "Prism Leviathan",
  showcaseLabel: "Boss Study: Prism Leviathan",
  renderKey: "prism",
  spawnY: -180,
  r: 90,
  hp: 600,
  phases: [
    {
      name: "Crystal Lattice",
      hp: 200,
      pattern(boss, dt, ctx) {
        runCooldown(boss, "crystal-lattice-radial", 1.4, dt, () => {
          emitRadial(ctx.spawnEnemyBullet, boss.x, boss.y, 24, 150, {
            r: 4,
            color: "#a5d9ff",
            turn: 0.5,
          });
        });
        runCooldown(boss, "crystal-lattice-spiral", 1.0, dt, () => {
          emitSpiral(ctx.spawnEnemyBullet, boss.x, boss.y, 20, 170, 0.55, {
            r: 3,
            color: "#ff95f1",
            wobble: 2.6,
          });
        });
      },
    },
    {
      name: "Refraction Choir",
      hp: 200,
      pattern(boss, dt, ctx) {
        runCooldown(boss, "refraction-choir-aimed", 1.2, dt, () => {
          emitAimedBurst(ctx.spawnEnemyBullet, ctx.player, boss.x, boss.y, 9, 0.75, 230, {
            r: 4,
            color: "#ffd5ff",
            wobble: 4.2,
          });
        });
        runCooldown(boss, "refraction-choir-radial", 2.4, dt, () => {
          emitRadial(ctx.spawnEnemyBullet, boss.x, boss.y, 32, 140, {
            r: 3,
            color: "#9efbff",
            turn: -0.6,
          });
        });
      },
    },
    {
      name: "Prismatic Tide",
      hp: 200,
      pattern(boss, dt, ctx) {
        runCooldown(boss, "prismatic-tide-lanes", 0.6, dt, () => {
          const spread = 1.1;
          for (let i = -3; i <= 3; i++) {
            const ang = -Math.PI / 2 + (i * spread) / 6;
            ctx.spawnEnemyBullet(boss.x, boss.y, ang, 240, {
              r: 4,
              color: "#7ad7ff",
              turn: 0.7,
              wobble: 3.5,
            });
          }
        });
        runCooldown(boss, "prismatic-tide-spiral", 2.8, dt, () => {
          emitSpiral(ctx.spawnEnemyBullet, boss.x, boss.y, 22, 150, 0.35, {
            r: 5,
            color: "#ffd480",
            homing: 0.25,
          });
        });
      },
    },
  ],
};
