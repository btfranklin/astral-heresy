#!/usr/bin/env node

import assert from "node:assert/strict";

import { createStageDirector, refreshDensityState } from "../src/core/director.js";
import { createBossInstance } from "../src/data/bosses.js";
import { stageDefinitions } from "../src/data/stages.js";
import { stageNebula } from "../src/data/stages/nebula.js";
import { createGameState } from "../src/state/gameState.js";
import { createPlayfield, createPlayfieldContext } from "../src/state/playfieldState.js";
import { createPlayerState } from "../src/state/playerState.js";
import { updateBoss, defeatBoss } from "../src/systems/bossSystem.js";
import { spawnEnemy, updateEnemies } from "../src/systems/enemySystem.js";
import { spawnEnemyBullet, spawnPlayerBullet } from "../src/systems/bulletSystem.js";
import { cleanupBullets, updateBullets } from "../src/systems/bulletSystem.js";
import { handleCollisions } from "../src/systems/collisionSystem.js";
import { buildEntityBuckets } from "../src/entities/entityBuckets.js";
import { spawnPickup, spawnScoreShards, updatePickups } from "../src/systems/pickupSystem.js";
import { updateCombat } from "../src/systems/combatSystem.js";
import { updateMovement } from "../src/systems/movementSystem.js";

function makeState() {
  const state = createGameState();
  state.started = true;
  state.view.width = 1280;
  state.view.height = 720;
  state.playfield = createPlayfield(state.view.width, state.view.height);
  state.input = { pointerEnabled: true };
  const player = createPlayerState(state.view.width, state.view.height);
  return { state, player };
}

function makeAudioStub() {
  return {
    engine: { lastShot: 0 },
    playNoise() {},
    playTone() {},
    playChord() {},
  };
}

function noParticles() {}

function noopAdvanceBossPhase() {}

function makeBossContext(state, player) {
  return {
    view: state.view,
    player,
    playfield: createPlayfieldContext(state),
    director: createStageDirector(state),
    loopIndex: 0,
    spawnEnemyBullet() {},
    spawnEnemy() {},
    spawnPickup() {},
    spawnScoreShards() {},
  };
}

function handle(state, player, audio) {
  handleCollisions(
    state,
    player,
    audio,
    noParticles,
    noopAdvanceBossPhase,
    () => {},
    (kind, x, y, overrides = {}) => spawnPickup(state, kind, x, y, overrides),
    (x, y, count, options = {}) => spawnScoreShards(state, x, y, count, options),
    buildEntityBuckets(state)
  );
}

function testGrazeOnlyAwardsOncePerBullet() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  state.grazeCharge = 95;
  state.burstStocks = 1;
  player.x = 500;
  player.y = 500;
  spawnEnemyBullet(state, player.x + 22, player.y, 0, 0, { r: 4 });

  handle(state, player, audio);

  assert.equal(state.burstStocks, 2, "A full graze meter should recharge one burst stock.");
  assert.equal(state.grazeCharge, 0, "Graze charge should roll over into burst stock when recharged.");
  assert.equal(state.scoreBonuses.graze, 20, "Graze should award score.");

  handle(state, player, audio);
  assert.equal(state.scoreBonuses.graze, 20, "A bullet should only award graze once.");
}

function testBurstClearsNearbyFireAndDamagesThreats() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  player.x = 640;
  player.y = 560;
  state.burstStocks = 1;
  player.pendingBurst = true;
  spawnEnemyBullet(state, player.x + 40, player.y, 0, 0, { r: 4 });
  spawnEnemyBullet(state, player.x + 260, player.y, 0, 0, { r: 4 });
  spawnEnemy(state, "cherub", {
    x: player.x + 60,
    y: player.y - 40,
    vx: 0,
    vy: 0,
    hp: 2,
  });

  handle(state, player, audio);

  const buckets = buildEntityBuckets(state);
  assert.equal(state.burstStocks, 0, "Burst should spend one stock.");
  assert(state.feedback.burst > 0, "Burst should trigger feedback.");
  assert.equal(player.invuln > 0, true, "Burst should grant temporary invulnerability.");
  assert.equal(buckets.enemyBullets.length, 1, "Burst should clear only nearby bullets.");
  assert.equal(buckets.enemies.length, 0, "Burst should damage and finish nearby low-hp enemies.");
}

