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
  state.stageTime = stageDefinitions[1].duration / 2;
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
    phaseHp: 40,
    phases: [{ hp: 120 }, { hp: 100 }, { hp: 80 }],
    hp: 100,
    maxHp: 600,
  };

  const world = projectAudioWorld(state, player, stageDefinitions);
  assert.equal(Object.isFrozen(world), true);
  assert.equal(world.stageKey, "crystalline-choir");
  assert.equal(world.stageProgress, 0.5);
  assert.equal(world.loopIndex, 1);
  assert.equal(world.hull, 3);
  assert.equal(world.chainRatio, 0.5);
  assert.equal(world.grazeRatio, 0.5);
  assert.equal(world.densityRatio, 1);
  assert.equal(world.bossKey, "prism");
  assert.equal(world.bossPhaseIndex, 2);
  assert.equal(world.bossPhaseProgress, 0.5);
  assert.equal(world.bossProgress > 0.8, true);
  assert.equal("state" in world || "player" in world, false);
  assert.equal(panForWorldX(world, -10_000), -1);
  assert.equal(panForWorldX(world, 10_000), 1);

  state.stageTime = Number.POSITIVE_INFINITY;
  state.boss.phaseHp = Number.NaN;
  const invalidProgressWorld = projectAudioWorld(state, player, stageDefinitions);
  assert.equal(invalidProgressWorld.stageProgress, 0);
  assert.equal(invalidProgressWorld.bossPhaseProgress, 0);

  state.stageTime = stageDefinitions[1].duration * 2;
  state.boss.phaseHp = -10;
  const clampedProgressWorld = projectAudioWorld(state, player, stageDefinitions);
  assert.equal(clampedProgressWorld.stageProgress, 1);
  assert.equal(clampedProgressWorld.bossPhaseProgress, 1);
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

test("score transport schedules the authored processions, skips late steps, and cleans section changes", async () => {
  const context = new RecordingAudioContext();
  const audio = createAudioEngine({
    contextFactory: () => context,
    enableWorklet: false,
    seed: 0x51a7e,
  });
  audio.init();
  audio.beginRun(makeAudioWorld());

  assert.deepEqual(
    {
      key: audio.getDiagnostics().scoreSectionKey,
      bpm: audio.getDiagnostics().scoreBpm,
      meter: audio.getDiagnostics().scoreMeter,
      tier: audio.getDiagnostics().scoreArrangementTier,
    },
    { key: "nebula-gate", bpm: 96, meter: "6/8", tier: 0 }
  );
  context.advance(0.2);
  audio.updateWorld(makeAudioWorld({ time: 0.2 }));
  assert.equal(audio.getDiagnostics().activePercussionVoices > 0, true);
  assert.equal(audio.getDiagnostics().activePercussionVoices <= 12, true);

  context.advance(5);
  audio.updateWorld(makeAudioWorld({ time: 5.2, stageProgress: 0.8, densityRatio: 1 }));
  assert.equal(audio.getDiagnostics().skippedLateScoreSteps > 0, true);
  assert.equal(audio.getDiagnostics().activePercussionVoices <= 12, true);

  assert.equal(audio.setDebugScore({ soloBus: "harmony", arrangementTier: 2 }), true);
  assert.equal(audio.getDiagnostics().scoreArrangementTier, 0);
  assert.equal(
    audio.setDebugScore({ soloBus: "not-a-bus", arrangementTier: 2 }),
    false
  );
  assert.equal(audio.setDebugScore({ restartPhrase: true, arrangementTier: 2 }), true);
  assert.equal(audio.getDiagnostics().scoreArrangementTier, 2);
  audio.clearDebugScore();

  audio.updateWorld(makeAudioWorld({
    time: 5.3,
    bossKey: "seraph",
    bossPhaseIndex: 0,
    bossPhaseProgress: 0.2,
  }));
  assert.equal(audio.getDiagnostics().scoreSectionKey, "seraph");
  assert.equal(audio.getDiagnostics().scoreBpm, 138);
  assert.equal(audio.getDiagnostics().scoreMeter, "4/4");
  assert.equal(audio.getDiagnostics().scorePhaseKey, "crown-spiral");
  context.advance(0.25);
  audio.updateWorld(makeAudioWorld({
    time: 5.55,
    bossKey: "seraph",
    bossPhaseIndex: 1,
    bossPhaseProgress: 0,
  }));
  assert.equal(audio.getDiagnostics().scorePhaseKey, "halo-bloom");
  assert.equal(audio.getDiagnostics().nodeCount > 0, true);

  assert.equal(audio.endRun("death"), true);
  assert.equal(audio.getDiagnostics().activePercussionVoices, 0);
  audio.resetRun();
  context.advance(0.06);
  assert.equal(audio.getDiagnostics().retiredGraphs, 0);
  await audio.dispose();
});

