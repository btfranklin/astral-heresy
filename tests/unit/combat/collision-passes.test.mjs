import test from "node:test";
import assert from "node:assert/strict";

import { createBossInstance } from "../../../src/data/bosses.js";
import { buildEntityBuckets } from "../../../src/entities/entityBuckets.js";
import { spawnEnemyBullet, spawnPlayerBullet } from "../../../src/systems/bulletSystem.js";
import { resolveBossHits } from "../../../src/systems/collision/bossHits.js";
import { collectPickupsAndScoreShards } from "../../../src/systems/collision/collections.js";
import { resolveEnemyHits } from "../../../src/systems/collision/enemyHits.js";
import { resolvePlayerBurst, resolvePlayerHazards } from "../../../src/systems/collision/playerHazards.js";
import { spawnEnemy } from "../../../src/systems/enemySystem.js";
import { spawnPickup, spawnScoreShards } from "../../../src/systems/pickupSystem.js";
import { makeAudioSpy, makeBossContext, makeState, noopParticles } from "../../helpers/fixtures.mjs";

function makeCollisionContext(state, player, audio, overrides = {}) {
  return {
    state,
    player,
    audio,
    spawnParticle: noopParticles,
    advanceBossPhase: () => {},
    defeatBoss: () => {},
    spawnPickupEntity: () => {},
    spawnScoreShardEntities: () => {},
    buckets: buildEntityBuckets(state),
    ...overrides,
  };
}

test("player hazard passes resolve burst and incoming bullet damage", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  state.burstStocks = 1;
  player.pendingBurst = true;
  const nearBullet = spawnEnemyBullet(state, player.x + 16, player.y, 0, 0, {});
  const enemy = spawnEnemy(state, "cherub", {
    x: player.x + 36,
    y: player.y,
    vx: 0,
    vy: 0,
    hp: 1,
  });

  resolvePlayerBurst(makeCollisionContext(state, player, audio));
  assert.equal(state.burstStocks, 0);
  assert.equal(nearBullet.dead, true);
  assert.equal(enemy.dead, true);

  player.invuln = 0;
  player.hp = 5;
  const hitBullet = spawnEnemyBullet(state, player.x, player.y, 0, 0, { r: 4 });
  resolvePlayerHazards(makeCollisionContext(state, player, audio));
  assert.equal(hitBullet.dead, true);
  assert.equal(player.hp, 4);
});

test("enemy hit pass spends bullets and routes kill rewards", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const spawnedPickups = [];
  const spawnedShards = [];
  const enemy = spawnEnemy(state, "halo", {
    x: player.x,
    y: player.y - 80,
    vx: 0,
    vy: 0,
    hp: 1,
    elite: true,
    dropKey: "spread",
    scoreShardCount: 5,
  });
  const pos = enemy.components.position;
  const bullet = spawnPlayerBullet(state, pos.x, pos.y, 0, 0, { damage: 1 });

  resolveEnemyHits(makeCollisionContext(state, player, audio, {
    spawnPickupEntity: (kind, x, y) => spawnedPickups.push({ kind, x, y }),
    spawnScoreShardEntities: (x, y, count) => spawnedShards.push({ x, y, count }),
  }));

  assert.equal(enemy.dead, true);
  assert.equal(bullet.dead, true);
  assert.equal(spawnedPickups[0].kind, "spread");
  assert.equal(spawnedShards[0].count, 5);
  assert.equal(state.kills, 1);
});

test("collection pass handles pickups and score shards together", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  spawnPickup(state, "spread", player.x, player.y, {});
  spawnScoreShards(state, player.x, player.y, 1, { value: 40 });

  collectPickupsAndScoreShards(makeCollisionContext(state, player, audio));

  assert.equal(player.weaponMode, "spread");
  assert.equal(state.scoreBonuses.shard, 40);
  assert.equal(buildEntityBuckets(state).pickups.length, 0);
  assert.equal(buildEntityBuckets(state).scoreShards.length, 0);
});

test("boss hit pass resolves weakpoint damage and bonus scoring", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const boss = createBossInstance("seraph", makeBossContext(state, player));
  boss.phaseIndex = 1;
  boss.phaseHp = boss.phases[1].hp;
  boss.weakpoint = { x: boss.x, y: boss.y, radius: 12, damageMultiplier: 3, bonusScore: 25, color: "#fff" };
  state.boss = boss;
  const bullet = spawnPlayerBullet(state, boss.x, boss.y, 0, 0, {
    damage: 2,
    weakpointBrandDuration: 1.25,
  });

  resolveBossHits(makeCollisionContext(state, player, audio));

  assert.equal(bullet.dead, true);
  assert.equal(boss.phaseHp, boss.phases[1].hp - 6);
  assert.equal(boss.weakpointBrandTimer, 1.25);
  assert.equal(state.scoreBonuses.weakpoint, 25);
});
