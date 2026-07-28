import assert from "node:assert/strict";
import test from "node:test";

import { createAudioEngine } from "../../../src/audio/audioEngine.js";
import {
  audioBossProfiles,
  clampFeedback,
  listAudioBossProfiles,
  listAudioStageProfiles,
} from "../../../src/audio/audioProfiles.js";
import { panForWorldX, projectAudioWorld } from "../../../src/audio/audioState.js";
import { getAudioEventRecipe, listAudioEventKinds } from "../../../src/audio/sfx.js";
import { bossDefinitions } from "../../../src/data/bosses.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { makeState } from "../../helpers/fixtures.mjs";
import {
  createAudioNode,
  createAudioParam,
  makeAudioWorld,
  RecordingAudioContext,
} from "../../helpers/audioFixture.mjs";

test("stage and boss audio profiles cover the complete authored world within safe bounds", () => {
  const stages = listAudioStageProfiles();
  assert.deepEqual(stages.map(({ key }) => key), stageDefinitions.map(({ key }) => key));
  assert.deepEqual(stages.map(({ root }) => root), [164.81, 196, 146.83]);
  assert.deepEqual(stages.map(({ delays }) => delays), [
    [0.113, 0.173, 0.271, 0.397],
    [0.012, 0.017, 0.023, 0.031],
    [0.149, 0.211, 0.307, 0.431],
  ]);
  assert.deepEqual(stages.map(({ feedback }) => feedback), [0.32, 0.46, 0.6]);
  assert.deepEqual(stages.map(({ impulseDuration }) => impulseDuration), [1.4, 0.8, 2.8]);
  for (const profile of stages) {
    assert.equal(profile.delays.length, 4);
    assert.equal(profile.delays.every((delay) => delay > 0 && delay < 0.5), true);
    assert.equal(profile.feedback < 0.68, true);
    assert.equal(profile.impulseDuration <= 3, true);
    assert.equal(profile.wave.length >= 8, true);
  }
  assert.equal(clampFeedback(5), 0.68);
  assert.equal(clampFeedback(-1), 0);

  const bossProfiles = listAudioBossProfiles();
  assert.equal(bossProfiles.length, 9);
  for (const boss of bossDefinitions) {
    assert.equal(audioBossProfiles[boss.key].length, boss.phases.length);
    assert.equal(audioBossProfiles[boss.key].every(({ key }) => typeof key === "string"), true);
  }
  assert.equal(audioBossProfiles.prism[0].modalSharpness > 1, true);
  assert.equal(audioBossProfiles.prism[1].sideband > 0, true);
  assert.equal(audioBossProfiles.prism[2].dispersion > 0, true);
  assert.equal(audioBossProfiles.cathedral[1].delayScale > 1, true);
  assert.equal(audioBossProfiles.seraph[2].descent > 0, true);
});

test("audio world projection is bounded, read-only, and contains no gameplay mutation path", () => {
  const { state, player } = makeState();
  state.time = 12.5;
  state.stageIndex = 1;
  state.loopIndex = 1;
  state.chainLevel = 6;
  state.grazeCharge = 50;
  state.density.liveEnemies = state.density.maxEnemies * 2;
  state.density.liveEnemyBullets = state.density.maxEnemyBullets / 2;
  player.hp = 3;
  player.x = state.playfield.maxX + 500;
  state.boss = {
    key: "prism",
    phaseIndex: 2,
    hp: 100,
    maxHp: 600,
  };

  const world = projectAudioWorld(state, player, stageDefinitions);
  assert.equal(Object.isFrozen(world), true);
  assert.equal(world.stageKey, "crystalline-choir");
  assert.equal(world.loopIndex, 1);
  assert.equal(world.hull, 3);
  assert.equal(world.chainRatio, 0.5);
  assert.equal(world.grazeRatio, 0.5);
  assert.equal(world.densityRatio, 1);
  assert.equal(world.bossKey, "prism");
  assert.equal(world.bossPhaseIndex, 2);
  assert.equal(world.bossProgress > 0.8, true);
  assert.equal("state" in world || "player" in world, false);
  assert.equal(panForWorldX(world, -10_000), -1);
  assert.equal(panForWorldX(world, 10_000), 1);
});

test("semantic recipes retain center weight, valid source bounds, and complete cue coverage", () => {
  const required = [
    "fire",
    "graze",
    "shield-absorb",
    "enemy-defeat",
    "chain-milestone",
    "player-hit",
    "burst",
    "boss-arrival",
    "boss-phase",
    "weakpoint",
    "boss-defeat",
    "pickup",
    "start",
    "player-death",
    "victory",
  ];
  assert.deepEqual(listAudioEventKinds(), required);
  for (const kind of required) {
    const recipe = getAudioEventRecipe(kind, { payload: { phaseIndex: 2 } });
    assert.equal(recipe.center >= 0.6 && recipe.center <= 1, true);
    assert.equal(recipe.voices.length > 0, true);
    for (const voice of recipe.voices) {
      assert.equal(voice.duration > 0 && voice.duration <= 3.2, true);
      assert.equal(voice.amp > 0 && voice.amp <= 0.32, true);
      assert.equal((voice.send ?? 0) >= 0 && (voice.send ?? 0) <= 0.9, true);
      if (voice.freq) assert.equal(voice.freq >= 32 && voice.freq < 20_000, true);
      if (voice.freqs) assert.equal(voice.freqs.every((frequency) => frequency >= 32), true);
    }
  }
  assert.equal(getAudioEventRecipe("player-death").center >= 0.98, true);
});

