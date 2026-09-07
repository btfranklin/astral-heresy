import test from "node:test";
import assert from "node:assert/strict";
import { drawBossByKey } from "../../../src/rendering/bossRenderers.js";
import { createBossInstance } from "../../../src/data/bosses.js";
import { makeBossContext, makeState } from "../../helpers/fixtures.mjs";
import { createRecording2dContext } from "../../helpers/runtimeFixture.mjs";

test("Prism crystals stay centered during every phase, opening, and attack pose", () => {
  const { state, player } = makeState();
  const boss = createBossInstance("prism", makeBossContext(state, player));
  boss.x = 413;
  boss.y = 187;

  for (const phaseIndex of [0, 1, 2]) {
    for (const phaseTime of [0, 0.3, 2]) {
      for (const time of [0, 0.7, 4, 11, 25]) {
        for (const cooldown of [1, 0.2, 0]) {
          Object.assign(boss, { phaseIndex, phaseTime, cooldowns: { attack: cooldown } });
          state.time = time;
          const ctx = createRecording2dContext();
          drawBossByKey(ctx, state, boss);
          const translations = ctx.calls.filter(({ type }) => type === "translate");
          assert.deepEqual(translations[0].args, [boss.x, boss.y]);
          const centers = translations.slice(1).map(({ args }) => args);
          assert.ok(centers.length >= 8, "The crystals must surround the core.");
          for (const [x, y] of centers) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y));
            assert.ok(centers.some(([otherX, otherY]) =>
              Math.abs(x + otherX) < 1e-8 && Math.abs(y + otherY) < 1e-8
            ), "Every crystal must have an opposite crystal about the core.");
          }
          for (const axis of [0, 1]) {
            const values = centers.map((center) => center[axis]);
            assert.ok(Math.abs(Math.min(...values) + Math.max(...values)) < 1e-8,
              "The crystal bounds must share the core center.");
          }
        }
      }
    }
  }
});
