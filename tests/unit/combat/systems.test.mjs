import test from "node:test";
import assert from "node:assert/strict";

import { createBossInstance } from "../../../src/data/bosses.js";
import { spawnEnemy } from "../../../src/systems/enemySystem.js";
import { cleanupBullets, spawnEnemyBullet, spawnPlayerBullet, updateBullets } from "../../../src/systems/bulletSystem.js";
import { updateEnemies } from "../../../src/systems/enemySystem.js";
import { updateMovement } from "../../../src/systems/movementSystem.js";
import { updatePlayer } from "../../../src/systems/playerSystem.js";
import { updateCombat } from "../../../src/systems/combatSystem.js";
import { spawnPickup, spawnScoreShards, updatePickups } from "../../../src/systems/pickupSystem.js";
import { advanceBossPhase, defeatBoss, updateBoss } from "../../../src/systems/bossSystem.js";
import { resolveWeakpoint } from "../../../src/systems/bossInternals.js";
import { updateStage } from "../../../src/systems/stageSystem.js";
import { buildEntityBuckets } from "../../../src/entities/entityBuckets.js";
import { createEntity } from "../../../src/entities/entityFactory.js";
import { collider, health, position, velocity } from "../../../src/entities/components.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { combatTuning } from "../../../src/core/combat.js";
import { handleWithBuckets, makeAudioSpy, makeBossContext, makeState, withRandomSequence } from "../../helpers/fixtures.mjs";

test("bullet system spawns, updates, homes, turns, wobbles, and cleans up bullets", async () => {
  const { state, player } = makeState();

  const enemyBullet = spawnEnemyBullet(state, 100, 100, 0, 100, {
    turn: 1,
    homing: 1,
    wobble: 4,
    color: "#abc",
  });
  const playerBullet = spawnPlayerBullet(state, 100, 100, -Math.PI / 2, 200, {
    damage: 2,
    pierce: 1,
    weaponMode: "pierce",
  });

  assert.equal(state.shotsFired, 1);
  assert.equal(enemyBullet.components.attack.source, "enemy");
  assert.equal(playerBullet.components.attack.source, "player");

  const beforeVx = enemyBullet.components.velocity.vx;
  await withRandomSequence([0.25], () => {
    updateBullets(state, player, 0.1);
  });
  assert.equal(enemyBullet.components.velocity.vx !== beforeVx, true);
  assert.equal(enemyBullet.components.lifetime.age > 0, true);

  playerBullet.components.position.x = state.playfield.maxX + 200;
  cleanupBullets(state);
  assert.equal(playerBullet.dead, true);
});

test("enemy and movement systems merge archetypes, run ai hooks, clamp lane drift, and clean up off-screen entities", () => {
  const { state } = makeState();
  let behaviorCalls = 0;
  let fireCalls = 0;

  const enemy = spawnEnemy(state, "cherub", {
    x: state.playfield.minX - 200,
    y: 120,
    vx: -40,
    vy: 0,
    hp: 5,
    behavior() {
      behaviorCalls += 1;
    },
    fire() {
      fireCalls += 1;
    },
    elite: true,
    dropKey: "spread",
  });
  assert.equal(enemy.components.position.x >= state.playfield.minX - (enemy.components.collider.r + 40), true);
  assert.equal(enemy.components.reward.dropKey, "spread");
  assert.equal(enemy.components.velocity.vy, 0, "A zero vertical-speed override must not fall back to archetype drift.");

  updateEnemies(state, 0.016);
  assert.equal(behaviorCalls, 1);
  assert.equal(fireCalls, 1);
  assert.equal(enemy.components.velocity.vx > 0, true);

  enemy.dead = true;
  updateEnemies(state, 0.016);
  assert.equal(behaviorCalls, 1, "Dead enemies must not run behavior while awaiting the entity flush.");
  assert.equal(fireCalls, 1, "Dead enemies must not fire while awaiting the entity flush.");

  const zeroValueEnemy = spawnEnemy(state, "cherub", {
    x: 300,
    y: 120,
    vx: 0,
    vy: 0,
    r: 0,
    hp: 0,
    risk: true,
  });
  assert.equal(zeroValueEnemy.components.velocity.vx, 0);
  assert.equal(zeroValueEnemy.components.velocity.vy, 0);
  assert.equal(zeroValueEnemy.components.collider.r, 0);
  assert.equal(zeroValueEnemy.components.health.hp, 0);
  assert.equal(zeroValueEnemy.components.reward.risk, true);

  const shardRewardEnemy = spawnEnemy(state, "cherub", {
    x: 400,
    y: 120,
    scoreShardCount: 3,
  });
  assert.equal(shardRewardEnemy.components.reward.scoreShardCount, 3);

  const mover = createEntity("particle", {
    position: position(10, 20),
    velocity: velocity(100, -50),
  });
  state.entities.push(mover);
  updateMovement(state, 0.5);
  assert.equal(mover.components.position.x, 60);
  assert.equal(mover.components.position.y, -5);
  mover.dead = true;
  updateMovement(state, 0.5);
  assert.equal(mover.components.position.x, 60, "Dead entities must not move while awaiting the entity flush.");
  assert.equal(mover.components.position.y, -5);

  shardRewardEnemy.components.position.y = state.view.height + 100;
  updateEnemies(state, 0.016);
  assert.equal(shardRewardEnemy.dead, true);
});