test("persistent pitched voices follow authored chord paths while modulation remains timbral", () => {
  const context = new RecordingAudioContext();
  const audio = createAudioEngine({
    contextFactory: () => context,
    enableWorklet: false,
    seed: 23,
  });
  audio.init();
  audio.beginRun(makeAudioWorld());

  const accompaniment = context.oscillators.slice(0, 4);
  const modulation = context.oscillators[4];
  assert.equal(accompaniment.length, 4);
  assert.deepEqual(
    accompaniment.map(({ frequency }) => frequency.value),
    [-12, 7, 15, 26].map(
      (semitones) => 164.81 * 2 ** (semitones / 12)
    )
  );
  assert.equal(modulation.frequency.value, 19);
  const modulationDepth = [...modulation.connections][0];
  assert.equal(
    accompaniment.every(({ frequency }) => !modulationDepth.connections.has(frequency)),
    true
  );

  context.advance(0.2);
  audio.updateWorld(makeAudioWorld({ time: 0.2 }));
  for (const [index, expected] of [-12, 7, 15, 26]
    .map((semitones) => 164.81 * 2 ** (semitones / 12))
    .entries()) {
    assert.equal(
      accompaniment[index].frequency.automation.some(
        ({ method, value, at }) =>
          method === "target" &&
          Math.abs(value - expected) < 0.000001 &&
          Math.abs(at - 0.35) < 0.000001
      ),
      true
    );
  }

  audio.dispose();
});

test("score controls reschedule an unsounded boundary and boss identity begins on the next primary beat", async () => {
  const context = new RecordingAudioContext();
  const audio = createAudioEngine({
    contextFactory: () => context,
    enableWorklet: false,
    seed: 17,
  });
  audio.init();
  audio.beginRun(makeAudioWorld());
  assert.equal(audio.getDiagnostics().scoreStartAt, 0.35);

  context.advance(2);
  audio.updateWorld(makeAudioWorld({ time: 2, stageProgress: 0.2 }));
  assert.equal(audio.getDiagnostics().scoreArrangementTier, 0);

  context.advance(0.1);
  audio.updateWorld(makeAudioWorld({
    time: 2.1,
    stageProgress: 0.8,
    chainRatio: 1,
    densityRatio: 1,
  }));
  assert.equal(audio.getDiagnostics().scoreArrangementTier, 2);

  audio.updateWorld(makeAudioWorld({
    time: 2.1,
    stageProgress: 1,
    bossKey: "seraph",
    bossPhaseIndex: 0,
  }));
  assert.equal(audio.getDiagnostics().scoreSectionKey, "seraph");
  assert.equal(Math.abs(audio.getDiagnostics().scoreStartAt - 2.225) < 1e-9, true);
  await audio.dispose();
});

test("ending before the first downbeat cancels every future chord fade-in", async () => {
  const context = new RecordingAudioContext();
  const audio = createAudioEngine({
    contextFactory: () => context,
    enableWorklet: false,
    seed: 23,
  });
  audio.init();
  audio.beginRun(makeAudioWorld());
  context.advance(0.1);
  assert.equal(audio.endRun("death"), true);

  const futureChordFade = context.nodes.some((node) =>
    node.gain?.automation?.some(
      ({ method, value, at }) =>
        method === "linear" && value === 1 && at > context.currentTime
    )
  );
  assert.equal(
    futureChordFade,
    false,
    "No lookahead-scheduled harmony bank may fade in after an ending starts."
  );
  await audio.dispose();
});

test("percussion event times are identical across 30, 60, and 120 Hz world updates", async () => {
  async function collect(updateRate) {
    const context = new RecordingAudioContext();
    const audio = createAudioEngine({
      contextFactory: () => context,
      enableWorklet: false,
      seed: 31,
    });
    audio.init();
    audio.beginRun(makeAudioWorld());
    const frameCount = updateRate * 4;
    for (let frame = 1; frame <= frameCount; frame += 1) {
      const time = frame / updateRate;
      context.advance(1 / updateRate);
      audio.updateWorld(makeAudioWorld({
        time,
        stageProgress: time / 26,
        densityRatio: 0.4,
      }));
    }
    const round = (value) => Number(value.toFixed(6));
    const percussion = context.sources
      .flatMap(({ startCalls }) => startCalls.map(([at]) => at))
      .filter((at) => at >= 0.3)
      .map(round);
    await audio.dispose();
    return percussion;
  }

  const at30 = await collect(30);
  const at60 = await collect(60);
  const at120 = await collect(120);
  assert.deepEqual(at30, at60);
  assert.deepEqual(at60, at120);
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
