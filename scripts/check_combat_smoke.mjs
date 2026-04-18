#!/usr/bin/env node

import assert from "node:assert/strict";

import { createGameState } from "../src/state/gameState.js";
import { createPlayerState } from "../src/state/playerState.js";
import { createBossInstance } from "../src/data/bosses.js";
import { stageDefinitions } from "../src/data/stages.js";
import { updateBoss, defeatBoss } from "../src/systems/bossSystem.js";
import { spawnEnemy } from "../src/systems/enemySystem.js";
import { spawnEnemyBullet, spawnPlayerBullet } from "../src/systems/bulletSystem.js";
import { handleCollisions } from "../src/systems/collisionSystem.js";
import { buildEntityBuckets } from "../src/entities/entityBuckets.js";
import { spawnPickup, updatePickups } from "../src/systems/pickupSystem.js";
import { updateCombat } from "../src/systems/combatSystem.js";

function makeState() {
  const state = createGameState();
  state.started = true;
  state.view.width = 1280;
  state.view.height = 720;
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
    loopIndex: 0,
    spawnEnemyBullet() {},
    spawnEnemy() {},
    spawnPickup() {},
  };
}

function testGrazeOnlyAwardsOncePerBullet() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  state.grazeCharge = 95;
  state.burstStocks = 1;
  player.x = 500;
  player.y = 500;
  spawnEnemyBullet(state, player.x + 22, player.y, 0, 0, { r: 4 });

  handleCollisions(
    state,
    player,
    audio,
    noParticles,
    noopAdvanceBossPhase,
    () => {},
    () => {},
    buildEntityBuckets(state)
  );

  assert.equal(state.burstStocks, 2, "A full graze meter should recharge one burst stock.");
  assert.equal(state.grazeCharge, 0, "Graze charge should roll over into burst stock when recharged.");
  assert.equal(state.scoreBonuses.graze, 20, "Graze should award score.");

  handleCollisions(
    state,
    player,
    audio,
    noParticles,
    noopAdvanceBossPhase,
    () => {},
    () => {},
    buildEntityBuckets(state)
  );
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

  handleCollisions(
    state,
    player,
    audio,
    noParticles,
    noopAdvanceBossPhase,
    () => {},
    () => {},
    buildEntityBuckets(state)
  );

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
  handleCollisions(
    state,
    player,
    audio,
    noParticles,
    noopAdvanceBossPhase,
    () => {},
    () => {},
    buildEntityBuckets(state)
  );

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

  handleCollisions(
    state,
    player,
    audio,
    noParticles,
    noopAdvanceBossPhase,
    () => {},
    () => {},
    buildEntityBuckets(state)
  );

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

function run() {
  testGrazeOnlyAwardsOncePerBullet();
  testBurstClearsNearbyFireAndDamagesThreats();
  testPickupCollectionAndExpiry();
  testChainDecayAndWeaponExpiry();
  testWeakpointDamageAppliesBonusMultiplier();
  testLoopTransition();
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
