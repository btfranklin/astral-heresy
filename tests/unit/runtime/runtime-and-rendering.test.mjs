import test from "node:test";
import assert from "node:assert/strict";

import {
  getAudioEventRecipe,
  listAudioEventKinds,
  sfxBossArrival,
  sfxBossDefeat,
  sfxBossPhase,
  sfxBurst,
  sfxChain,
  sfxEnemyPop,
  sfxGraze,
  sfxPickup,
  sfxPlayerDeath,
  sfxPlayerHit,
  sfxShoot,
  sfxStart,
  sfxVictory,
  sfxWeakpoint,
} from "../../../src/audio/sfx.js";
import { createRuntimeController } from "../../../src/core/runtimeController.js";
import { getShowcaseConfig, createShowcaseScene, updateShowcaseScene } from "../../../src/debug/showcase.js";
import { createBossInstance } from "../../../src/data/bosses.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { buildEntityBuckets } from "../../../src/entities/entityBuckets.js";
import { drawBossByKey, listBossRendererKeys } from "../../../src/rendering/bossRenderers.js";
import { createCanvasRenderer } from "../../../src/rendering/canvasRenderer.js";
import { drawGlowCircle } from "../../../src/rendering/drawHelpers.js";
import { drawEnemy, listEnemyRendererKeys } from "../../../src/rendering/enemyRenderers.js";
import { drawBossUI, drawBossWeakpoint, drawPlayerUI } from "../../../src/rendering/hudRenderer.js";
import { createGameState } from "../../../src/state/gameState.js";
import { createPlayerState } from "../../../src/state/playerState.js";
import { createInputSystem } from "../../../src/systems/inputSystem.js";
import { spawnEnemy } from "../../../src/systems/enemySystem.js";
import { createInterfaceController } from "../../../src/ui/interfaceController.js";
import { makeAudioSpy, makeBossContext, makeState } from "../../helpers/fixtures.mjs";
import {
  createElementRecorder,
  createEventTargetRecorder,
  createInterfaceProjectionFixture,
  createRecording2dContext,
  getListenerCount,
  withInputListenerEnvironment,
} from "../../helpers/runtimeFixture.mjs";

test("sfx helpers emit validated semantic cues while recipes preserve their glyph hierarchy", () => {
  const audio = makeAudioSpy();
  sfxShoot(audio);
  sfxGraze(audio);
  sfxEnemyPop(audio);
  sfxChain(audio);
  sfxPlayerHit(audio);
  sfxBurst(audio);
  sfxBossArrival(audio);
  sfxBossPhase(audio);
  sfxWeakpoint(audio);
  sfxBossDefeat(audio);
  sfxPickup(audio, "weapon");
  sfxStart(audio);
  sfxPlayerDeath(audio);
  const secondDeath = sfxPlayerDeath(audio);
  sfxVictory(audio);

  assert.deepEqual(
    audio.events.map(({ kind }) => kind),
    [
      "fire",
      "graze",
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
    ]
  );
  assert.deepEqual(audio.endings.map(({ outcome }) => outcome), ["death", "death", "victory"]);
  assert.equal(secondDeath, true);
  assert.equal(listAudioEventKinds().includes("shield-absorb"), true);
  const fire = getAudioEventRecipe("fire");
  assert.deepEqual(
    fire.voices.map(({ source }) => source),
    ["noise", "tone", "tone"]
  );
  assert.equal(fire.center >= 0.7, true);
  assert.equal(getAudioEventRecipe("not-a-cue"), null);
});