function testPickupCollectionAndExpiry() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  player.x = 640;
  player.y = 560;
  spawnPickup(state, "spread", player.x, player.y, {});
  handle(state, player, audio);

  assert.equal(player.weaponMode, "spread", "Collecting a pickup should swap the weapon mode.");
  assert.equal(player.weaponTimer > 0, true, "Collecting a pickup should apply a duration.");

  const drifting = spawnPickup(state, "beam", 40, state.view.height + 140, {});
  updatePickups(state, player, 0.1);
  assert.equal(drifting.dead, true, "Off-screen pickups should clean themselves up.");
}

function testChainDecayAndWeaponExpiry() {
  const { state, player } = makeState();
  state.chainLevel = 4;
  state.chainTimer = 0.3;
  player.weaponMode = "beam";
  player.weaponLabel = "Beam";
  player.weaponTimer = 0.2;

  updateCombat(state, player, 0.35);

  assert.equal(state.chainLevel, 0, "Chain should decay when the timer expires.");
  assert.equal(player.weaponMode, "base", "Temporary weapons should fall back to base after their timer.");
}

function testWeakpointDamageAppliesBonusMultiplier() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  const boss = createBossInstance("seraph", makeBossContext(state, player));
  boss.phaseIndex = 1;
  boss.phaseHp = boss.phases[1].hp;
  boss.phaseTime = 0.2;
  state.boss = boss;

  updateBoss(state, boss, 0.016, makeBossContext(state, player));
  assert(boss.weakpoint, "The configured weakpoint should become active in the target phase.");

  spawnPlayerBullet(state, boss.weakpoint.x, boss.weakpoint.y, -Math.PI / 2, 0, {
    damage: 1,
    weaponMode: "base",
  });

  handle(state, player, audio);

  assert.equal(Math.round(boss.phaseHp), boss.phases[1].hp - 3, "Weakpoint hits should apply the configured damage multiplier.");
  assert.equal(state.scoreBonuses.weakpoint > 0, true, "Weakpoint hits should award score bonus.");
}

function testLoopTransition() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  const boss = createBossInstance("seraph", makeBossContext(state, player));
  state.boss = boss;
  state.stageIndex = stageDefinitions.length - 1;
  state.burstStocks = 2;
  player.hp = 2;

  defeatBoss(state, player, boss, noParticles, audio, stageDefinitions);
  assert.equal(state.loopIndex, 1, "Clearing the first run should enter loop two.");
  assert.equal(state.stageIndex, 0, "Loop transition should restart at stage one.");
  assert.equal(player.hp, 5, "Loop transition should fully heal the player.");
  assert.equal(state.burstStocks, 1, "Loop transition should reset burst stocks to one.");

  const finalBoss = createBossInstance("seraph", makeBossContext(state, player));
  state.boss = finalBoss;
  state.stageIndex = stageDefinitions.length - 1;
  defeatBoss(state, player, finalBoss, noParticles, audio, stageDefinitions);
  assert.equal(state.over, true, "Clearing the second loop should finish the run.");
  assert.equal(state.victory, true, "Clearing the second loop should count as victory.");
}

function testPlayfieldLaneEnforcement() {
  const { state, player } = makeState();
  spawnEnemy(state, "cherub", { x: 0, y: 120, vx: 0, vy: 0 });
  spawnPickup(state, "spread", 0, 160, {});
  spawnScoreShards(state, state.view.width + 140, 180, 2, {});

  const buckets = buildEntityBuckets(state);
  assert.equal(
    buckets.enemies[0].components.position.x >= state.playfield.minX - 80,
    true,
    "Desktop enemy spawns should clamp near the combat lane instead of the HUD bay."
  );
  assert.equal(
    buckets.pickups[0].components.position.x >= state.playfield.minX,
    true,
    "Pickups should clamp fully inside the player lane."
  );
  assert.equal(
    buckets.scoreShards.every((entity) => entity.components.position.x <= state.playfield.maxX),
    true,
    "Score shards should clamp inside the player lane."
  );

  const driftingEnemy = spawnEnemy(
    state,
    "cherub",
    { x: state.playfield.minX - 180, y: 140, vx: -40, vy: 0 },
    { laneAware: false }
  );
  updateEnemies(state, 0.016);
  assert.equal(
    driftingEnemy.components.position.x >= state.playfield.minX - 40,
    true,
    "Enemies drifting into the side bay should be nudged back toward the combat lane."
  );

  spawnEnemyBullet(state, state.playfield.maxX + 120, 180, 0, 0, { r: 4 });
  cleanupBullets(state);
  assert.equal(
    buildEntityBuckets(state).enemyBullets.length,
    0,
    "Enemy bullets should clean up once they leave the expanded combat lane."
  );

  state.view.width = 900;
  state.view.height = 720;
  state.playfield = createPlayfield(state.view.width, state.view.height);
  const tabletPickup = spawnPickup(state, "beam", -120, 220, {});
  assert.equal(
    tabletPickup.components.position.x,
    -120,
    "Compact/tablet layouts should keep the wider full-width pickup space."
  );
}

