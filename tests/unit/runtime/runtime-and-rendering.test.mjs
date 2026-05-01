import test from "node:test";
import assert from "node:assert/strict";

import { createAudioEngine } from "../../../src/audio/audioEngine.js";
import {
  sfxBossDefeat,
  sfxBossPhase,
  sfxBurst,
  sfxChain,
  sfxEnemyPop,
  sfxGraze,
  sfxPickup,
  sfxPlayerHit,
  sfxShoot,
  sfxStart,
  sfxWeakpoint,
} from "../../../src/audio/sfx.js";
import { createInputSystem } from "../../../src/systems/inputSystem.js";
import { createRuntimeController } from "../../../src/core/runtimeController.js";
import { createInterfaceController } from "../../../src/ui/interfaceController.js";
import { createGameState } from "../../../src/state/gameState.js";
import { createPlayerState } from "../../../src/state/playerState.js";
import { getShowcaseConfig, createShowcaseScene, updateShowcaseScene } from "../../../src/debug/showcase.js";
import { createBackgroundRenderer } from "../../../src/rendering/glBackground.js";
import { createCanvasRenderer } from "../../../src/rendering/canvasRenderer.js";
import { drawGlowCircle } from "../../../src/rendering/drawHelpers.js";
import { drawBossUI, drawBossWeakpoint, drawPlayerUI } from "../../../src/rendering/hudRenderer.js";
import { drawBossByKey, listBossRendererKeys } from "../../../src/rendering/bossRenderers.js";
import { drawEnemy, listEnemyRendererKeys } from "../../../src/rendering/enemyRenderers.js";
import { createBossInstance } from "../../../src/data/bosses.js";
import { spawnEnemy } from "../../../src/systems/enemySystem.js";
import { buildEntityBuckets } from "../../../src/entities/entityBuckets.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { makeAudioSpy, makeBossContext, makeState } from "../../helpers/fixtures.mjs";
import {
  createFakeWebGLContext,
  createRecording2dContext,
  getListenerCount,
  withDomFixture,
} from "../../helpers/runtimeFixture.mjs";

test("audio engine initializes under a fake AudioContext and sfx helpers call the expected surfaces", async () => {
  await withDomFixture("", () => {
    const engine = createAudioEngine();
    engine.init();
    assert.equal(Boolean(engine.engine.ctx), true);
    assert.equal(Boolean(engine.engine.musicLayers), true);

    engine.engine.ctx.state = "suspended";
    engine.resume();
    assert.equal(engine.engine.ctx.resumeCalls, 1);

    const { state, player } = makeState();
    state.started = true;
    engine.updateMusic(state, player);
    assert.equal(engine.engine.music.gain.value > 0, true);

    const audio = makeAudioSpy();
    sfxShoot(audio);
    sfxGraze(audio);
    sfxEnemyPop(audio);
    sfxChain(audio);
    sfxPlayerHit(audio);
    sfxBurst(audio);
    sfxBossPhase(audio);
    sfxWeakpoint(audio);
    sfxBossDefeat(audio);
    sfxPickup(audio, "weapon");
    sfxStart(audio);
    assert.equal(audio.noises.length > 0, true);
    assert.equal(audio.tones.length > 0, true);
    assert.equal(audio.chords.length > 0, true);
  });
});

test("input system attaches listeners, toggles pointer mode, and clears held input on blur and hide", async () => {
  await withDomFixture("", (fixture) => {
    const { state } = makeState();
    const input = createInputSystem(state, fixture.elements.game);
    input.attach();

    fixture.document.dispatchEvent({ type: "keydown", code: "KeyM", preventDefault() {} });
    assert.equal(state.input.pointerEnabled, false);
    fixture.document.dispatchEvent({ type: "keydown", code: "KeyZ", preventDefault() {} });
    fixture.document.dispatchEvent({ type: "keydown", code: "KeyA", preventDefault() {} });
    fixture.elements.game.dispatchEvent({ type: "pointerdown", clientX: 30, clientY: 40 });
    fixture.window.dispatchEvent({ type: "blur" });
    assert.equal(state.input.KeyZ, false);
    assert.equal(state.input.KeyA, false);
    assert.equal(state.input.PointerFire, false);
    assert.equal(state.input.pointerEnabled, false, "Input resets should preserve pointer mode preference.");

    fixture.document.dispatchEvent({ type: "keydown", code: "ArrowRight", preventDefault() {} });
    fixture.document.hidden = true;
    fixture.document.visibilityState = "hidden";
    fixture.document.dispatchEvent({ type: "visibilitychange" });
    assert.equal(state.input.ArrowRight, false);

    input.detach();
    assert.equal(getListenerCount(fixture.windowListeners, "blur"), 0);
    assert.equal(getListenerCount(fixture.document.listeners, "keydown"), 0);
  });
});

