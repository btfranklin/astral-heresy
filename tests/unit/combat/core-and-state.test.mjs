import test from "node:test";
import assert from "node:assert/strict";

import { TAU, clamp, lerp, rand, wrapAngle } from "../../../src/core/math.js";
import { createFrameTimer } from "../../../src/core/time.js";
import { createEventBus } from "../../../src/core/events.js";
import {
  addBonusScore,
  addGrazeCharge,
  combatTuning,
  extendChain,
  getChainMultiplier,
  getCloseRangeBonus,
  maybeRechargeBurst,
  pushBonusText,
  registerGraze,
  resetChain,
} from "../../../src/core/combat.js";
import {
  absorbShieldHit,
  applyPowerupPickup,
  decayPowerupState,
  getChainDecayFactor,
  getCloseRangeBonusMultiplier,
  getGrazeChargeMultiplier,
  getPickupAttractionRadius,
  hasHaloShield,
  listActivePowerups,
  powerupTuning,
  resetPowerupNotice,
} from "../../../src/core/powerups.js";
import { getOrbitalOffsets } from "../../../src/core/orbitals.js";
import {
  createFeedbackState,
  createGameState,
  createPowerupNotice,
  createScoreBonuses,
  resetGameState,
} from "../../../src/state/gameState.js";
import {
  createActivePowerupState,
  createPlayerState,
  getPlayerBounds,
  resetPlayerState,
} from "../../../src/state/playerState.js";
import { resetFreshRunState, resetLoopTransitionState } from "../../../src/state/runReset.js";
import { getPowerupDefinition } from "../../../src/data/powerups.js";
import { getWeaponDefinition } from "../../../src/data/weapons.js";
import {
  clampToEnemyEnvelope,
  clampToLane,
  createPlayfield,
  createPlayfieldContext,
  getBulletEnvelope,
  getPlayfieldCenter,
  laneX,
  randomLaneX,
} from "../../../src/state/playfieldState.js";
import {
  addEntity,
  createEntity,
  findEntities,
  flushEntities,
  removeEntity,
} from "../../../src/entities/entityFactory.js";
import {
  ai,
  attack,
  bulletMotion,
  collider,
  health,
  lifetime,
  pickup,
  position,
  render,
  reward,
  scoreShard,
  velocity,
} from "../../../src/entities/components.js";
import { buildEntityBuckets, createEntityBuckets } from "../../../src/entities/entityBuckets.js";
import { spawnParticle, updateParticles } from "../../../src/systems/particleSystem.js";
import { makeState, withRandomSequence } from "../../helpers/fixtures.mjs";

test("math helpers are deterministic and bounded", async () => {
  assert.equal(TAU, Math.PI * 2);
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-2, 0, 3), 0);
  assert.equal(lerp(10, 20, 0.25), 12.5);
  assert.equal(wrapAngle(Math.PI + 0.2) < Math.PI, true);
  assert.equal(wrapAngle(-Math.PI - 0.2) > -Math.PI, true);
  await withRandomSequence([0.25], () => {
    assert.equal(rand(10, 14), 11);
  });
});

test("frame timer uses the first timestamp as a baseline and clamps later deltas", () => {
  const next = createFrameTimer(0.033);
  assert.equal(next(0), 0);
  assert.equal(next(1000), 0);
  assert.equal(next(2000), 0.033);

  const bus = createEventBus();
  const seen = [];
  const unsubscribe = bus.on("tick", (payload) => seen.push(payload));
  bus.emit("tick", 1);
  unsubscribe();
  bus.emit("tick", 2);
  assert.deepEqual(seen, [1]);
});

