import test from "node:test";
import assert from "node:assert/strict";

import { refreshDensityState } from "../../../src/core/director.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { flushEntities } from "../../../src/entities/entityFactory.js";
import { spawnEnemyBullet, updateBullets, cleanupBullets } from "../../../src/systems/bulletSystem.js";
import { spawnEnemy, updateEnemies } from "../../../src/systems/enemySystem.js";
import { updateMovement } from "../../../src/systems/movementSystem.js";
import { makeBossContext, makeState, withRandomSequence } from "../../helpers/fixtures.mjs";

function runStage(stage, seed) {
  const { state, player } = makeState({ seed });
  state.loopIndex = 1;
  const ctx = makeBossContext(state, player, {
    loopIndex: state.loopIndex,
    spawnEnemy: (...args) => spawnEnemy(state, ...args),
    spawnEnemyBullet: (...args) => spawnEnemyBullet(state, ...args),
  });
  const stageState = stage.init();
  const dt = 1 / 60;
  for (let frame = 0; frame < 24 * 60; frame++) {
    state.time = frame * dt;
    state.stageTime = state.time;
    refreshDensityState(state, stage);
    ctx.director.beginFrame();
    stage.update(stageState, state.time, dt, ctx);
    updateBullets(state, player, dt);
    updateEnemies(state, dt);
    updateMovement(state, dt);
    cleanupBullets(state);
    flushEntities(state);
  }
  return state.entities.map(({ id, type, components }) => ({
    id,
    type,
    position: components.position,
    velocity: components.velocity,
    bullet: components.bullet,
    ai: components.ai && {
      t: components.ai.t,
      nextShot: components.ai.nextShot,
      wobble: components.ai.wobble,
    },
  }));
}

for (const stage of stageDefinitions) {
  test(`${stage.key} repeats seeded spawns and fire independently of visual random values`, async () => {
    const first = await withRandomSequence([0.1], () => runStage(stage, 42));
    const second = await withRandomSequence([0.9], () => runStage(stage, 42));
    const different = await withRandomSequence([0.1], () => runStage(stage, 43));
    assert.ok(first.some(({ type }) => type === "enemy"));
    assert.ok(first.some(({ type }) => type === "enemyBullet"));
    assert.deepEqual(second, first);
    assert.notDeepEqual(different, first);
  });
}
