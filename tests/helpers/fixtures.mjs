import { createStageDirector } from "../../src/core/director.js";
import { createGameState } from "../../src/state/gameState.js";
import { createPlayfield, createPlayfieldContext } from "../../src/state/playfieldState.js";
import { createPlayerState } from "../../src/state/playerState.js";
import { buildEntityBuckets } from "../../src/entities/entityBuckets.js";
import { handleCollisions } from "../../src/systems/collisionSystem.js";
import { spawnPickup, spawnScoreShards } from "../../src/systems/pickupSystem.js";

export function makeState({ width = 1280, height = 720, started = true } = {}) {
  const state = createGameState();
  state.started = started;
  state.view.width = width;
  state.view.height = height;
  state.playfield = createPlayfield(width, height);
  state.input = { pointerEnabled: true };
  const player = createPlayerState(width, height);
  return { state, player };
}

export function makeAudioSpy() {
  return {
    engine: { lastShot: 0 },
    tones: [],
    noises: [],
    chords: [],
    initCalls: 0,
    resumeCalls: 0,
    init() {
      this.initCalls += 1;
    },
    resume() {
      this.resumeCalls += 1;
    },
    playNoise(duration, opts = {}) {
      this.noises.push({ duration, opts });
    },
    playTone(type, freq, duration, opts = {}) {
      this.tones.push({ type, freq, duration, opts });
    },
    playChord(freqs, duration, opts = {}) {
      this.chords.push({ freqs, duration, opts });
    },
    updateMusic() {},
  };
}

export function noopParticles() {}

export function noopAdvanceBossPhase() {}

export function makeBossContext(state, player, overrides = {}) {
  return {
    view: state.view,
    player,
    playfield: createPlayfieldContext(state),
    director: createStageDirector(state),
    loopIndex: 0,
    spawnEnemyBullet() {},
    spawnEnemy() {},
    spawnPickup() {},
    spawnScoreShards() {},
    ...overrides,
  };
}

export function handleWithBuckets(state, player, audio, overrides = {}) {
  const buckets = overrides.buckets || buildEntityBuckets(state);
  handleCollisions(
    state,
    player,
    audio,
    overrides.spawnParticle || noopParticles,
    overrides.advanceBossPhase || noopAdvanceBossPhase,
    overrides.defeatBoss || (() => {}),
    overrides.spawnPickupEntity || ((kind, x, y, entityOverrides = {}) => spawnPickup(state, kind, x, y, entityOverrides)),
    overrides.spawnScoreShardEntities ||
      ((x, y, count, options = {}) => spawnScoreShards(state, x, y, count, options)),
    buckets
  );
  return buckets;
}

export function makeContentContext() {
  const spawnEnemyBulletCalls = [];
  const spawnEnemyCalls = [];
  const spawnPickupCalls = [];
  const spawnScoreShardCalls = [];
  const playfield = {
    active: true,
    minX: 280,
    maxX: 1000,
    leftEdge: 280,
    rightEdge: 1000,
    minY: 30,
    maxY: 690,
    laneX(fraction) {
      return 280 + (1000 - 280) * fraction;
    },
    randomX(padding = 0) {
      return 280 + padding + (1000 - 560 - padding * 2) * 0.5;
    },
    clampX(x, padding = 0) {
      return Math.max(280 + padding, Math.min(1000 - padding, x));
    },
  };

  return {
    view: {
      width: 1280,
      height: 720,
      dpr: 1,
    },
    player: {
      x: 640,
      y: 600,
    },
    spawnEnemyBulletCalls,
    spawnEnemyCalls,
    spawnPickupCalls,
    spawnScoreShardCalls,
    loopIndex: 1,
    playfield,
    director: {
      gateWave() {
        return { allow: true, delay: 0, bulletScale: 1, escortScale: 1, anchorOnly: false };
      },
    },
    spawnEnemyBullet(x, y, angle, speed, opts = {}) {
      spawnEnemyBulletCalls.push({ x, y, angle, speed, opts });
      return { x, y, angle, speed, opts };
    },
    spawnEnemy(archetypeKey, overrides = {}) {
      spawnEnemyCalls.push({ archetypeKey, overrides });
      return { archetypeKey, overrides };
    },
    spawnPickup(kind, x, y, overrides = {}) {
      spawnPickupCalls.push({ kind, x, y, overrides });
      return { kind, x, y, overrides };
    },
    spawnScoreShards(x, y, count, options = {}) {
      spawnScoreShardCalls.push({ x, y, count, options });
      return { x, y, count, options };
    },
  };
}

export async function withRandomSequence(values, fn) {
  const previousRandom = Math.random;
  let index = 0;
  Math.random = () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
  try {
    return await fn();
  } finally {
    Math.random = previousRandom;
  }
}
