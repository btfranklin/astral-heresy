import test from "node:test";
import assert from "node:assert/strict";

import { getOrbitalOffsets } from "../../../src/core/orbitals.js";
import { createBossInstance } from "../../../src/data/bosses.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { buildEntityBuckets } from "../../../src/entities/entityBuckets.js";
import { createCanvasRenderer } from "../../../src/rendering/canvasRenderer.js";
import { spawnPlayerBullet, updateBullets } from "../../../src/systems/bulletSystem.js";
import { advanceBossPhase } from "../../../src/systems/bossSystem.js";
import {
  damageBoss,
  triggerBurst,
} from "../../../src/systems/collisionInternals.js";
import {
  resolveOrbitalEnemyHits,
  resolvePlayerBulletEnemyHits,
} from "../../../src/systems/collision/enemyHits.js";
import { spawnEnemy } from "../../../src/systems/enemySystem.js";
import { updateVisualFeedback } from "../../../src/systems/visualFeedbackSystem.js";
import {
  makeAudioSpy,
  makeBossContext,
  makeState,
  noopParticles,
} from "../../helpers/fixtures.mjs";
import { createRecording2dContext } from "../../helpers/runtimeFixture.mjs";

function makeEnemyHitContext(state, player, audio, dt = 1 / 60) {
  return {
    state,
    player,
    audio,
    dt,
    spawnParticle: noopParticles,
    spawnPickupEntity() {},
    spawnScoreShardEntities() {},
    buckets: buildEntityBuckets(state),
  };
}

test("boss phase barriers discard overkill and keep total health coherent", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const boss = createBossInstance("seraph", makeBossContext(state, player));
  state.boss = boss;
  let defeats = 0;

  function hit(damage) {
    const bullet = spawnPlayerBullet(state, boss.x, boss.y, 0, 0, { damage });
    damageBoss(
      state,
      player,
      boss,
      bullet,
      damage,
      false,
      audio,
      noopParticles,
      advanceBossPhase,
      () => {
        defeats += 1;
      }
    );
  }

  hit(161);
  assert.equal(boss.phaseIndex, 1);
  assert.equal(boss.phaseHp, 160);
  assert.equal(boss.hp, 320);
  assert.equal(defeats, 0);

  hit(161);
  assert.equal(boss.phaseIndex, 2);
  assert.equal(boss.phaseHp, 160);
  assert.equal(boss.hp, 160);
  assert.equal(defeats, 0);

  hit(158);
  assert.equal(boss.phaseHp, 2);
  assert.equal(boss.hp, 2);
  assert.equal(defeats, 0);

  hit(100);
  assert.equal(boss.phaseIndex, boss.phases.length);
  assert.equal(boss.phaseHp, 0);
  assert.equal(boss.hp, 0);
  assert.equal(defeats, 1);
});

test("burst damage obeys the same boss phase barrier policy", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const boss = createBossInstance("seraph", makeBossContext(state, player));
  boss.phaseHp = 10;
  boss.hp = 330;
  state.boss = boss;
  state.burstStocks = 1;
  player.x = boss.x;
  player.y = boss.y;

  triggerBurst(
    state,
    player,
    audio,
    noopParticles,
    advanceBossPhase,
    () => {
      assert.fail("The first phase barrier must prevent burst overkill from defeating the boss.");
    },
    () => {},
    () => {},
    {
      enemies: [],
      enemyBullets: [],
    }
  );

  assert.equal(boss.phaseIndex, 1);
  assert.equal(boss.phaseHp, 160);
  assert.equal(boss.hp, 320);
});

