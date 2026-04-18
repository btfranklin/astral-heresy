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
import { makeAudioSpy, makeBossContext, makeState, withRandomSequence } from "../../helpers/fixtures.mjs";

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

  updateEnemies(state, 0.016);
  assert.equal(behaviorCalls, 1);
  assert.equal(fireCalls, 1);
  assert.equal(enemy.components.velocity.vx > 0, true);

  const mover = createEntity("particle", {
    position: position(10, 20),
    velocity: velocity(100, -50),
  });
  state.entities.push(mover);
  updateMovement(state, 0.5);
  assert.equal(mover.components.position.x, 60);
  assert.equal(mover.components.position.y, -5);

  enemy.components.position.y = state.view.height + 100;
  updateEnemies(state, 0.016);
  assert.equal(enemy.dead, true);
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
  assert.equal(audio.noises.length > 0, true);
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
  player.hp = 1;
  defeatBoss(state, player, state.boss, () => {}, audio, stageDefinitions);
  assert.equal(state.loopIndex, 1);
  assert.equal(state.stageIndex, 0);
  assert.equal(player.hp, 5);
  assert.equal(state.burstStocks, 1);
  assert.equal(player.invuln > 0, true);

  state.boss = createBossInstance("seraph", makeBossContext(state, player));
  state.stageIndex = stageDefinitions.length - 1;
  defeatBoss(state, player, state.boss, () => {}, audio, stageDefinitions);
  assert.equal(state.over, true);
  assert.equal(state.victory, true);
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

  state.entities.push(
    createEntity("enemy", {
      position: position(0, 0),
      collider: collider(4),
      health: health(1),
    })
  );
  updateStage(state, stages, contentContext, audio, 0.7);
  assert.equal(Boolean(state.boss), true);
  assert.equal(state.entities.every((entity) => entity.dead), true);
  assert.equal(audio.chords.length > 0 || audio.noises.length > 0, true);
});
