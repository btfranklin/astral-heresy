import test from "node:test";
import assert from "node:assert/strict";
import { spawnDefeatParticles, spawnParticle, updateParticles } from "../../../src/systems/particleSystem.js";
import { flushEntities } from "../../../src/entities/entityFactory.js";
import { updateMovement } from "../../../src/systems/movementSystem.js";
import { enemyArchetypes } from "../../../src/data/enemies.js";
import { rewardKill } from "../../../src/systems/collisionInternals.js";
import { defeatBoss } from "../../../src/systems/bossSystem.js";
import { spawnEnemy } from "../../../src/systems/enemySystem.js";
import { makeAudioSpy, makeState } from "../../helpers/fixtures.mjs";

const families = {
  feather: ["cherub", "halo", "oracle", "throne", "seraph"],
  crystal: ["shard", "weaver", "harp", "prism"],
  rib: ["spear", "fang", "cathedral"],
};

test("all authored enemy families produce bounded debris that moves and expires", () => {
  for (const archetype of enemyArchetypes) {
    assert.ok(Object.values(families).flat().includes(archetype.renderKey));
  }
  for (const [shape, keys] of Object.entries(families)) {
    for (const key of keys) {
      const state = { entities: [] };
      const isBoss = ["seraph", "prism", "cathedral"].includes(key);
      spawnDefeatParticles(state, 40, 50, key, spawnParticle, isBoss);
      assert.equal(state.entities.length, isBoss ? 120 : 18);
      assert.equal(state.entities.filter((entity) => entity.components.render.shape === shape).length, isBoss ? 36 : 8);
      if (shape === "rib") {
        assert.ok(state.entities.some((entity) => entity.components.render.shape === "ash"));
      }
      updateMovement(state, 0.2);
      assert.ok(state.entities.every((entity) => Math.hypot(entity.components.position.x - 40, entity.components.position.y - 50) > 0));
      updateParticles(state, 2);
      flushEntities(state);
      assert.equal(state.entities.length, 0);
    }
  }
});

test("enemy reward and boss defeat use their visual family without changing kill credit", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const enemy = spawnEnemy(state, "fang", { x: 40, y: 50 });
  const calls = [];
  const spawn = (...args) => calls.push(args);
  rewardKill(state, player, enemy, enemy.components.position, enemy.components.health, audio, spawn, () => {}, () => {});
  assert.equal(calls[0][8], "rib");
  assert.equal(state.kills, 1);
  const boss = { key: "seraph", x: 40, y: 50 };
  state.boss = boss;
  defeatBoss(state, player, boss, spawn, audio, Array(10));
  assert.equal(calls.at(-2)[8], "feather");
  assert.equal(state.kills, 2);
  assert.equal(state.boss, null);
});

test("general particles retain the glow style and unknown defeat keys retain the existing burst", () => {
  const state = { entities: [] };
  spawnParticle(state, 0, 0, "#ffffff", 2, 10, 1, 3);
  spawnDefeatParticles(state, 0, 0, "unknown", spawnParticle);
  assert.equal(state.entities.length, 20);
  assert.ok(state.entities.every((entity) => entity.components.render.shape === undefined));
});
