import test from "node:test";
import assert from "node:assert/strict";

import { createStageDirector, refreshDensityState } from "../../../src/core/director.js";
import { combatTuning } from "../../../src/core/combat.js";
import { createBossInstance } from "../../../src/data/bosses.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { stageAbyss } from "../../../src/data/stages/abyss.js";
import { stageNebula } from "../../../src/data/stages/nebula.js";
import { createPlayfield, createPlayfieldContext, getBulletEnvelope } from "../../../src/state/playfieldState.js";
import { updateBoss, defeatBoss } from "../../../src/systems/bossSystem.js";
import { spawnEnemy, updateEnemies } from "../../../src/systems/enemySystem.js";
import { cleanupBullets, spawnEnemyBullet, spawnPlayerBullet, updateBullets } from "../../../src/systems/bulletSystem.js";
import { buildEntityBuckets } from "../../../src/entities/entityBuckets.js";
import { spawnPickup, spawnScoreShards, updatePickups } from "../../../src/systems/pickupSystem.js";
import { updateCombat } from "../../../src/systems/combatSystem.js";
import { updateMovement } from "../../../src/systems/movementSystem.js";
import { handleWithBuckets, makeAudioSpy, makeBossContext, makeState, noopParticles } from "../../helpers/fixtures.mjs";

test("graze only awards once per bullet and can recharge burst", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  state.grazeCharge = 95;
  state.burstStocks = 1;
  player.x = 500;
  player.y = 500;
  spawnEnemyBullet(state, player.x + 22, player.y, 0, 0, { r: 4 });

  handleWithBuckets(state, player, audio);
  assert.equal(state.burstStocks, 2);
  assert.equal(state.grazeCharge, 0);
  assert.equal(state.scoreBonuses.graze, combatTuning.grazeScore);

  handleWithBuckets(state, player, audio);
  assert.equal(state.scoreBonuses.graze, combatTuning.grazeScore);
});

test("burst clears nearby fire, damages threats, and grants invulnerability", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
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

  handleWithBuckets(state, player, audio);
  const buckets = buildEntityBuckets(state);
  assert.equal(state.burstStocks, 0);
  assert.equal(state.feedback.burst > 0, true);
  assert.equal(player.invuln > 0, true);
  assert.equal(buckets.enemyBullets.length, 1);
  assert.equal(buckets.enemies.length, 0);
});

test("pickup collection, expiry, and chain decay remain deterministic", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  player.x = 640;
  player.y = 560;
  spawnPickup(state, "spread", player.x, player.y, {});
  handleWithBuckets(state, player, audio);
  assert.equal(player.weaponMode, "spread");
  assert.equal(player.weaponTimer > 0, true);

  const drifting = spawnPickup(state, "beam", 40, state.view.height + 140, {});
  updatePickups(state, player, 0.1);
  assert.equal(drifting.dead, true);

  state.chainLevel = 4;
  state.chainTimer = 0.3;
  player.weaponMode = "beam";
  player.weaponLabel = "Beam";
  player.weaponTimer = 0.2;
  updateCombat(state, player, 0.35);
  assert.equal(state.chainLevel, 0);
  assert.equal(player.weaponMode, "base");
});

test("weakpoint damage and loop transitions keep combat economy rules intact", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const boss = createBossInstance("seraph", makeBossContext(state, player));
  boss.phaseIndex = 1;
  boss.phaseHp = boss.phases[1].hp;
  boss.phaseTime = 0.2;
  state.boss = boss;

  updateBoss(state, boss, 0.016, makeBossContext(state, player));
  assert.equal(Boolean(boss.weakpoint), true);

  const weakpointDamage = boss.weakpoint.damageMultiplier;
  spawnPlayerBullet(state, boss.weakpoint.x, boss.weakpoint.y, -Math.PI / 2, 0, {
    damage: 1,
    weaponMode: "base",
  });
  handleWithBuckets(state, player, audio);
  assert.equal(Math.round(boss.phaseHp), boss.phases[1].hp - weakpointDamage);
  assert.equal(state.scoreBonuses.weakpoint > 0, true);

  const finalBoss = createBossInstance("seraph", makeBossContext(state, player));
  state.boss = finalBoss;
  state.stageIndex = stageDefinitions.length - 1;
  state.burstStocks = 2;
  player.hp = 2;
  defeatBoss(state, player, finalBoss, noopParticles, audio, stageDefinitions);
  assert.equal(state.loopIndex, 1);
  assert.equal(state.stageIndex, 0);
  assert.equal(player.hp, 5);
  assert.equal(state.burstStocks, 1);
});

