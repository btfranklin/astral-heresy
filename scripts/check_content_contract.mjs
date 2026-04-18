#!/usr/bin/env node

import { bossDefinitions, createBossInstance, getBossDefinition, listBossShowcaseEntries } from "../src/data/bosses.js";
import { enemyArchetypes, getEnemyArchetype, listEnemyShowcaseEntries } from "../src/data/enemies.js";
import { listPatternHelpers } from "../src/data/patterns.js";
import { stageDefinitions } from "../src/data/stages.js";
import { listBossRendererKeys } from "../src/rendering/bossRenderers.js";
import { listEnemyRendererKeys } from "../src/rendering/enemyRenderers.js";

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function assertUniqueKeys(items, label) {
  const keys = items.map((item) => item.key);
  const unique = new Set(keys);
  assert(unique.size === keys.length, `${label} keys must be unique.`);
}

function makeContentContext() {
  const spawnEnemyBulletCalls = [];
  const spawnEnemyCalls = [];
  return {
    view: {
      width: 1280,
      height: 720,
      dpr: 1,
    },
    player: {
      x: 640,
      y: 600,
    },
    spawnEnemyBulletCalls,
    spawnEnemyCalls,
    spawnEnemyBullet(x, y, angle, speed, opts = {}) {
      spawnEnemyBulletCalls.push({ x, y, angle, speed, opts });
      return { x, y, angle, speed, opts };
    },
    spawnEnemy(archetypeKey, overrides = {}) {
      assert(getEnemyArchetype(archetypeKey), `Unknown enemy archetype requested by content: ${archetypeKey}.`);
      spawnEnemyCalls.push({ archetypeKey, overrides });
      return { archetypeKey, overrides };
    },
  };
}

function validateEnemyArchetype(archetype, enemyRendererKeys) {
  assert(archetype && typeof archetype === "object", "Enemy archetypes must be objects.");
  assert(typeof archetype.key === "string" && archetype.key.length > 0, "Enemy archetypes must define key.");
  assert(
    typeof archetype.showcaseLabel === "string" && archetype.showcaseLabel.length > 0,
    `${archetype.key} must define showcaseLabel.`
  );
  assert(isFiniteNumber(archetype.r) && archetype.r > 0, `${archetype.key} must define a positive radius.`);
  assert(isFiniteNumber(archetype.hp) && archetype.hp > 0, `${archetype.key} must define positive hp.`);
  assert(
    typeof archetype.renderKey === "string" && enemyRendererKeys.has(archetype.renderKey),
    `${archetype.key} must reference a registered enemy renderer key.`
  );
}

function validatePhase(phase, bossName, phaseIndex, ctx) {
  assert(phase && typeof phase === "object", `${bossName} phase ${phaseIndex + 1} must be an object.`);
  assert(typeof phase.name === "string" && phase.name.length > 0, `${bossName} phase ${phaseIndex + 1} is missing a name.`);
  assert(isFiniteNumber(phase.hp) && phase.hp > 0, `${bossName} phase ${phaseIndex + 1} must declare a positive hp value.`);
  assert(typeof phase.pattern === "function", `${bossName} phase ${phaseIndex + 1} must expose pattern(boss, dt, ctx).`);

  const before = ctx.spawnEnemyBulletCalls.length;
  const fakeBossState = {
    x: 640,
    y: 160,
    phaseTime: 0.25,
    cooldowns: Object.create(null),
  };
  phase.pattern(fakeBossState, 0.016, ctx);
  assert(
    ctx.spawnEnemyBulletCalls.length >= before,
    `${bossName} phase ${phaseIndex + 1} pattern execution should not remove spawn records.`
  );
}