test("combat helpers manage score, graze, chains, and burst recharge", () => {
  const { state, player } = makeState();
  state.scoreBonuses = createScoreBonuses();
  state.feedback = createFeedbackState();

  assert.equal(getChainMultiplier(3), 1 + 3 * combatTuning.chainStep);
  assert.equal(getCloseRangeBonus(80), combatTuning.closeRangeNearBonus);
  assert.equal(getCloseRangeBonus(120), combatTuning.closeRangeMidBonus);
  assert.equal(getCloseRangeBonus(200), 0);

  pushBonusText(state, "TEST", 1.5);
  assert.equal(state.bonusText, "TEST");
  assert.equal(state.bonusTimer, 1.5);

  addBonusScore(state, "graze", 20.4, "GRAZE");
  assert.equal(state.score, 20);
  assert.equal(state.scoreBonuses.graze, 20);

  addGrazeCharge(state, 95);
  maybeRechargeBurst(state);
  assert.equal(state.burstStocks, 1);
  registerGraze(state, player);
  assert.equal(state.grazeWindow, combatTuning.grazeComboWindow);
  assert.equal(state.scoreBonuses.graze > 0, true);

  state.grazeCharge = 100;
  state.burstStocks = 1;
  maybeRechargeBurst(state);
  assert.equal(state.burstStocks, 2);
  assert.equal(state.grazeCharge, 0);

  extendChain(state, 2);
  assert.equal(state.chainLevel, 2);
  assert.equal(state.chainTimer, combatTuning.chainWindow);
  resetChain(state);
  assert.equal(state.chainLevel, 0);
  assert.equal(state.chainTimer, 0);
});

test("powerup helpers manage notices, multipliers, ordering, shield absorption, and pickups", () => {
  const { state, player } = makeState();
  state.feedback = createFeedbackState();
  state.scoreBonuses = createScoreBonuses();

  assert.deepEqual(player.activePowerups, createActivePowerupState());
  assert.equal(createPowerupNotice().category, "utility");

  player.activePowerups.haloShield = 12;
  player.activePowerups.chainSigil = 10;
  player.activePowerups.grazeBloom = 8;
  player.activePowerups.pointBlankSeal = 6;
  player.activePowerups.magnetCore = 4;
  player.weaponMode = "beam";
  player.weaponTimer = 5;

  assert.equal(getPickupAttractionRadius(player), powerupTuning.magnetRadius);
  assert.equal(getGrazeChargeMultiplier(player), powerupTuning.grazeBloomMultiplier);
  assert.equal(getChainDecayFactor(player), powerupTuning.chainDecayFactor);
  assert.equal(getCloseRangeBonusMultiplier(player), powerupTuning.pointBlankMultiplier);
  assert.equal(hasHaloShield(player), true);

  const listed = listActivePowerups(player);
  assert.deepEqual(
    listed.map((entry) => entry.key),
    ["halo-shield", "chain-sigil", "graze-bloom", "point-blank-seal", "beam", "magnet-core"],
    "Active powerups should be listed by remaining timer, with the temporary weapon included in the strip."
  );
  const beamEntry = listed.find((entry) => entry.key === "beam");
  const beamDefinition = getWeaponDefinition("beam");
  assert.deepEqual(
    { color: beamEntry.color, duration: beamEntry.duration },
    { color: beamDefinition.pickupColor, duration: beamDefinition.duration }
  );
  const shieldEntry = listed.find((entry) => entry.key === "halo-shield");
  const shieldDefinition = getPowerupDefinition("halo-shield");
  assert.deepEqual(
    { color: shieldEntry.color, duration: shieldEntry.duration, sides: shieldEntry.sides },
    {
      color: shieldDefinition.pickupColor,
      duration: shieldDefinition.duration,
      sides: shieldDefinition.hudSides,
    }
  );

  const absorbed = absorbShieldHit(state, player);
  assert.equal(absorbed, true);
  assert.equal(player.activePowerups.haloShield, 0);
  assert.equal(state.feedback.shield > 0, true);

  applyPowerupPickup(state, player, "spread", player.x, player.y);
  assert.equal(player.weaponMode, "spread");
  assert.equal(player.weaponTimer > 0, true);
  applyPowerupPickup(state, player, "burst-cell", player.x, player.y);
  assert.equal(state.burstStocks, 2);
  state.burstStocks = combatTuning.maxBurstStocks;
  state.grazeCharge = 0;
  applyPowerupPickup(state, player, "burst-cell", player.x, player.y);
  assert.equal(state.grazeCharge, powerupTuning.burstCellGrazeFallback);

  decayPowerupState(state, player, 1);
  assert.equal(state.powerupNotice.timer < powerupTuning.pickupNoticeDuration, true);
  resetPowerupNotice(state);
  assert.equal(state.powerupNotice.timer, 0);
});