test("playfield lane enforcement keeps threats and rewards inside the authored envelope", () => {
  const { state, player } = makeState();
  spawnEnemy(state, "cherub", { x: 0, y: 120, vx: 0, vy: 0 });
  spawnPickup(state, "spread", 0, 160, {});
  spawnScoreShards(state, state.view.width + 140, 180, 2, {});

  const buckets = buildEntityBuckets(state);
  assert.equal(buckets.enemies[0].components.position.x >= state.playfield.minX - 80, true);
  assert.equal(buckets.pickups[0].components.position.x >= state.playfield.minX, true);
  assert.equal(buckets.scoreShards.every((entity) => entity.components.position.x <= state.playfield.maxX), true);

  const driftingEnemy = spawnEnemy(
    state,
    "cherub",
    { x: state.playfield.minX - 180, y: 140, vx: -40, vy: 0 },
    { laneAware: false }
  );
  updateEnemies(state, 0.016);
  assert.equal(driftingEnemy.components.position.x >= state.playfield.minX - 40, true);

  spawnEnemyBullet(state, state.playfield.maxX + 120, 180, 0, 0, { r: 4 });
  cleanupBullets(state);
  assert.equal(buildEntityBuckets(state).enemyBullets.length, 0);

  state.view.width = 900;
  state.view.height = 720;
  state.playfield = createPlayfield(state.view.width, state.view.height);
  const tabletPickup = spawnPickup(state, "beam", -120, 220, {});
  assert.equal(tabletPickup.components.position.x, -120);
});