function validateBossDefinition(definition, ctx, bossRendererKeys) {
  assert(definition && typeof definition === "object", "Boss definitions must be objects.");
  assert(typeof definition.key === "string" && definition.key.length > 0, "Boss definitions must define key.");
  assert(typeof definition.name === "string" && definition.name.length > 0, `${definition.key} must define name.`);
  assert(
    typeof definition.showcaseLabel === "string" && definition.showcaseLabel.length > 0,
    `${definition.key} must define showcaseLabel.`
  );
  assert(
    typeof definition.renderKey === "string" && bossRendererKeys.has(definition.renderKey),
    `${definition.key} must reference a registered boss renderer key.`
  );
  assert(isFiniteNumber(definition.spawnY), `${definition.key} must define numeric spawnY.`);
  assert(isFiniteNumber(definition.r) && definition.r > 0, `${definition.key} must define a positive radius.`);
  assert(isFiniteNumber(definition.hp) && definition.hp > 0, `${definition.key} must define positive hp.`);
  assert(Array.isArray(definition.phases) && definition.phases.length > 0, `${definition.key} must define phases.`);

  const boss = createBossInstance(definition.key, ctx);
  assert(boss.name === definition.name, `${definition.key} instance should preserve definition name.`);
  assert(boss.renderKey === definition.renderKey, `${definition.key} instance should preserve renderKey.`);
  assert(isFiniteNumber(boss.x), `${definition.key} instance must define numeric x position.`);
  assert(isFiniteNumber(boss.y), `${definition.key} instance must define numeric y position.`);
  assert(isFiniteNumber(boss.maxHp) && boss.maxHp === definition.hp, `${definition.key} instance should mirror hp.`);
  assert(boss.phaseHp === definition.phases[0].hp, `${definition.key} instance should start on the first phase hp.`);
  assert(boss.cooldowns && typeof boss.cooldowns === "object", `${definition.key} instance should define cooldowns.`);

  definition.phases.forEach((phase, phaseIndex) => validatePhase(phase, definition.name, phaseIndex, ctx));
}

function validateStage(stage, ctx) {
  assert(stage && typeof stage === "object", "Stages must be objects.");
  assert(typeof stage.key === "string" && stage.key.length > 0, "Stages must define key.");
  assert(typeof stage.name === "string" && stage.name.length > 0, `${stage.key} must define name.`);
  assert(isFiniteNumber(stage.duration) && stage.duration > 0, `${stage.key} must define positive duration.`);
  assert(typeof stage.bossKey === "string" && getBossDefinition(stage.bossKey), `${stage.key} must reference a known bossKey.`);
  assert(typeof stage.init === "function", `${stage.key} must define init().`);
  assert(typeof stage.update === "function", `${stage.key} must define update(stageState, t, dt, ctx).`);

  const stageState = stage.init();
  assert(
    stageState && typeof stageState === "object" && !Array.isArray(stageState),
    `${stage.key} init() must return an object for mutable stage state.`
  );

  stage.update(stageState, 0, 0.016, ctx);
  stage.update(stageState, stage.duration * 0.5, 0.016, ctx);
}

function validateShowcaseCoverage() {
  const enemyShowcaseKeys = new Set(listEnemyShowcaseEntries().map((entry) => entry.key));
  const bossShowcaseKeys = new Set(listBossShowcaseEntries().map((entry) => entry.key));

  assert(enemyShowcaseKeys.size === enemyArchetypes.length, "Each enemy archetype must expose exactly one showcase entry.");
  assert(bossShowcaseKeys.size === bossDefinitions.length, "Each boss definition must expose exactly one showcase entry.");

  enemyArchetypes.forEach((archetype) => {
    assert(enemyShowcaseKeys.has(archetype.key), `${archetype.key} is missing a showcase entry.`);
  });
  bossDefinitions.forEach((boss) => {
    assert(bossShowcaseKeys.has(boss.key), `${boss.key} is missing a showcase entry.`);
  });
}

function run() {
  const ctx = makeContentContext();
  const enemyRendererKeys = new Set(listEnemyRendererKeys());
  const bossRendererKeys = new Set(listBossRendererKeys());

  assert(Array.isArray(enemyArchetypes) && enemyArchetypes.length > 0, "Enemy archetype registry must be non-empty.");
  assert(Array.isArray(stageDefinitions) && stageDefinitions.length > 0, "Stage registry must be non-empty.");
  assert(Array.isArray(bossDefinitions) && bossDefinitions.length > 0, "Boss registry must be non-empty.");

  assertUniqueKeys(enemyArchetypes, "Enemy archetype");
  assertUniqueKeys(stageDefinitions, "Stage");
  assertUniqueKeys(bossDefinitions, "Boss");

  enemyArchetypes.forEach((archetype) => validateEnemyArchetype(archetype, enemyRendererKeys));
  stageDefinitions.forEach((stage) => validateStage(stage, ctx));
  bossDefinitions.forEach((boss) => validateBossDefinition(boss, ctx, bossRendererKeys));

  validateShowcaseCoverage();

  const patternHelpers = listPatternHelpers();
  assert(patternHelpers.includes("runCooldown"), "Pattern helper inventory must include runCooldown.");
  assert(patternHelpers.includes("resetCooldowns"), "Pattern helper inventory must include resetCooldowns.");

  console.log("Content contract checks passed.");
}

try {
  run();
} catch (error) {
  console.error("Content contract checks failed.\n");
  console.error(
    `${error.message}\n\nRepair path: keep the stage registry keyed and ordered, keep boss definitions render-keyed and instantiable, and keep showcase entries aligned with the content registries.`
  );
  process.exit(1);
}