test("player and combat systems move, fire, clamp, decay timers, and latch burst input", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  state.time = 1;
  state.input = {
    pointerEnabled: false,
    KeyD: true,
    KeyW: true,
    KeyZ: true,
    ShiftLeft: true,
  };

  updatePlayer(state, player, audio, 0.1);
  const bullets = buildEntityBuckets(state).playerBullets;
  assert.equal(bullets.length, 2, "Focused base fire should emit two shots.");
  assert.equal(audio.events.at(-1).kind, "fire");
  assert.equal(player.x <= state.playfield.maxX, true);
  assert.equal(player.y >= state.playfield.minY, true);

  state.chainLevel = 3;
  state.chainTimer = 0.1;
  state.feedback.loop = 1;
  state.grazeWindow = 1;
  state.burstStocks = 1;
  player.weaponMode = "beam";
  player.weaponTimer = 0.05;
  updateCombat(state, player, 0.2);
  assert.equal(state.chainLevel, 0);
  assert.equal(player.weaponMode, "base");

  state.input.KeyX = true;
  updateCombat(state, player, 0.01);
  assert.equal(player.pendingBurst, true);
  assert.equal(player.burstLatch, true);
  updateCombat(state, player, 0.01);
  assert.equal(player.pendingBurst, true, "Holding X should not re-arm multiple bursts in one latch window.");
  state.input.KeyX = false;
  updateCombat(state, player, 0.01);
  assert.equal(player.burstLatch, false);
});

test("pickup system spawns, lane-clamps, attracts, and removes off-screen pickups and shards", () => {
  const { state, player } = makeState();
  player.activePowerups.magnetCore = 10;
  const pickup = spawnPickup(state, "beam", -80, 200, {});
  const shards = spawnScoreShards(state, state.playfield.maxX + 120, 200, 2, {});
  assert.equal(pickup.components.position.x, state.playfield.minX + 22);
  assert.equal(shards.every((entity) => entity.components.position.x <= state.playfield.maxX), true);

  const pickupStartX = pickup.components.position.x;
  updatePickups(state, player, 0.2);
  updateMovement(state, 0.2);
  assert.equal(pickup.components.position.x > pickupStartX, true);

  pickup.components.position.y = state.view.height + 100;
  updatePickups(state, player, 0.1);
  assert.equal(pickup.dead, true);
});

test("pickup and score-shard damping preserves the 60 Hz motion across frame partitions", () => {
  function simulate(step, frameCount) {
    const { state, player } = makeState();
    player.x = -10_000;
    player.y = -10_000;
    const pickup = spawnPickup(state, "beam", 640, 200, {
      vx: 0,
      vy: 54,
      spawnPause: 0.24,
    });
    const [shard] = spawnScoreShards(state, 640, 200, 1, {
      seedOffset: 0,
    });
    for (let frame = 0; frame < frameCount; frame++) {
      updatePickups(state, player, step);
    }
    return {
      pickupVy: pickup.components.velocity.vy,
      shardVx: shard.components.velocity.vx,
      shardVy: shard.components.velocity.vy,
    };
  }

  const at60Hz = simulate(1 / 60, 60);
  const at30Hz = simulate(1 / 30, 30);
  const at120Hz = simulate(1 / 120, 120);
  for (const candidate of [at30Hz, at120Hz]) {
    assert.equal(Math.abs(at60Hz.pickupVy - candidate.pickupVy) < 1e-9, true);
    assert.equal(Math.abs(at60Hz.shardVx - candidate.shardVx) < 1e-9, true);
    assert.equal(Math.abs(at60Hz.shardVy - candidate.shardVy) < 1e-9, true);
  }
});