test("showcase config, interface controller, and rendering helpers expose deterministic runtime surfaces", async () => {
  await withDomFixture("?mode=render&boss=seraph&phase=2", (fixture) => {
    const { state, player } = makeState();
    const showcase = getShowcaseConfig(fixture.window.location.search);
    assert.deepEqual(showcase, {
      type: "boss",
      key: "seraph",
      phase: 2,
      label: "Boss Study: Seraph of Orbits",
    });

    createShowcaseScene(state, player, showcase);
    assert.equal(state.showcase.type, "boss");
    assert.equal(Boolean(state.boss), true);
    updateShowcaseScene(state, 0.5);
    assert.equal(state.boss.phaseTime > 0, true);

    const controller = createInterfaceController(fixture.document);
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
    assert.equal(fixture.elements.interface.dataset.mode, "showcase");
    assert.equal(fixture.elements["boss-panel"].classList.contains("hidden"), false);
    assert.equal(fixture.elements["powerup-feed"].classList.contains("hidden"), false);
    assert.equal(fixture.elements["stage-name"].textContent.length > 0, true);

    state.showcase = null;
    controller.sync(state, player, stageDefinitions);
    assert.equal(fixture.elements.interface.dataset.mode, "combat");
    assert.equal(fixture.elements["boss-panel"].classList.contains("hidden"), true);
    assert.equal(fixture.elements["powerup-feed"].classList.contains("hidden"), true);

    const ctx = createRecording2dContext();
    drawGlowCircle(ctx, 10, 20, 30, "#fff", 0.5);
    drawBossUI(ctx, state.boss, state);
    drawBossWeakpoint(ctx, state.boss, state);
    drawPlayerUI(ctx, player, state, stageDefinitions);
    assert.equal(ctx.calls.some((call) => call.type === "fillText"), true);

    const enemy = spawnEnemy(state, "cherub", { x: 640, y: 200, vx: 0, vy: 0 });
    drawEnemy(ctx, enemy, state);
    drawBossByKey(ctx, state, state.boss);
    assert.equal(listEnemyRendererKeys().includes("cherub"), true);
    assert.equal(listBossRendererKeys().includes("seraph"), true);
  });
});

test("background renderer, canvas renderer, and runtime controller operate under fake contexts without a browser", async () => {
  await withDomFixture("", (fixture) => {
    const { state, player } = makeState();
    const gl = createFakeWebGLContext();
    const bg = createBackgroundRenderer(gl);
    bg.resize(1280, 720, 1);
    bg.render(state, player);
    assert.equal(gl.calls.some((call) => call.type === "drawArrays"), true);

    const ctx = fixture.elements.game.getContext("2d");
    const canvas = createCanvasRenderer(ctx);
    const boss = createBossInstance("seraph", makeBossContext(state, player));
    boss.weakpoint = { x: boss.x, y: boss.y, radius: 10, color: "#fff" };
    state.boss = boss;
    const buckets = buildEntityBuckets(state);
    canvas.render(state, player, stageDefinitions, buckets);
    assert.equal(["high", "medium", "minimal"].includes(state.renderDetail), true);

    const runtimeState = createGameState();
    runtimeState.view.width = 1280;
    runtimeState.view.height = 720;
    const runtimePlayer = createPlayerState(1280, 720);
    const runtimeInput = createInputSystem(runtimeState, fixture.elements.game);
    const audio = makeAudioSpy();
    const interfaceController = { syncCalls: 0, sync() { this.syncCalls += 1; } };
    const backgroundRenderer = { resizeCalls: 0, resize() { this.resizeCalls += 1; } };

    const runtime = createRuntimeController({
      state: runtimeState,
      player: runtimePlayer,
      audio,
      inputSystem: runtimeInput,
      interfaceController,
      stages: stageDefinitions,
      showcaseConfig: null,
      bgCanvas: fixture.elements.bg,
      gameCanvas: fixture.elements.game,
      backgroundRenderer,
      startScreen: fixture.elements["start-screen"],
      startButton: fixture.elements["start-button"],
      endScreen: fixture.elements["end-screen"],
      restartButton: fixture.elements["restart-button"],
      windowObject: fixture.window,
      documentObject: fixture.document,
      onGameStart() {},
    });

    runtime.init();
    assert.equal(interfaceController.syncCalls > 0, true);
    assert.equal(backgroundRenderer.resizeCalls > 0, true);
    runtime.startGame();
    assert.equal(runtimeState.started, true);
    runtime.resetGame(true);
    assert.equal(runtimeState.started, true);
    runtime.dispose();
    assert.equal(getListenerCount(fixture.windowListeners, "resize"), 0);
  });
});