test("engine bounds voices and bodies and makes end, reset, and disposal transitions idempotent", async () => {
  const context = new RecordingAudioContext();
  const audio = createAudioEngine({
    contextFactory: () => context,
    enableWorklet: false,
    seed: 7,
  });
  assert.equal(audio.getDiagnostics().contextState, "uninitialized");
  audio.init();
  assert.equal(audio.beginRun(makeAudioWorld()), true);
  assert.equal(audio.getDiagnostics().resonantBodies, 1);

  audio.updateWorld(makeAudioWorld({ stageKey: "crystalline-choir", stageIndex: 1 }));
  assert.equal(audio.getDiagnostics().resonantBodies, 2);
  context.advance(1.3);
  assert.equal(audio.getDiagnostics().resonantBodies, 1);

  for (let index = 0; index < 8; index += 1) {
    context.advance(0.071);
    audio.playEvent("fire", { x: 640 });
  }
  assert.equal(audio.getDiagnostics().activeVoices, 8);

  for (let index = 0; index < 24; index += 1) {
    context.advance(0.02);
    audio.playEvent("enemy-defeat", { x: index * 20 });
  }
  assert.equal(audio.getDiagnostics().activeVoices, 48);
  context.advance(0.1);
  assert.equal(audio.playEvent("player-hit", { pan: 99 }), true);
  assert.equal(audio.getDiagnostics().activeVoices, 48);

  const deathAt = context.currentTime;
  assert.equal(audio.endRun("death"), true);
  assert.equal(audio.endRun("death"), false);
  assert.equal(audio.getDiagnostics().mode, "ending-death");
  assert.equal(audio.getDiagnostics().endingVoices > 0, true);
  const futureHold = context.nodes.some((node) =>
    Object.values(node).some(
      (value) =>
        value?.automation?.some(
          ({ method, at }) => method === "hold" && at > deathAt
        )
    )
  );
  assert.equal(futureHold, false, "Ending automation must never hold parameters at future times.");
  audio.resetRun();
  audio.resetRun();
  assert.equal(audio.getDiagnostics().mode, "idle");
  context.advance(0.06);
  assert.equal(audio.getDiagnostics().retiredGraphs, 0);

  assert.equal(audio.beginRun(makeAudioWorld({ stageKey: "abyssal-cathedral" })), true);
  assert.equal(audio.endRun("victory"), true);
  assert.equal(audio.endRun("victory"), false);
  assert.equal(audio.getDiagnostics().mode, "ending-victory");
  await audio.dispose();
  await audio.dispose();
  assert.equal(context.closeCalls, 1);
  assert.equal(audio.getDiagnostics().mode, "disposed");
});

test("optional worklet reports enhanced mode and crosses into fallback on processor failure", async () => {
  const previousConstructor = globalThis.AudioWorkletNode;
  let latestNode = null;
  class RecordingWorkletNode {
    constructor() {
      this.node = createAudioNode();
      this.parameters = new Map([
        ["capture", createAudioParam(0)],
        ["memory", createAudioParam(0)],
        ["activity", createAudioParam(0)],
        ["descent", createAudioParam(0)],
      ]);
      this.port = { messages: [], postMessage: (message) => this.port.messages.push(message) };
      this.onprocessorerror = null;
      latestNode = this;
    }

    connect(target) {
      return this.node.connect(target);
    }

    disconnect(target) {
      return this.node.disconnect(target);
    }
  }

  globalThis.AudioWorkletNode = RecordingWorkletNode;
  try {
    const modules = [];
    const context = new RecordingAudioContext({
      worklet: {
        addModule(url) {
          modules.push(String(url));
          return Promise.resolve();
        },
      },
    });
    const audio = createAudioEngine({ contextFactory: () => context });
    audio.init();
    assert.equal(audio.getDiagnostics().workletStatus, "loading");
    audio.beginRun(makeAudioWorld());
    assert.equal(await audio.ready, true);
    assert.equal(audio.getDiagnostics().workletStatus, "enhanced");
    assert.match(modules[0], /resonantMemoryProcessor\.js$/);
    assert.equal(latestNode.port.messages.some(({ type }) => type === "seed"), true);

    latestNode.onprocessorerror();
    assert.equal(audio.getDiagnostics().workletStatus, "fallback");
    assert.equal(audio.getDiagnostics().workletFailure, "processorerror");
    await audio.dispose();
  } finally {
    globalThis.AudioWorkletNode = previousConstructor;
  }
});

test("optional worklet load failure preserves the complete native engine", async () => {
  const previousConstructor = globalThis.AudioWorkletNode;
  globalThis.AudioWorkletNode = class {};
  try {
    const context = new RecordingAudioContext({
      worklet: {
        addModule() {
          return Promise.reject(new Error("deliberate module failure"));
        },
      },
    });
    const audio = createAudioEngine({ contextFactory: () => context });
    audio.init();
    audio.beginRun(makeAudioWorld());
    assert.equal(await audio.ready, false);
    const diagnostics = audio.getDiagnostics();
    assert.equal(diagnostics.workletStatus, "fallback");
    assert.match(diagnostics.workletFailure, /deliberate module failure/);
    assert.equal(diagnostics.resonantBodies, 1);
    assert.equal(audio.playEvent("fire"), true);
    await audio.dispose();
  } finally {
    globalThis.AudioWorkletNode = previousConstructor;
  }
});