test("pickup fall speed resumes after its spawn pause at each frame rate", () => {
  for (const step of [1 / 30, 1 / 60, 1 / 120]) {
    for (const fallSpeed of [54, 81, 0]) {
      const { state, player } = makeState();
      player.x = -10_000;
      player.y = -10_000;
      const pickup = spawnPickup(state, "beam", 640, 200, {
        vy: fallSpeed,
        spawnPause: 0.24,
      });
      let elapsed = 0;
      while (elapsed < 0.9) {
        const dt = Math.min(step, 0.9 - elapsed);
        updatePickups(state, player, dt);
        updateMovement(state, dt);
        elapsed += dt;
      }

      assert.equal(pickup.components.position.y > 200 + fallSpeed * 0.3, fallSpeed > 0);
      assert.equal(pickup.components.velocity.vy, fallSpeed);
    }
  }
});

test("magnet pursues pickups from every direction across frame rates", () => {
  const starts = [
    [-250, 0],
    [250, 0],
    [0, -250],
    [0, 250],
    [-175, -175],
    [175, 175],
    [-175, 175],
    [175, -175],
  ];

  for (const step of [1 / 30, 1 / 60, 1 / 120]) {
    for (const [offsetX, offsetY] of starts) {
      const { state, player } = makeState();
      player.x = 640;
      player.y = 360;
      player.activePowerups.magnetCore = 10;
      const pickup = spawnPickup(state, "beam", player.x + offsetX, player.y + offsetY, { vy: 0 });
      const audio = makeAudioSpy();
      let elapsed = 0;
      for (; elapsed < 10 && !pickup.dead; elapsed += step) {
        updateCombat(state, player, step);
        updateMovement(state, step);
        updatePickups(state, player, step);
        handleWithBuckets(state, player, audio);
      }
      assert.equal(pickup.dead, true, `pickup at (${offsetX}, ${offsetY}) should be collected at ${Math.round(1 / step)} Hz`);
      assert.equal(state.scoreBonuses.pickup > 0, true, "pickup must be collected, not removed offscreen");
      assert.equal(elapsed < 10, true, "pickup must be collected while Magnet Core is active");
    }

    const { state: nearbyState, player: nearbyPlayer } = makeState();
    nearbyPlayer.x = 640;
    nearbyPlayer.y = 360;
    const nearbyPickup = spawnPickup(nearbyState, "beam", nearbyPlayer.x - 120, nearbyPlayer.y, { vy: 0 });
    const nearbyAudio = makeAudioSpy();
    for (let elapsed = 0; elapsed < 10 && !nearbyPickup.dead; elapsed += step) {
      updateCombat(nearbyState, nearbyPlayer, step);
      updateMovement(nearbyState, step);
      updatePickups(nearbyState, nearbyPlayer, step);
      handleWithBuckets(nearbyState, nearbyPlayer, nearbyAudio);
    }
    assert.equal(nearbyPickup.dead, true, "base attraction should collect a nearby pickup without Magnet Core");
    assert.equal(nearbyState.scoreBonuses.pickup > 0, true, "nearby pickup must be collected, not removed offscreen");

    const { state: shardState, player: shardPlayer } = makeState();
    shardPlayer.x = 640;
    shardPlayer.y = 360;
    shardPlayer.activePowerups.magnetCore = 10;
    const [shard] = spawnScoreShards(shardState, shardPlayer.x + 250, shardPlayer.y, 1, { seedOffset: Math.PI / 2 });
    const shardAudio = makeAudioSpy();
    let shardElapsed = 0;
    for (; shardElapsed < 10 && !shard.dead; shardElapsed += step) {
      updateCombat(shardState, shardPlayer, step);
      updateMovement(shardState, step);
      updatePickups(shardState, shardPlayer, step);
      handleWithBuckets(shardState, shardPlayer, shardAudio);
    }
    assert.equal(shard.dead, true, `score shard should keep its attraction at ${Math.round(1 / step)} Hz`);
    assert.equal(shardState.scoreBonuses.shard > 0, true, "score shard must be collected, not removed offscreen");
    assert.equal(shardElapsed < 10, true, "score shard must be collected while Magnet Core is active");
  }
});

