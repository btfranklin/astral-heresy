import test from "node:test";
import assert from "node:assert/strict";

import { createBossInstance } from "../../../src/data/bosses.js";
import { createEntity } from "../../../src/entities/entityFactory.js";
import { attack, collider, health, pickup, position, reward, scoreShard } from "../../../src/entities/components.js";
import { spawnEnemy } from "../../../src/systems/enemySystem.js";
import { spawnEnemyBullet, spawnPlayerBullet } from "../../../src/systems/bulletSystem.js";
import {
  collectPickup,
  collectScoreShard,
  damageBoss,
  damageEnemy,
  damagePlayer,
  maybeGrazeEnemyBullet,
  rewardKill,
  triggerBurst,
} from "../../../src/systems/collisionInternals.js";
import { combatTuning } from "../../../src/core/combat.js";
import { powerupTuning } from "../../../src/core/powerups.js";
import { makeAudioSpy, makeBossContext, makeState } from "../../helpers/fixtures.mjs";

test("damagePlayer respects halo shield and handles lethal damage", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  player.activePowerups.haloShield = 10;
  damagePlayer(state, player, audio, () => {}, player.x, player.y);
  assert.equal(player.hp, 5);
  assert.equal(player.activePowerups.haloShield, 0);
  assert.equal(player.invuln, powerupTuning.shieldGraceInvuln);
  assert.equal(audio.events.at(-1).kind, "shield-absorb");

  player.activePowerups.haloShield = 0;
  player.hp = 1;
  damagePlayer(state, player, audio, () => {}, player.x, player.y);
  assert.equal(state.over, true);
  assert.equal(audio.endings.length, 1);
  assert.equal(audio.endings[0].outcome, "death");
  assert.equal(audio.events.some(({ kind }) => kind === "player-hit"), false);

  state.over = false;
  player.hp = 2;
  damagePlayer(state, player, audio, () => {}, player.x, player.y);
  assert.equal(state.over, false);
  assert.equal(audio.events.at(-1).kind, "player-hit");
  assert.equal(audio.endings.length, 1);
});

test("enemy and boss damage paths spend bullets, award hits, and trigger rewards", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const spawnedPickups = [];
  const spawnedShards = [];
  const enemy = spawnEnemy(state, "halo", {
    x: player.x + 20,
    y: player.y - 40,
    vx: 0,
    vy: 0,
    hp: 1,
    elite: true,
    dropKey: "spread",
    scoreShardCount: 5,
  });
  const bullet = spawnPlayerBullet(state, enemy.components.position.x, enemy.components.position.y, 0, 0, {
    damage: 1,
  });
  damageEnemy(
    state,
    player,
    enemy,
    bullet,
    1,
    audio,
    () => {},
    (kind, x, y) => spawnedPickups.push({ kind, x, y }),
    (x, y, count) => spawnedShards.push({ x, y, count })
  );
  assert.equal(enemy.dead, true);
  assert.equal(spawnedPickups[0].kind, "spread");
  assert.equal(spawnedShards[0].count, 5);
  assert.equal(state.kills, 1);
  assert.equal(state.scoreBonuses.elite > 0, true);

  const boss = createBossInstance("seraph", makeBossContext(state, player));
  boss.phaseIndex = 1;
  boss.phaseHp = boss.phases[1].hp;
  boss.weakpoint = { x: boss.x, y: boss.y, radius: 10, damageMultiplier: 3, bonusScore: 18, color: "#fff" };
  state.boss = boss;
  const weakpointBullet = spawnPlayerBullet(state, boss.x, boss.y, 0, 0, {
    damage: 1,
    weakpointBrandDuration: 1.25,
  });
  damageBoss(state, player, boss, weakpointBullet, 3, true, audio, () => {}, () => {}, () => {});
  assert.equal(boss.phaseHp, boss.phases[1].hp - 3);
  assert.equal(boss.weakpointBrandTimer, 1.25);
  assert.equal(state.scoreBonuses.weakpoint, boss.weakpoint.bonusScore);
});

test("rewardKill, pickup collection, shard collection, and graze helpers update score surfaces", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const spawnedPickups = [];
  const spawnedShards = [];
  const enemy = spawnEnemy(state, "cherub", {
    x: player.x + 30,
    y: player.y,
    vx: 0,
    vy: 0,
    hp: 1,
    risk: true,
    scoreShardCount: 4,
    scoreBonus: 50,
    label: "Risk Beat",
  });

  rewardKill(
    state,
    player,
    enemy,
    enemy.components.position,
    enemy.components.health,
    audio,
    () => {},
    (kind, x, y) => spawnedPickups.push({ kind, x, y }),
    (x, y, count, options) => spawnedShards.push({ x, y, count, options })
  );
  assert.equal(enemy.dead, true);
  assert.equal(spawnedPickups.length, 0);
  assert.equal(spawnedShards[0].options.category, "risk");
  assert.equal(state.scoreBonuses.close > 0, true);

  const pickupEntity = createEntity(state, "pickup", {
    position: position(player.x, player.y),
    pickup: pickup({ kind: "halo-shield" }),
  });
  const definition = collectPickup(state, player, audio, pickupEntity);
  assert.equal(definition.key, "halo-shield");
  assert.equal(pickupEntity.dead, true);
  assert.equal(audio.events.at(-1).kind, "pickup");

  const shardEntity = createEntity(state, "scoreShard", {
    scoreShard: scoreShard({ value: 40 }),
    position: position(player.x, player.y),
    collider: collider(4),
  });
  const shardAward = collectScoreShard(state, shardEntity);
  assert.equal(shardAward, 40);
  assert.equal(state.scoreBonuses.shard, 40);

  const grazeBullet = spawnEnemyBullet(state, player.x + 22, player.y, 0, 0, { r: 4 });
  const grazed = maybeGrazeEnemyBullet(
    state,
    player,
    audio,
    grazeBullet,
    (22 ** 2),
    (player.radius + combatTuning.grazeInnerOffset + 4) ** 2,
    (player.radius + combatTuning.grazeOuterOffset + 4) ** 2
  );
  assert.equal(grazed, true);
  assert.equal(grazeBullet.components.attack.grazed, true);
  assert.equal(state.scoreBonuses.graze, combatTuning.grazeScore);
});

test("triggerBurst clears nearby bullets, damages threats, and awards burst score", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  state.burstStocks = 1;
  player.pendingBurst = true;
  const nearBullet = spawnEnemyBullet(state, player.x + 20, player.y, 0, 0, {});
  const farBullet = spawnEnemyBullet(state, player.x + 240, player.y, 0, 0, {});
  const enemy = spawnEnemy(state, "cherub", {
    x: player.x + 40,
    y: player.y,
    vx: 0,
    vy: 0,
    hp: 1,
  });
  triggerBurst(
    state,
    player,
    audio,
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
    {
      enemies: [enemy],
      enemyBullets: [nearBullet, farBullet],
    }
  );

  assert.equal(state.burstStocks, 0);
  assert.equal(nearBullet.dead, true);
  assert.equal(farBullet.dead, false);
  assert.equal(enemy.dead, true);
  assert.equal(state.scoreBonuses.burst, combatTuning.burstBulletScore);
  assert.equal(player.pendingBurst, false);
});
