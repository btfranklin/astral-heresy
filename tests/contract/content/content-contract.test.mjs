import test from "node:test";
import assert from "node:assert/strict";

import { bossDefinitions, createBossInstance, getBossDefinition, listBossShowcaseEntries } from "../../../src/data/bosses.js";
import { enemyArchetypes, getEnemyArchetype, listEnemyShowcaseEntries } from "../../../src/data/enemies.js";
import { listPatternHelpers } from "../../../src/data/patterns.js";
import { getPowerupDefinition, listPowerupKeys } from "../../../src/data/powerups.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { listBossRendererKeys } from "../../../src/rendering/bossRenderers.js";
import { listEnemyRendererKeys } from "../../../src/rendering/enemyRenderers.js";
import { getBulletEnvelope } from "../../../src/state/playfieldState.js";
import { makeContentContext } from "../../helpers/fixtures.mjs";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function assertFiniteSpawnSurface(spawn, label) {
  assert.equal(isFiniteNumber(spawn.x), true, `${label} x must be finite.`);
  assert.equal(isFiniteNumber(spawn.y), true, `${label} y must be finite.`);
}

function assertUniqueKeys(items, label) {
  const keys = items.map((item) => item.key);
  const unique = new Set(keys);
  assert.equal(unique.size, keys.length, `${label} keys must be unique.`);
}

function validatePhase(phase, bossName, phaseIndex, ctx) {
  assert.equal(Boolean(phase && typeof phase === "object"), true, `${bossName} phase ${phaseIndex + 1} must be an object.`);
  assert.equal(typeof phase.name, "string");
  assert.equal(isFiniteNumber(phase.hp) && phase.hp > 0, true);
  assert.equal(typeof phase.pattern, "function");

  if (phase.weakpoint) {
    assert.equal(isFiniteNumber(phase.weakpoint.radius) && phase.weakpoint.radius > 0, true);
    assert.equal(isFiniteNumber(phase.weakpoint.interval) && phase.weakpoint.interval > 0, true);
    assert.equal(isFiniteNumber(phase.weakpoint.duration) && phase.weakpoint.duration > 0, true);
    assert.equal(isFiniteNumber(phase.weakpoint.damageMultiplier) && phase.weakpoint.damageMultiplier > 1, true);
    assert.equal(isFiniteNumber(phase.weakpoint.bonusScore) && phase.weakpoint.bonusScore >= 0, true);
  }

  const before = ctx.spawnEnemyBulletCalls.length;
  phase.pattern(
    {
      x: 640,
      y: 160,
      phaseTime: 0.25,
      cooldowns: Object.create(null),
    },
    0.016,
    ctx
  );
  const spawned = ctx.spawnEnemyBulletCalls.slice(before);
  for (const bullet of spawned) {
    assertFiniteSpawnSurface(bullet, `${bossName} phase ${phaseIndex + 1} bullet`);
    assert.equal(isFiniteNumber(bullet.angle), true, `${bossName} phase ${phaseIndex + 1} bullet angle must be finite.`);
    assert.equal(isFiniteNumber(bullet.speed) && bullet.speed >= 0, true, `${bossName} phase ${phaseIndex + 1} bullet speed must be finite and non-negative.`);
  }

  if (bossName === "Seraph of Orbits" && phase.name === "Starfall Rite") {
    const laneShots = spawned.filter(({ opts }) => opts?.color === "#ffa7f0");
    const envelope = getBulletEnvelope(ctx.playfield, ctx.view.width);
    assert.equal(laneShots.length, 9, "Seraph phase 3 should emit one lane shot per lane.");
    assert.equal(
      laneShots.every(({ x }) => x >= envelope.minX && x <= envelope.maxX),
      true,
      "Seraph phase 3 should stay inside the active desktop bullet envelope."
    );
  }
}

