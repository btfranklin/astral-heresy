import test from "node:test";
import assert from "node:assert/strict";

import { combatTuning, getCloseRangeBonus } from "../../../src/core/combat.js";
import { getCloseRangeBonusMultiplier, powerupTuning } from "../../../src/core/powerups.js";
import { createBossInstance } from "../../../src/data/bosses.js";
import { updateBoss } from "../../../src/systems/bossSystem.js";
import { spawnEnemy } from "../../../src/systems/enemySystem.js";
import { spawnEnemyBullet, spawnPlayerBullet } from "../../../src/systems/bulletSystem.js";
import { buildEntityBuckets } from "../../../src/entities/entityBuckets.js";
import { spawnPickup, spawnScoreShards, updatePickups } from "../../../src/systems/pickupSystem.js";
import { updateCombat } from "../../../src/systems/combatSystem.js";
import { updateMovement } from "../../../src/systems/movementSystem.js";
import { updatePlayer } from "../../../src/systems/playerSystem.js";
import { handleWithBuckets, makeAudioSpy, makeBossContext, makeState } from "../../helpers/fixtures.mjs";

test("powerup notice and secondary callout timers are deterministic", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  spawnPickup(state, "halo-shield", player.x, player.y, {});
  handleWithBuckets(state, player, audio);
  assert.equal(state.powerupNotice.title, "Halo Shield");
  assert.equal(state.powerupNotice.timer > 0, true);
  assert.equal(state.powerupNotice.hudTimer > 0, true);

  updateCombat(state, player, 1.0);
  assert.equal(state.powerupNotice.timer, 0);
  assert.equal(state.powerupNotice.hudTimer > 0, true);
  updateCombat(state, player, 1.4);
  assert.equal(state.powerupNotice.hudTimer, 0);
});

test("burst cell, halo shield, chain sigil, and graze bloom preserve their authored rules", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();

  state.burstStocks = 0;
  spawnPickup(state, "burst-cell", player.x, player.y, {});
  handleWithBuckets(state, player, audio);
  assert.equal(state.burstStocks, 1);

  state.burstStocks = 2;
  state.grazeCharge = 40;
  spawnPickup(state, "burst-cell", player.x, player.y, {});
  handleWithBuckets(state, player, audio);
  assert.equal(state.grazeCharge, 40 + powerupTuning.burstCellGrazeFallback);

  player.activePowerups.haloShield = 12;
  spawnEnemyBullet(state, player.x, player.y, 0, 0, { r: 4 });
  handleWithBuckets(state, player, audio);
  assert.equal(player.hp, 5);
  assert.equal(player.activePowerups.haloShield, 0);
  assert.equal(state.feedback.shield > 0, true);

  state.chainLevel = 5;
  state.chainTimer = 1;
  player.activePowerups.chainSigil = 10;
  updateCombat(state, player, 1);
  assert.equal(state.chainTimer > 0, true);

  const { state: baselineState, player: baselinePlayer } = makeState();
  baselineState.chainLevel = 5;
  baselineState.chainTimer = 1;
  updateCombat(baselineState, baselinePlayer, 1);
  assert.equal(state.chainTimer > baselineState.chainTimer, true, "Chain Sigil should slow chain decay instead of merely leaving the chain untouched.");

  const { state: bloomState, player: bloomPlayer } = makeState();
  bloomPlayer.activePowerups.grazeBloom = 10;
  spawnEnemyBullet(bloomState, bloomPlayer.x + 22, bloomPlayer.y, 0, 0, { r: 4 });
  handleWithBuckets(bloomState, bloomPlayer, audio);
  assert.equal(bloomState.grazeCharge, combatTuning.grazeChargePerBullet * powerupTuning.grazeBloomMultiplier);
});

test("magnet core, orbitals, amplifier, and point-blank seal keep their authored combat behavior", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();

  player.activePowerups.magnetCore = 10;
  const pickup = spawnPickup(state, "beam", player.x + 250, player.y, {});
  const shard = spawnScoreShards(state, player.x + 250, player.y, 1, { seedOffset: Math.PI / 2 })[0];
  const pickupStartX = pickup.components.position.x;
  const shardStartX = shard.components.position.x;
  for (let i = 0; i < 12; i++) {
    updatePickups(state, player, 0.16);
    updateMovement(state, 0.16);
  }
  assert.equal(pickup.components.position.x < pickupStartX, true);
  assert.equal(shard.components.position.x < shardStartX, true);

  player.weaponMode = "orbitals";
  player.weaponTimer = 10;
  state.input = { pointerEnabled: true, KeyZ: true };
  state.input.KeyZ = true;
  const bulletCountBefore = buildEntityBuckets(state).playerBullets.length;
  updateMovement(state, 0.01);
  updateCombat(state, player, 0.01);
  const enemy = spawnEnemy(state, "cherub", {
    x: player.x + 38,
    y: player.y,
    vx: 0,
    vy: 0,
    hp: 1,
    r: 16,
  });
  state.time += 0.12;
  updatePlayer(state, player, audio, 0.12);
  assert.equal(buildEntityBuckets(state).playerBullets.length > bulletCountBefore, true);
  handleWithBuckets(state, player, audio, { dt: 0.12 });
  assert.equal(enemy.dead, true);

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
  handleWithBuckets(state, player, audio, { dt: 1 / 60 });
  assert.equal(Number((initialPhaseHp - boss.phaseHp).toFixed(2)), 0.6);

  const hpAfterBody = boss.phaseHp;
  spawnPlayerBullet(state, boss.weakpoint.x, boss.weakpoint.y, -Math.PI / 2, 0, {
    damage: 1,
    weaponMode: "amplifier",
    bodyDamageMultiplier: 0.6,
    weakpointDamageMultiplier: 2.8,
    weakpointBrandDuration: 1.25,
  });
  handleWithBuckets(state, player, audio, { dt: 1 / 60 });
  assert.equal(Number((hpAfterBody - boss.phaseHp).toFixed(2)), 2.8);
  assert.equal(Number(boss.weakpointBrandTimer.toFixed(2)), 1.25);

  player.activePowerups.pointBlankSeal = 10;
  player.x = 640;
  player.y = 560;
  state.boss = null;
  const sealTargetX = player.x + 40;
  const sealTargetY = player.y - 18;
  spawnEnemy(state, "halo", {
    x: sealTargetX,
    y: sealTargetY,
    vx: 0,
    vy: 0,
    hp: 1,
    elite: true,
    scoreShardCount: 5,
    r: 18,
  });
  spawnPlayerBullet(state, sealTargetX, sealTargetY, -Math.PI / 2, 0, {
    damage: 1,
  });
  const closeBefore = state.scoreBonuses.close;
  handleWithBuckets(state, player, audio, { dt: 1 / 60 });
  const closeDistance = Math.hypot(player.x - sealTargetX, player.y - sealTargetY);
  assert.equal(
    state.scoreBonuses.close - closeBefore,
    getCloseRangeBonus(closeDistance, getCloseRangeBonusMultiplier(player)),
    "Point-Blank Seal should multiply the close-range bonus instead of changing the kill path."
  );
  assert.equal(buildEntityBuckets(state).scoreShards.length > 0, true);
});