test("stage director reservations and one-shot fallbacks stay authoritative within a frame", () => {
  const { state, player } = makeState();
  const director = createStageDirector(state);

  state.density = {
    liveEnemies: 3,
    liveEnemyBullets: 18,
    maxEnemies: 4,
    maxEnemyBullets: 24,
    saturated: false,
  };
  director.beginFrame();
  const nearBudget = director.gateWave({ enemyCost: 1, bulletCost: 5, priority: "normal" });
  assert.equal(nearBudget.allow, true);
  assert.equal(nearBudget.bulletScale < 1, true);
  assert.equal(nearBudget.escortScale, 0);
  const reservedFollowup = director.gateWave({ enemyCost: 1, bulletCost: 5, priority: "normal" });
  assert.equal(reservedFollowup.allow, false);

  state.density = {
    liveEnemies: 4,
    liveEnemyBullets: 24,
    maxEnemies: 4,
    maxEnemyBullets: 24,
    saturated: true,
  };
  director.beginFrame();
  const overBudget = director.gateWave({ enemyCost: 2, bulletCost: 8, priority: "normal" });
  assert.equal(overBudget.allow, false);
  assert.equal(overBudget.anchorOnly, false);
  assert.equal(overBudget.delay >= 0.35, true);

  const playfield = createPlayfieldContext(state);
  const normalState = stageNebula.init();
  normalState.nextSwoop = 0.5;
  normalState.nextRing = 99;
  normalState.nextSine = 99;
  const normalSpawns = [];
  stageNebula.update(normalState, 1, 1 / 60, {
    view: state.view,
    player,
    playfield,
    loopIndex: 0,
    director: {
      gateWave() {
        return { allow: false, delay: 0.6, bulletScale: 0.7, escortScale: 0, anchorOnly: false };
      },
    },
    spawnEnemy(archetypeKey, overrides = {}) {
      normalSpawns.push({ archetypeKey, overrides });
    },
    spawnEnemyBullet() {},
    spawnPickup() {},
    spawnScoreShards() {},
  });
  assert.equal(normalSpawns.length, 0);
  assert.equal(Number(normalState.nextSwoop.toFixed(2)), Number((1 + 0.6).toFixed(2)));

  const eliteState = stageNebula.init();
  eliteState.nextSwoop = 99;
  eliteState.nextRing = 99;
  eliteState.nextSine = 99;
  eliteState.corridorDone = true;
  eliteState.orbitalsEliteDone = true;
  const eliteSpawns = [];
  stageNebula.update(eliteState, 17.6, 1 / 60, {
    view: state.view,
    player,
    playfield,
    loopIndex: 0,
    director: {
      gateWave() {
        return { allow: false, delay: 0.5, bulletScale: 0.72, escortScale: 0, anchorOnly: true };
      },
    },
    spawnEnemy(archetypeKey, overrides = {}) {
      eliteSpawns.push({ archetypeKey, overrides });
    },
    spawnEnemyBullet() {},
    spawnPickup() {},
    spawnScoreShards() {},
  });
  assert.equal(eliteSpawns.length, 1);
  assert.equal(eliteSpawns[0].archetypeKey, "halo");

  const gauntletState = stageAbyss.init();
  gauntletState.nextHarrier = 99;
  gauntletState.nextNova = 99;
  gauntletState.nextFang = 99;
  gauntletState.singularityDone = true;
  gauntletState.eliteDone = true;
  gauntletState.sealDone = true;
  const setpieceSpawns = [];
  stageAbyss.update(gauntletState, 11.1, 1 / 60, {
    view: state.view,
    player,
    playfield,
    loopIndex: 0,
    director: {
      gateWave() {
        return { allow: false, delay: 0.5, bulletScale: 0.72, escortScale: 0, anchorOnly: true };
      },
    },
    spawnEnemy(archetypeKey, overrides = {}) {
      setpieceSpawns.push({ archetypeKey, overrides });
    },
    spawnEnemyBullet() {},
    spawnPickup() {},
    spawnScoreShards() {},
  });
  assert.equal(setpieceSpawns.length, 1);
  assert.equal(setpieceSpawns[0].archetypeKey, "throne");
});

test("seraph starfall stays inside the desktop lane and nebula early pacing stays within budget", () => {
  const { state, player } = makeState();
  const envelope = getBulletEnvelope(state.playfield, state.view.width);
  const spawnXs = [];
  const boss = createBossInstance("seraph", {
    ...makeBossContext(state, player),
    spawnEnemyBullet(x) {
      spawnXs.push(x);
    },
  });
  boss.phaseIndex = 2;
  boss.phaseTime = 1;
  boss.x = 640;
  boss.y = 150;
  boss.phases[2].pattern(boss, 0.016, {
    ...makeBossContext(state, player),
    spawnEnemyBullet(x) {
      spawnXs.push(x);
    },
  });
  assert.equal(spawnXs.length, 9);
  assert.equal(spawnXs.every((x) => x >= envelope.minX && x <= envelope.maxX), true);

  const director = createStageDirector(state);
  const playfield = createPlayfieldContext(state);
  const stageState = stageNebula.init();
  let maxEnemies = 0;
  let maxEnemyBullets = 0;
  const expectedBudget = stageNebula.densityTiers.find((tier) => 12 < tier.until);
  for (let frame = 0; frame < 12 * 60; frame++) {
    const t = frame / 60;
    state.stageTime = t;
    refreshDensityState(state, stageNebula);
    director.beginFrame();
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
    assert.equal(state.density.liveEnemies <= state.density.maxEnemies, true);
    assert.equal(state.density.liveEnemyBullets <= state.density.maxEnemyBullets, true);
  }
  assert.equal(maxEnemies <= expectedBudget.maxEnemies, true);
  assert.equal(maxEnemyBullets <= expectedBudget.maxEnemyBullets, true);
});