test("orbitals return three offsets and focus tightens the radius", () => {
  const wide = getOrbitalOffsets(1.2, false);
  const focused = getOrbitalOffsets(1.2, true);
  assert.equal(wide.length, 3);
  assert.equal(focused.length, 3);
  assert.equal(Math.abs(focused[0].x) < Math.abs(wide[0].x) || Math.abs(focused[0].y) < Math.abs(wide[0].y), true);
});

test("game state and player state create and reset their defaults", () => {
  const state = createGameState();
  assert.equal(state.burstStocks, 1);
  assert.equal(state.scoreBonuses.shard, 0);
  assert.equal(state.feedback.shield, 0);
  assert.equal(state.playfield.active, false);

  state.view.width = 1280;
  state.view.height = 720;
  state.started = true;
  state.entities.push(createEntity(state, "enemy", { position: position(0, 0) }));
  state.loopIndex = 1;
  resetGameState(state);
  assert.equal(state.started, false);
  assert.equal(state.entities.length, 0);
  assert.equal(state.playfield.active, true);

  const player = createPlayerState(1280, 720);
  const desktopBounds = getPlayerBounds(1280, 720);
  const compactBounds = getPlayerBounds(520, 900);
  assert.equal(player.x, desktopBounds.startX);
  assert.equal(compactBounds.startY <= compactBounds.maxY, true);
  player.hp = 1;
  resetPlayerState(player, 1280, 720);
  assert.equal(player.hp, 5);
  assert.equal(player.weaponMode, "base");
});

test("run reset helpers centralize fresh starts and loop transitions", () => {
  const state = createGameState();
  state.view.width = 1280;
  state.view.height = 720;
  const player = createPlayerState(1280, 720);

  state.started = true;
  state.entities.push(createEntity(state, "enemy", { position: position(0, 0) }));
  player.hp = 1;
  player.weaponMode = "beam";
  player.weaponLabel = "Beam";
  player.weaponTimer = 4;
  resetFreshRunState(state, player);
  assert.equal(state.started, false);
  assert.equal(state.entities.length, 0);
  assert.equal(player.hp, 5);
  assert.equal(state.input.pointerX, player.x);
  assert.equal(state.input.pointerY, player.y);

  state.stageIndex = 3;
  state.stageTime = 12;
  state.stageState = { stale: true };
  state.feedback.loop = 0;
  state.burstStocks = 2;
  state.grazeCharge = 80;
  player.hp = 2;
  player.invuln = 0;
  player.weaponMode = "orbitals";
  player.weaponLabel = "Orbitals";
  player.weaponTimer = 6;
  player.pendingBurst = true;
  player.activePowerups.haloShield = 10;
  resetLoopTransitionState(state, player);

  assert.equal(state.loopIndex, 1);
  assert.equal(state.stageIndex, 0);
  assert.equal(state.stageTime, 0);
  assert.equal(state.stageState, null);
  assert.equal(state.feedback.loop, 1.2);
  assert.equal(state.burstStocks, 1);
  assert.equal(state.grazeCharge, 0);
  assert.equal(player.hp, 5);
  assert.equal(player.invuln, 1.4);
  assert.equal(player.weaponMode, "base");
  assert.equal(player.weaponLabel, "Standard");
  assert.equal(player.weaponTimer, 0);
  assert.equal(player.pendingBurst, false);
  assert.equal(player.activePowerups.haloShield, 0);
});

