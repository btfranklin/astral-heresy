import test from "node:test";
import assert from "node:assert/strict";

import { createRandom } from "../../../src/state/random.js";
import { createGameState, resetGameState } from "../../../src/state/gameState.js";
import { createPlayfieldContext } from "../../../src/state/playfieldState.js";
import { resetLoopTransitionState } from "../../../src/state/runReset.js";
import { createEntity } from "../../../src/entities/entityFactory.js";
import { bulletMotion } from "../../../src/entities/components.js";
import { spawnEnemyBullet } from "../../../src/systems/bulletSystem.js";

test("random streams repeat for boundary seeds and stay in range", () => {
  for (const seed of [0, 1, 0xffffffff]) {
    const first = createRandom(seed);
    const second = createRandom(seed);
    const values = Array.from({ length: 8 }, () => first());
    assert.deepEqual(values, Array.from({ length: 8 }, () => second()));
    assert.ok(values.every((value) => value >= 0 && value < 1));
  }
  assert.notDeepEqual(Array.from({ length: 4 }, createRandom(0)), Array.from({ length: 4 }, createRandom(1)));
  for (const invalidSeed of [-1, 0x100000000, 1.5, "1", NaN, Infinity, -Infinity]) {
    assert.throws(() => createRandom(invalidSeed), RangeError);
  }
});

test("game streams, lane choices, bullets, and entity IDs replay after a fresh reset", () => {
  const state = createGameState({ seed: 0 });
  const other = createGameState({ seed: 0xffffffff });
  state.view.width = 1280;
  state.view.height = 720;
  state.playfield = { active: true, minX: 48, maxX: 1232 };
  const lane = createPlayfieldContext(state);
  const firstLane = lane.randomX(10);
  const firstBullet = spawnEnemyBullet(state, 10, 20, 0, 100);
  const firstId = createEntity(state, "enemy", {}).id;
  const otherValue = other.random();
  assert.equal(state.randomSeed, 0);
  assert.notEqual(state.random(), otherValue);

  resetGameState(state);
  state.playfield = { active: true, minX: 48, maxX: 1232 };
  const replayLane = lane.randomX(10);
  const replayBullet = spawnEnemyBullet(state, 10, 20, 0, 100);
  const replayId = createEntity(state, "enemy", {}).id;
  assert.equal(replayLane, firstLane);
  assert.equal(replayBullet.components.bullet.seed, firstBullet.components.bullet.seed);
  assert.equal(replayId, firstId);
});

test("states with the same seed keep independent random streams and ID counters", () => {
  const first = createGameState({ seed: 42 });
  const second = createGameState({ seed: 42 });
  const firstExpected = createRandom(42);
  const secondExpected = createRandom(42);

  assert.equal(first.random(), firstExpected());
  assert.equal(second.random(), secondExpected());
  assert.equal(first.random(), firstExpected());
  assert.equal(createEntity(first, "enemy", {}).id, 1);
  assert.equal(createEntity(second, "enemy", {}).id, 1);
  assert.equal(createEntity(first, "enemy", {}).id, 2);
  assert.equal(createEntity(second, "enemy", {}).id, 2);
});

test("loop transition does not rewind the random stream and bullet seed zero is explicit", () => {
  const state = createGameState({ seed: 19 });
  state.random();
  const compare = createRandom(19);
  compare();
  resetLoopTransitionState(state, { activePowerups: {}, hp: 5 });
  assert.equal(state.random(), compare());
  assert.equal(bulletMotion({ seed: 0 }).seed, 0);
});

test("an unseeded random wrapper reads Math.random when called", () => {
  const original = Math.random;
  const random = createRandom();
  try {
    Math.random = () => 0.375;
    assert.equal(random(), 0.375);
  } finally {
    Math.random = original;
  }
});