test("input orchestration attaches handlers, updates state, resets held controls, and detaches", async () => {
  await withInputListenerEnvironment(({ windowTarget, documentTarget }) => {
    const { state } = makeState();
    const canvas = createElementRecorder({ rect: { left: 10, top: 20, width: 640, height: 360 } });
    const input = createInputSystem(state, canvas);
    input.attach();

    const toggleEvent = documentTarget.emit("keydown", { code: "KeyM" });
    assert.equal(toggleEvent.defaultPrevented, true);
    assert.equal(state.input.pointerEnabled, false);

    documentTarget.emit("keydown", { code: "KeyM", repeat: true });
    assert.equal(state.input.pointerEnabled, false, "A held key must change the mode only once.");

    documentTarget.emit("keydown", { code: "KeyZ" });
    documentTarget.emit("keydown", { code: "KeyA" });
    canvas.emit("pointerdown", { clientX: 30, clientY: 40 });
    assert.deepEqual(
      { x: state.input.pointerX, y: state.input.pointerY, firing: state.input.PointerFire },
      { x: 20, y: 20, firing: true }
    );

    windowTarget.emit("blur");
    assert.equal(state.input.KeyZ, false);
    assert.equal(state.input.KeyA, false);
    assert.equal(state.input.PointerFire, false);
    assert.equal(state.input.pointerEnabled, false, "Resetting held controls preserves the mode preference.");

    documentTarget.emit("keydown", { code: "ArrowRight" });
    documentTarget.hidden = true;
    documentTarget.visibilityState = "hidden";
    documentTarget.emit("visibilitychange");
    assert.equal(state.input.ArrowRight, false);

    input.detach();
    assert.equal(getListenerCount(windowTarget, "blur"), 0);
    assert.equal(getListenerCount(documentTarget, "keydown"), 0);
    assert.equal(getListenerCount(canvas, "pointerdown"), 0);
  });
});

test("showcase state, interface projection, and canvas drawing intent stay deterministic", () => {
  const projection = createInterfaceProjectionFixture();
  const { state, player } = makeState();
  const showcase = getShowcaseConfig("?mode=render&boss=seraph&phase=2");
  assert.deepEqual(showcase, {
    type: "boss",
    key: "seraph",
    phase: 2,
    label: "Boss Study: Seraph of Orbits",
  });

  createShowcaseScene(state, player, showcase);
  updateShowcaseScene(state, 0.5);
  assert.equal(state.showcase.type, "boss");
  assert.equal(state.boss.phaseTime > 0, true);

  const controller = createInterfaceController(projection.document);
  state.started = true;
  state.boss = createBossInstance("seraph", makeBossContext(state, player));
  state.boss.weakpoint = { x: state.boss.x, y: state.boss.y, radius: 12, color: "#fff" };
  state.powerupNotice = {
    title: "Halo Shield",
    roleTag: "BARRIER READY",
    category: "utility",
    timer: 0.8,
    hudTimer: 1.6,
    ribbonTimer: 0.4,
    color: "#bdfdff",
    sigil: "hex",
    x: player.x,
    y: player.y,
  };
  player.activePowerups.haloShield = 10;
  controller.sync(state, player, stageDefinitions);
  assert.equal(projection.elements.interface.dataset.mode, "showcase");
  assert.equal(projection.elements["boss-panel"].classList.contains("hidden"), false);
  assert.equal(projection.elements["powerup-feed"].classList.contains("hidden"), false);
  assert.equal(projection.elements["stage-name"].textContent, "Boss Study: Seraph of Orbits");

  state.showcase = null;
  state.boss.hp = state.boss.maxHp / 3;
  controller.sync(state, player, stageDefinitions);
  assert.equal(projection.elements.interface.dataset.mode, "combat");
  assert.equal(projection.elements["boss-panel"].classList.contains("hidden"), true);
  assert.equal(projection.elements["powerup-feed"].classList.contains("hidden"), true);
  assert.equal(projection.elements["stage-progress"].style.transform, `scaleX(${1 / 3})`);
  assert.equal(projection.effectChips[0].classList.contains("hidden"), false);
  assert.equal(projection.effectChips[0].textContent, "Shield 10.0s");

  projection.clearWrites();
  controller.sync(state, player, stageDefinitions);
  assert.equal(projection.writes.length, 0, "An unchanged projection should not write to the DOM.");

  const ctx = createRecording2dContext();
  drawGlowCircle(ctx, 10, 20, 30, "#fff", 0.5);
  drawBossUI(ctx, state.boss, state);
  drawBossWeakpoint(ctx, state.boss, state);
  drawPlayerUI(ctx, player, state, stageDefinitions);
  const enemy = spawnEnemy(state, "cherub", { x: 640, y: 200, vx: 0, vy: 0 });
  drawEnemy(ctx, enemy, state);
  drawBossByKey(ctx, state, state.boss);

  assert.equal(ctx.calls.some((call) => call.type === "fillText"), true);
  assert.equal(ctx.calls.some((call) => call.type === "arc"), true);
  assert.equal(listEnemyRendererKeys().includes("cherub"), true);
  assert.equal(listBossRendererKeys().includes("seraph"), true);
});