test("playfield helpers compute lane geometry, envelopes, and context projections", async () => {
  const desktop = createPlayfield(1280, 720);
  const tablet = createPlayfield(900, 720);
  const compact = createPlayfield(520, 900);

  assert.equal(desktop.active, true);
  assert.equal(desktop.leftBayWidth, 0);
  assert.equal(desktop.rightBayWidth, 0);
  assert.equal(desktop.minX, 48);
  assert.equal(desktop.maxX, 1232);
  assert.equal(tablet.active, false);
  assert.equal(compact.compactPortrait, true);
  assert.equal(getPlayfieldCenter(desktop), (desktop.minX + desktop.maxX) / 2);
  assert.equal(laneX(desktop, 0.5), getPlayfieldCenter(desktop));
  assert.equal(clampToLane(desktop, -100, 0), desktop.minX);
  assert.equal(clampToEnemyEnvelope(desktop, -100), desktop.minX - 54);
  assert.deepEqual(getBulletEnvelope(tablet, 900), { minX: -80, maxX: 980 });

  await withRandomSequence([0.5], () => {
    assert.equal(randomLaneX(desktop, 10), desktop.minX + 10 + (desktop.maxX - desktop.minX - 20) * 0.5);
  });

  const { state } = makeState();
  const context = createPlayfieldContext(state);
  assert.equal(context.active, true);
  assert.equal(context.leftEdge, state.playfield.minX);
  assert.equal(context.laneX(0.25), laneX(state.playfield, 0.25));
});

test("entity factory, components, buckets, and particles behave deterministically", async () => {
  const { state } = makeState();
  const buckets = createEntityBuckets();
  assert.deepEqual(Object.keys(buckets), ["enemies", "enemyBullets", "playerBullets", "pickups", "scoreShards", "particles"]);

  await withRandomSequence([0.25, 0.75], () => {
    const seededMotion = bulletMotion({});
    assert.equal(Number(seededMotion.seed.toFixed(2)), Number((Math.PI * 2 * 0.25).toFixed(2)));
    const seededAttack = attack({ damage: 2, pierce: 1 });
    assert.equal(seededAttack.damage, 2);
    assert.equal(seededAttack.pierce, 1);
  });

  const entityA = createEntity(state, "enemy", { position: position(1, 2), velocity: velocity(3, 4) });
  const entityB = createEntity(state, "pickup", {
    pickup: pickup({ kind: "spread", duration: 10 }),
    collider: collider(12),
    render: render({ color: "#fff" }),
    reward: reward({ dropKey: "spread" }),
    scoreShard: scoreShard({ value: 10 }),
    health: health(3),
    lifetime: lifetime(1),
    ai: ai({}),
  });
  assert.equal(entityB.id > entityA.id, true);
  assert.equal(entityB.components.reward.dropKey, "spread");

  addEntity(state, entityA);
  addEntity(state, createEntity(state, "enemyBullet", { position: position(0, 0) }));
  addEntity(state, createEntity(state, "playerBullet", { position: position(0, 0) }));
  addEntity(state, entityB);
  addEntity(state, createEntity(state, "scoreShard", { position: position(0, 0) }));
  addEntity(state, createEntity(state, "particle", { position: position(0, 0), lifetime: lifetime(1), render: render({ size: 2 }) }));
  const built = buildEntityBuckets(state);
  assert.equal(built.enemies.length, 1);
  assert.equal(built.enemyBullets.length, 1);
  assert.equal(built.playerBullets.length, 1);
  assert.equal(built.pickups.length, 1);
  assert.equal(built.scoreShards.length, 1);
  assert.equal(built.particles.length, 1);

  removeEntity(entityA);
  flushEntities(state);
  assert.equal(findEntities(state, (entity) => entity.type === "enemy").length, 0);

  await withRandomSequence([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], () => {
    spawnParticle(state, 10, 12, "#fff", 2, 100, 1, 4);
  });
  assert.equal(findEntities(state, (entity) => entity.type === "particle").length >= 2, true);
  updateParticles(state, 2);
  assert.equal(findEntities(state, (entity) => entity.type === "particle").some((entity) => entity.dead), true);
});