test("content registries stay keyed, renderable, and contract-valid", () => {
  const ctx = makeContentContext();
  const enemyRendererKeys = new Set(listEnemyRendererKeys());
  const bossRendererKeys = new Set(listBossRendererKeys());

  assert.equal(enemyArchetypes.length > 0, true);
  assert.equal(stageDefinitions.length > 0, true);
  assert.equal(bossDefinitions.length > 0, true);

  assertUniqueKeys(enemyArchetypes, "Enemy archetype");
  assertUniqueKeys(stageDefinitions, "Stage");
  assertUniqueKeys(bossDefinitions, "Boss");

  for (const archetype of enemyArchetypes) {
    assert.equal(typeof archetype.key, "string");
    assert.equal(typeof archetype.showcaseLabel, "string");
    assert.equal(isFiniteNumber(archetype.r) && archetype.r > 0, true);
    assert.equal(isFiniteNumber(archetype.hp) && archetype.hp > 0, true);
    assert.equal(enemyRendererKeys.has(archetype.renderKey), true);
    assert.equal(Boolean(getEnemyArchetype(archetype.key)), true);
  }

  for (const bossDefinition of bossDefinitions) {
    assert.equal(typeof bossDefinition.key, "string");
    assert.equal(typeof bossDefinition.name, "string");
    assert.equal(typeof bossDefinition.showcaseLabel, "string");
    assert.equal(bossRendererKeys.has(bossDefinition.renderKey), true);
    assert.equal(Array.isArray(bossDefinition.phases) && bossDefinition.phases.length > 0, true);

    const boss = createBossInstance(bossDefinition.key, ctx);
    assert.equal(boss.name, bossDefinition.name);
    assert.equal(boss.phaseHp, bossDefinition.phases[0].hp);
    bossDefinition.phases.forEach((phase, index) => validatePhase(phase, bossDefinition.name, index, ctx));
  }

  for (const stage of stageDefinitions) {
    assert.equal(typeof stage.key, "string");
    assert.equal(typeof stage.name, "string");
    assert.equal(isFiniteNumber(stage.duration) && stage.duration > 0, true);
    assert.equal(typeof stage.init, "function");
    assert.equal(typeof stage.update, "function");
    assert.equal(Boolean(getBossDefinition(stage.bossKey)), true);

    const stageState = stage.init();
    stage.update(stageState, 0, 0.016, ctx);
    stage.update(stageState, stage.duration * 0.5, 0.016, ctx);
    stage.update(stageState, stage.duration * 0.8, 0.016, ctx);
  }

  const validPickupKeys = new Set(listPowerupKeys());
  const validEnemyKeys = new Set(enemyArchetypes.map((archetype) => archetype.key));
  for (const spawn of ctx.spawnEnemyCalls) {
    assert.equal(validEnemyKeys.has(spawn.archetypeKey), true, `Unknown enemy archetype spawned by content: ${spawn.archetypeKey}`);
    if (spawn.overrides?.x !== undefined) {
      assert.equal(isFiniteNumber(spawn.overrides.x), true, `${spawn.archetypeKey} spawn x override must be finite.`);
    }
    if (spawn.overrides?.y !== undefined) {
      assert.equal(isFiniteNumber(spawn.overrides.y), true, `${spawn.archetypeKey} spawn y override must be finite.`);
    }
  }

  for (const spawn of ctx.spawnPickupCalls) {
    assert.equal(validPickupKeys.has(spawn.kind), true, `Unknown pickup spawned by content: ${spawn.kind}`);
    assertFiniteSpawnSurface(spawn, `${spawn.kind} pickup spawn`);
  }

  for (const shardSpawn of ctx.spawnScoreShardCalls) {
    assertFiniteSpawnSurface(shardSpawn, "Score shard spawn");
    assert.equal(Number.isInteger(shardSpawn.count) && shardSpawn.count > 0, true, "Score shard spawns must request a positive integer count.");
  }

  for (const { overrides } of ctx.spawnEnemyCalls) {
    if (!overrides?.dropKey) continue;
    assert.equal(validPickupKeys.has(overrides.dropKey), true);
    const definition = getPowerupDefinition(overrides.dropKey);
    if (definition?.category === "weapon") {
      assert.equal(Boolean(overrides.elite), true, `${overrides.dropKey} should stay attached to an elite beat.`);
    }
  }

  const enemyShowcaseKeys = new Set(listEnemyShowcaseEntries().map((entry) => entry.key));
  const bossShowcaseKeys = new Set(listBossShowcaseEntries().map((entry) => entry.key));
  assert.equal(enemyShowcaseKeys.size, enemyArchetypes.length);
  assert.equal(bossShowcaseKeys.size, bossDefinitions.length);

  assert.equal(listPatternHelpers().includes("runCooldown"), true);
  assert.equal(listPatternHelpers().includes("resetCooldowns"), true);
});