test("boss internals and boss system expose weakpoint windows, phase-break resets, and loop completion rules", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const boss = createBossInstance("seraph", makeBossContext(state, player));
  boss.phaseIndex = 1;
  boss.phaseTime = 0.2;
  boss.phaseHp = boss.phases[1].hp;
  boss.cooldowns.test = 0.4;
  boss.weakpoint = { x: boss.x, y: boss.y, radius: 10 };
  state.boss = boss;

  const weakpoint = resolveWeakpoint(boss, boss.phases[1]);
  assert.equal(Boolean(weakpoint), true);
  assert.equal(weakpoint.radius > 0, true);

  updateBoss(state, boss, 0.016, makeBossContext(state, player));
  assert.equal(Boolean(boss.weakpoint), true);

  advanceBossPhase(state, boss, () => {}, audio);
  assert.equal(boss.phaseIndex, 2);
  assert.equal(boss.phaseTime, 0);
  assert.equal(boss.phaseHp, boss.phases[2].hp);
  assert.equal(boss.weakpoint, null);
  assert.deepEqual(Object.keys(boss.cooldowns), []);
  assert.equal(state.score >= combatTuning.phaseBreakBaseScore, true);
  assert.equal(state.scoreBonuses.phaseBreak > 0, true);

  state.boss = createBossInstance("seraph", makeBossContext(state, player));
  state.stageIndex = stageDefinitions.length - 1;
  state.burstStocks = 2;
  state.input.KeyX = true;
  player.hp = 1;
  defeatBoss(state, player, state.boss, () => {}, audio, stageDefinitions);
  assert.equal(state.loopIndex, 1);
  assert.equal(state.stageIndex, 0);
  assert.equal(player.hp, 5);
  assert.equal(state.burstStocks, 1);
  assert.equal(player.invuln > 0, true);
  assert.equal(player.burstLatch, true);

  updateCombat(state, player, 1 / 60);
  assert.equal(player.pendingBurst, false, "Holding Burst through the transition must not arm the granted stock.");
  assert.equal(state.burstStocks, 1);
  state.input.KeyX = false;
  updateCombat(state, player, 1 / 60);
  state.input.KeyX = true;
  updateCombat(state, player, 1 / 60);
  assert.equal(player.pendingBurst, true, "Burst may arm after the held key is released and pressed again.");
  player.pendingBurst = false;

  state.boss = createBossInstance("seraph", makeBossContext(state, player));
  state.stageIndex = stageDefinitions.length - 1;
  defeatBoss(state, player, state.boss, () => {}, audio, stageDefinitions);
  assert.equal(state.over, true);
  assert.equal(state.victory, true);
  assert.equal(audio.endings.at(-1).outcome, "victory");
});

test("stage system initializes stage state, advances time, and transitions into boss mode", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const spawned = [];
  const stages = [
    {
      key: "test",
      name: "Test",
      duration: 1,
      bossKey: "seraph",
      init() {
        return { count: 0 };
      },
      update(stageState, t, dt, ctx) {
        stageState.count += 1;
        ctx.spawnEnemyBullet(10, 20, 0, 0, {});
      },
    },
  ];
  const contentContext = {
    ...makeBossContext(state, player),
    spawnEnemyBullet(...args) {
      spawned.push(args);
    },
  };

  updateStage(state, stages, contentContext, audio, 0.4);
  assert.equal(state.stageState.count, 1);
  assert.equal(state.stageTime, 0.4);
  assert.equal(spawned.length, 1);

  let clearedBehaviorCalls = 0;
  let clearedFireCalls = 0;
  const clearedEnemy = spawnEnemy(state, "cherub", {
    x: 320,
    y: 120,
    behavior() {
      clearedBehaviorCalls += 1;
    },
    fire() {
      clearedFireCalls += 1;
    },
  });
  const clearedPickup = spawnPickup(state, "beam", 420, 180);
  const [clearedShard] = spawnScoreShards(state, 520, 180, 1);
  const clearedPositions = new Map(
    [clearedEnemy, clearedPickup, clearedShard].map((entity) => [
      entity.id,
      { ...entity.components.position },
    ])
  );
  updateStage(state, stages, contentContext, audio, 0.7);
  assert.equal(Boolean(state.boss), true);
  assert.equal(state.entities.every((entity) => entity.dead), true);
  updateEnemies(state, 0.7);
  updateMovement(state, 0.7);
  updatePickups(state, player, 0.7);
  assert.equal(clearedBehaviorCalls, 0);
  assert.equal(clearedFireCalls, 0);
  for (const entity of [clearedEnemy, clearedPickup, clearedShard]) {
    assert.deepEqual(entity.components.position, clearedPositions.get(entity.id));
  }
  assert.equal(clearedPickup.components.pickup.t, 0);
  assert.equal(clearedShard.components.scoreShard.t, 0);
  assert.equal(audio.events.at(-1).kind, "boss-arrival");
});
