#!/usr/bin/env node

import assert from "node:assert/strict";

import { createGameState } from "../src/state/gameState.js";
import { createPlayerState } from "../src/state/playerState.js";
import { createBossInstance } from "../src/data/bosses.js";
import { updateBoss } from "../src/systems/bossSystem.js";
import { spawnEnemy } from "../src/systems/enemySystem.js";
import { spawnEnemyBullet, spawnPlayerBullet } from "../src/systems/bulletSystem.js";
import { handleCollisions } from "../src/systems/collisionSystem.js";
import { buildEntityBuckets } from "../src/entities/entityBuckets.js";
import { spawnPickup, spawnScoreShards, updatePickups } from "../src/systems/pickupSystem.js";
import { updateCombat } from "../src/systems/combatSystem.js";
import { updateMovement } from "../src/systems/movementSystem.js";
import { updatePlayer } from "../src/systems/playerSystem.js";

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

function testPowerupNoticeAndExpiry() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  spawnPickup(state, "halo-shield", player.x, player.y, {});
  handle(state, player, audio);
  assert.equal(state.powerupNotice.title, "Halo Shield");
  assert.equal(state.powerupNotice.timer > 0, true);
  assert.equal(state.powerupNotice.hudTimer > 0, true);

  updateCombat(state, player, 1.0);
  assert.equal(state.powerupNotice.timer, 0, "The near-player powerup notice should expire first.");
  assert.equal(state.powerupNotice.hudTimer > 0, true, "The HUD feed should persist longer than the canvas notice.");
  updateCombat(state, player, 1.4);
  assert.equal(state.powerupNotice.hudTimer, 0, "The HUD powerup feed should also expire.");
}

function testBurstCellAtEmptyAndFullBurst() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  state.burstStocks = 0;
  spawnPickup(state, "burst-cell", player.x, player.y, {});
  handle(state, player, audio);
  assert.equal(state.burstStocks, 1, "Burst Cell should add one burst stock when not capped.");

  state.burstStocks = 2;
  state.grazeCharge = 40;
  spawnPickup(state, "burst-cell", player.x, player.y, {});
  handle(state, player, audio);
  assert.equal(state.grazeCharge, 75, "Burst Cell should convert into graze charge when burst is already capped.");
}

function testHaloShieldAbsorbsOneHit() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  player.activePowerups.haloShield = 12;
  spawnEnemyBullet(state, player.x, player.y, 0, 0, { r: 4 });
  handle(state, player, audio);
  assert.equal(player.hp, 5, "Halo Shield should absorb the first hit.");
  assert.equal(player.activePowerups.haloShield, 0, "The shield should collapse after absorbing a hit.");
  assert.equal(player.invuln > 0, true, "Shield break should grant brief invulnerability.");
  assert.equal(state.feedback.shield > 0, true, "Shield break should trigger feedback.");
}

function testChainSigilSlowsChainDecay() {
  const { state, player } = makeState();
  state.chainLevel = 5;
  state.chainTimer = 1;
  player.activePowerups.chainSigil = 10;
  updateCombat(state, player, 1);
  assert.equal(Number(state.chainTimer.toFixed(2)), 0.85, "Chain Sigil should reduce chain decay to 15% speed.");
}

function testGrazeBloomDoublesGrazeGain() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  player.activePowerups.grazeBloom = 10;
  spawnEnemyBullet(state, player.x + 22, player.y, 0, 0, { r: 4 });
  handle(state, player, audio);
  assert.equal(state.grazeCharge, 10, "Graze Bloom should double graze charge gain.");
}

function testMagnetCorePullsPickupsAndScoreShards() {
  const { state, player } = makeState();
  player.activePowerups.magnetCore = 10;
  const pickup = spawnPickup(state, "beam", player.x + 250, player.y, {});
  const shard = spawnScoreShards(state, player.x + 250, player.y, 1, { seedOffset: Math.PI / 2 })[0];
  const pickupStartX = pickup.components.position.x;
  const shardStartX = shard.components.position.x;
  for (let i = 0; i < 12; i++) {
    updatePickups(state, player, 0.16);
    updateMovement(state, 0.16);
  }
  assert.equal(pickup.components.velocity.vx < 0, true, "Magnet Core should pull distant pickups inward.");
  assert.equal(shard.components.position.x < shardStartX, true, "Magnet Core should also pull score shards inward.");
  assert.equal(pickup.components.position.x < pickupStartX, true, "Magnet Core should materially move pickups toward the player.");
}