function testStageDirectorSoftGating() {
  const { state } = makeState();
  const director = createStageDirector(state);

  state.density = {
    liveEnemies: 3,
    liveEnemyBullets: 18,
    maxEnemies: 4,
    maxEnemyBullets: 24,
    saturated: false,
  };
  const nearBudget = director.gateWave({ enemyCost: 1, bulletCost: 5, priority: "normal" });
  assert.equal(nearBudget.allow, true, "Near-budget waves should still be allowed.");
  assert.equal(nearBudget.bulletScale < 1, true, "Near-budget waves should thin bullet counts.");
  assert.equal(nearBudget.escortScale, 0, "Near-budget waves should suppress escorts first.");

  state.density = {
    liveEnemies: 4,
    liveEnemyBullets: 24,
    maxEnemies: 4,
    maxEnemyBullets: 24,
    saturated: true,
  };
  const overBudget = director.gateWave({ enemyCost: 2, bulletCost: 8, priority: "normal" });
  assert.equal(overBudget.allow, false, "Over-budget waves should defer instead of spawning immediately.");
  assert.equal(overBudget.delay >= 0.35, true, "Deferred waves should report a retry delay.");
  assert.equal(overBudget.bulletScale <= 0.72, true, "Deferred waves should still return a reduced bullet scale.");
}

function testNebulaEarlyPacingStaysWithinBudget() {
  const { state, player } = makeState();
  const director = createStageDirector(state);
  const playfield = createPlayfieldContext(state);
  const stageState = stageNebula.init();
  let maxEnemies = 0;
  let maxEnemyBullets = 0;

  for (let frame = 0; frame < 12 * 60; frame++) {
    const t = frame / 60;
    state.stageTime = t;
    refreshDensityState(state, stageNebula);
    stageNebula.update(stageState, t, 1 / 60, {
      view: state.view,
      player,
      playfield,
      director,
      loopIndex: 0,
      spawnEnemyBullet: (x, y, angle, speed, opts) => spawnEnemyBullet(state, x, y, angle, speed, opts),
      spawnEnemy: (archetypeKey, overrides, spawnOptions) => spawnEnemy(state, archetypeKey, overrides, spawnOptions),
      spawnPickup: (kind, x, y, overrides, spawnOptions) => spawnPickup(state, kind, x, y, overrides, spawnOptions),
      spawnScoreShards: (x, y, count, options, spawnOptions) =>
        spawnScoreShards(state, x, y, count, options, spawnOptions),
    });
    updateBullets(state, player, 1 / 60);
    updateEnemies(state, 1 / 60);
    updateMovement(state, 1 / 60);
    cleanupBullets(state);
    refreshDensityState(state, stageNebula);
    maxEnemies = Math.max(maxEnemies, state.density.liveEnemies);
    maxEnemyBullets = Math.max(maxEnemyBullets, state.density.liveEnemyBullets);
    assert.equal(
      state.density.liveEnemies <= state.density.maxEnemies,
      true,
      `Nebula enemy pressure should stay within the stage budget at t=${t.toFixed(2)}.`
    );
    assert.equal(
      state.density.liveEnemyBullets <= state.density.maxEnemyBullets,
      true,
      `Nebula bullet pressure should stay within the stage budget at t=${t.toFixed(2)}.`
    );
  }

  assert.equal(maxEnemies <= 5, true, "Nebula should keep early enemy pressure readable.");
  assert.equal(maxEnemyBullets <= 34, true, "Nebula should keep early bullet pressure readable.");
}

function run() {
  testGrazeOnlyAwardsOncePerBullet();
  testBurstClearsNearbyFireAndDamagesThreats();
  testPickupCollectionAndExpiry();
  testChainDecayAndWeaponExpiry();
  testWeakpointDamageAppliesBonusMultiplier();
  testLoopTransition();
  testPlayfieldLaneEnforcement();
  testStageDirectorSoftGating();
  testNebulaEarlyPacingStaysWithinBudget();
  console.log("Combat smoke checks passed.");
}

try {
  run();
} catch (error) {
  console.error("Combat smoke checks failed.\n");
  console.error(
    `${error.message}\n\nRepair path: keep graze, burst, pickup, weakpoint, chain, and loop-two rules aligned with the combat economy implementation.`
  );
  process.exit(1);
}