test("canvas renderer records draw orchestration without claiming Canvas compatibility", () => {
  const { state, player } = makeState();
  const ctx = createRecording2dContext();
  const renderer = createCanvasRenderer(ctx);
  state.boss = createBossInstance("seraph", makeBossContext(state, player));
  state.boss.weakpoint = { x: state.boss.x, y: state.boss.y, radius: 10, color: "#fff" };

  renderer.render(state, player, stageDefinitions, buildEntityBuckets(state));

  assert.equal(state.renderDetail, "high");
  assert.deepEqual(ctx.calls[0], {
    type: "setTransform",
    args: [state.view.dpr, 0, 0, state.view.dpr, 0, 0],
  });
  assert.equal(ctx.calls.some((call) => call.type === "clearRect"), true);
  assert.equal(ctx.calls.some((call) => call.type === "fillText"), true);
});

test("runtime controller orchestrates init, start, reset, resize, and dispose collaborators", () => {
  const state = createGameState();
  const player = createPlayerState(1280, 720);
  const audio = makeAudioSpy();
  const inputSystem = {
    attachCalls: 0,
    detachCalls: 0,
    attach() { this.attachCalls += 1; },
    detach() { this.detachCalls += 1; },
  };
  const interfaceController = {
    syncCalls: 0,
    sync() { this.syncCalls += 1; },
  };
  const backgroundRenderer = {
    resizeCalls: [],
    resize(...args) { this.resizeCalls.push(args); },
  };
  const windowTarget = Object.assign(createEventTargetRecorder(), {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2,
  });
  const documentTarget = createEventTargetRecorder();
  const bgCanvas = { width: 0, height: 0 };
  const gameCanvas = { width: 0, height: 0 };
  const startScreen = createElementRecorder();
  const startButton = createElementRecorder();
  const endScreen = createElementRecorder();
  const restartButton = createElementRecorder();
  let starts = 0;
  let renderInvalidations = 0;

  const runtime = createRuntimeController({
    state,
    player,
    audio,
    inputSystem,
    interfaceController,
    stages: stageDefinitions,
    showcaseConfig: null,
    bgCanvas,
    gameCanvas,
    backgroundRenderer,
    startScreen,
    startButton,
    endScreen,
    restartButton,
    windowObject: windowTarget,
    documentObject: documentTarget,
    onGameStart() { starts += 1; },
    onRenderInvalidated() { renderInvalidations += 1; },
  });

  runtime.init();
  runtime.init();
  assert.equal(inputSystem.attachCalls, 1);
  assert.equal(interfaceController.syncCalls, 1);
  assert.equal(state.view.dpr, 2);
  assert.deepEqual(backgroundRenderer.resizeCalls, [[1280, 720, 1.5]]);
  assert.deepEqual({ width: bgCanvas.width, height: bgCanvas.height }, { width: 1920, height: 1080 });
  assert.deepEqual({ width: gameCanvas.width, height: gameCanvas.height }, { width: 2560, height: 1440 });
  assert.equal(renderInvalidations, 1);

  startButton.emit("click");
  assert.equal(state.started, true);
  assert.equal(audio.initCalls, 1);
  assert.equal(audio.resumeCalls, 1);
  assert.equal(starts, 1);
  assert.equal(renderInvalidations, 2);

  state.over = true;
  player.hp = 1;
  restartButton.emit("click");
  assert.equal(state.over, false);
  assert.equal(player.hp, 5);
  assert.equal(state.started, true);
  assert.equal(renderInvalidations, 4);

  runtime.dispose();
  runtime.dispose();
  assert.equal(inputSystem.detachCalls, 1);
  assert.equal(getListenerCount(windowTarget, "resize"), 0);
  assert.equal(getListenerCount(documentTarget, "keydown"), 0);
  assert.equal(getListenerCount(startButton, "click"), 0);
  assert.equal(getListenerCount(restartButton, "click"), 0);
});