test("piercing bullets hit each target once and count accuracy once per projectile", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const x = 640;
  const y = 220;
  const firstEnemy = spawnEnemy(state, "cherub", { x, y, vx: 0, vy: 0, hp: 10 });
  const secondEnemy = spawnEnemy(state, "cherub", { x, y, vx: 0, vy: 0, hp: 10 });
  const piercingBullet = spawnPlayerBullet(state, x, y, 0, 0, {
    damage: 1,
    pierce: 2,
  });

  resolvePlayerBulletEnemyHits(makeEnemyHitContext(state, player, audio));
  assert.equal(firstEnemy.components.health.hp, 9);
  assert.equal(secondEnemy.components.health.hp, 9);
  assert.equal(piercingBullet.dead, false);
  assert.equal(state.shotsFired, 1);
  assert.equal(state.shotsHit, 1);

  resolvePlayerBulletEnemyHits(makeEnemyHitContext(state, player, audio));
  assert.equal(firstEnemy.components.health.hp, 9);
  assert.equal(secondEnemy.components.health.hp, 9);

  const newerBullet = spawnPlayerBullet(state, x, y, 0, 0, { damage: 1 });
  resolvePlayerBulletEnemyHits(makeEnemyHitContext(state, player, audio));
  assert.equal(firstEnemy.components.health.hp, 8);
  assert.equal(newerBullet.dead, true);
  assert.equal(piercingBullet.dead, false);
  assert.equal(state.shotsFired, 2);
  assert.equal(state.shotsHit, 2);

  const thirdEnemy = spawnEnemy(state, "cherub", { x, y, vx: 0, vy: 0, hp: 10 });
  resolvePlayerBulletEnemyHits(makeEnemyHitContext(state, player, audio));
  assert.equal(thirdEnemy.components.health.hp, 9);
  assert.equal(piercingBullet.dead, true);
  assert.equal(state.shotsHit, 2);
});

test("a piercing projectile cannot repeatedly damage the same boss", () => {
  const { state, player } = makeState();
  const audio = makeAudioSpy();
  const boss = createBossInstance("seraph", makeBossContext(state, player));
  state.boss = boss;
  const bullet = spawnPlayerBullet(state, boss.x, boss.y, 0, 0, {
    damage: 3,
    pierce: 1,
  });

  const firstHit = damageBoss(
    state,
    player,
    boss,
    bullet,
    3,
    false,
    audio,
    noopParticles,
    advanceBossPhase,
    () => {}
  );
  const hpAfterFirstHit = boss.hp;
  const repeatedHit = damageBoss(
    state,
    player,
    boss,
    bullet,
    3,
    false,
    audio,
    noopParticles,
    advanceBossPhase,
    () => {}
  );

  assert.equal(firstHit, true);
  assert.equal(repeatedHit, false);
  assert.equal(boss.hp, hpAfterFirstHit);
  assert.equal(state.shotsFired, 1);
  assert.equal(state.shotsHit, 1);
});

test("orbital contact damage is stable across frame partitions", () => {
  function simulate(frameRate) {
    const { state, player } = makeState();
    const audio = makeAudioSpy();
    player.weaponMode = "orbitals";
    state.input.KeyZ = true;
    const orbital = getOrbitalOffsets(state.time, false)[0];
    const enemy = spawnEnemy(state, "cherub", {
      x: player.x + orbital.x,
      y: player.y + orbital.y,
      vx: 0,
      vy: 0,
      hp: 100,
    });
    const context = makeEnemyHitContext(state, player, audio, 1 / frameRate);

    for (let frame = 0; frame < frameRate; frame += 1) {
      resolveOrbitalEnemyHits(context);
    }
    return Number((100 - enemy.components.health.hp).toFixed(10));
  }

  assert.deepEqual(
    [30, 60, 120].map(simulate),
    [4.8, 4.8, 4.8]
  );
});

test("visual shake decay is elapsed-time based and render-independent", () => {
  function simulate(frameRate) {
    const state = { shake: 30 };
    for (let frame = 0; frame < frameRate / 2; frame += 1) {
      updateVisualFeedback(state, 1 / frameRate);
    }
    return Number(state.shake.toFixed(10));
  }

  assert.deepEqual([30, 60, 120].map(simulate), [9, 9, 9]);

  const { state, player } = makeState();
  state.shake = 9;
  createCanvasRenderer(createRecording2dContext()).render(
    state,
    player,
    stageDefinitions,
    buildEntityBuckets(state)
  );
  assert.equal(state.shake, 9);
});

test("dead bullets do not update while awaiting the entity flush", () => {
  const { state, player } = makeState();
  const bullet = spawnPlayerBullet(state, player.x, player.y, 0, 100, {});
  bullet.dead = true;

  updateBullets(state, player, 0.5);

  assert.equal(bullet.components.lifetime.age, 0);
});