function testOrbitalsFireAndDealContactDamage() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  player.weaponMode = "orbitals";
  player.weaponTimer = 10;
  state.input.KeyZ = true;

  updatePlayer(state, player, audio, 0.12);
  const bullets = buildEntityBuckets(state).playerBullets;
  assert.equal(bullets.length >= 5, true, "Orbitals should emit both main volleys and orbital shots.");

  const enemy = spawnEnemy(state, "cherub", {
    x: player.x + 38,
    y: player.y,
    vx: 0,
    vy: 0,
    hp: 1,
    r: 16,
  });
  handle(state, player, audio);
  assert.equal(enemy.dead, true, "Orbitals should deal contact damage to nearby small enemies while firing.");
}

function testWeakpointAmplifierBodyPenaltyBrandAndBonus() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  const boss = createBossInstance("seraph", makeBossContext(state, player));
  boss.phaseIndex = 1;
  boss.phaseHp = boss.phases[1].hp;
  boss.phaseTime = 0.2;
  state.boss = boss;

  updateBoss(state, boss, 0.016, makeBossContext(state, player));
  const initialPhaseHp = boss.phaseHp;
  spawnPlayerBullet(state, boss.x, boss.y + boss.r * 0.46, -Math.PI / 2, 0, {
    damage: 1,
    weaponMode: "amplifier",
    bodyDamageMultiplier: 0.6,
    weakpointDamageMultiplier: 2.8,
    weakpointBrandDuration: 1.25,
  });
  handle(state, player, audio);
  assert.equal(Number((initialPhaseHp - boss.phaseHp).toFixed(2)), 0.6, "Amplifier body hits should be penalized.");

  const hpAfterBody = boss.phaseHp;
  spawnPlayerBullet(state, boss.weakpoint.x, boss.weakpoint.y, -Math.PI / 2, 0, {
    damage: 1,
    weaponMode: "amplifier",
    bodyDamageMultiplier: 0.6,
    weakpointDamageMultiplier: 2.8,
    weakpointBrandDuration: 1.25,
  });
  handle(state, player, audio);
  assert.equal(Number((hpAfterBody - boss.phaseHp).toFixed(2)), 2.8, "Amplifier weakpoint hits should use the boosted multiplier.");
  assert.equal(Number(boss.weakpointBrandTimer.toFixed(2)), 1.25, "Amplifier weakpoint hits should apply the brand.");

  const hpAfterBrand = boss.phaseHp;
  spawnPlayerBullet(state, boss.weakpoint.x, boss.weakpoint.y, -Math.PI / 2, 0, {
    damage: 1,
    weaponMode: "base",
  });
  handle(state, player, audio);
  assert.equal(
    Number((hpAfterBrand - boss.phaseHp).toFixed(2)),
    4.05,
    "Weakpoint brand should boost later weakpoint hits by 35%."
  );
}

function testPointBlankSealAndEliteShards() {
  const { state, player } = makeState();
  const audio = makeAudioStub();
  player.activePowerups.pointBlankSeal = 10;
  player.x = 640;
  player.y = 560;
  spawnEnemy(state, "halo", {
    x: player.x + 40,
    y: player.y - 18,
    vx: 0,
    vy: 0,
    hp: 1,
    elite: true,
    scoreShardCount: 5,
    r: 18,
  });
  spawnPlayerBullet(state, player.x + 40, player.y - 18, -Math.PI / 2, 0, {
    damage: 1,
  });
  handle(state, player, audio);
  assert.equal(state.scoreBonuses.close, 320, "Point-Blank Seal should double the close-range score bonus.");
  assert.equal(buildEntityBuckets(state).scoreShards.length > 0, true, "Elite kills should emit score shards.");
}

async function run() {
  testPowerupNoticeAndExpiry();
  testBurstCellAtEmptyAndFullBurst();
  testHaloShieldAbsorbsOneHit();
  testChainSigilSlowsChainDecay();
  testGrazeBloomDoublesGrazeGain();
  testMagnetCorePullsPickupsAndScoreShards();
  testOrbitalsFireAndDealContactDamage();
  testWeakpointAmplifierBodyPenaltyBrandAndBonus();
  testPointBlankSealAndEliteShards();
  console.log("Powerup smoke checks passed.");
}

run().catch((error) => {
  console.error("Powerup smoke checks failed.\n");
  console.error(
    `${error.message}\n\nRepair path: keep powerup collection, effect timers, score shards, orbitals, shield absorption, and weakpoint amplification aligned with the authored powerup pass.`
  );
  process.exit(1);
});
