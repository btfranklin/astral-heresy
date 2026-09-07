import test from "node:test";
import assert from "node:assert/strict";
import { spawnEnemy, updateEnemies } from "../../../src/systems/enemySystem.js";
import { createShowcaseScene, updateShowcaseScene } from "../../../src/debug/showcase.js";
import { makeState } from "../../helpers/fixtures.mjs";

test("attack release follows shot resets without changing shot cadence", () => {
  const { state } = makeState();
  let shots = 0;
  const enemy = spawnEnemy(state, "harp", {
    x: 640, y: 200, vx: 0, vy: 0,
    fire(entity, dt) {
      const ai = entity.components.ai;
      ai.nextShot -= dt;
      if (ai.nextShot <= 0) {
        shots++;
        ai.nextShot = 1;
      }
    },
  });
  updateEnemies(state, 0.01);
  assert.equal(shots, 1);
  assert.equal(enemy.components.ai.attackRelease, 0.18);
  updateEnemies(state, 0.2);
  assert.equal(enemy.components.ai.attackRelease, 0);
  assert.equal(enemy.components.ai.nextShot, 0.8);
  updateEnemies(state, 0.81);
  assert.equal(shots, 2);
  assert.equal(enemy.components.ai.attackRelease, 0.18);
  updateEnemies(state, 1.1);
  assert.equal(shots, 3);
  assert.equal(enemy.components.ai.attackRelease, 0.18);
});

test("enemy study previews preparation and release without firing", () => {
  const { state, player } = makeState();
  createShowcaseScene(state, player, { type: "enemy", key: "fang" });
  updateShowcaseScene(state, 1.9);
  const ai = state.entities[0].components.ai;
  assert.ok(ai.nextShot > 0 && ai.nextShot < 0.38);
  assert.equal(ai.attackRelease, 0);
  updateShowcaseScene(state, 0.15);
  assert.ok(ai.attackRelease > 0);
  assert.equal(state.entities.length, 1);
  assert.equal(state.entities[0].type, "enemy");
});
