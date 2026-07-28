import test from "node:test";
import assert from "node:assert/strict";

import { createRuntimeController } from "../../../src/core/runtimeController.js";
import { createShowcaseScene, getShowcaseConfig, updateShowcaseScene } from "../../../src/debug/showcase.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { createGameState } from "../../../src/state/gameState.js";
import { createPlayerState } from "../../../src/state/playerState.js";
import { createInterfaceController } from "../../../src/ui/interfaceController.js";
import { makeAudioSpy } from "../../helpers/fixtures.mjs";
import {
  createElementRecorder,
  createEventTargetRecorder,
  createInterfaceProjectionFixture,
} from "../../helpers/runtimeFixture.mjs";

function createRuntimeScenario(width = 1280, height = 720, dpr = 1, showcaseConfig = null) {
  const state = createGameState();
  const player = createPlayerState(width, height);
  const audio = makeAudioSpy();
  const inputSystem = {
    attach() {},
    detach() {},
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
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: dpr,
  });
  const documentTarget = createEventTargetRecorder();
  const canvases = {
    background: { width: 0, height: 0 },
    game: { width: 0, height: 0 },
  };
  const overlays = {
    start: createElementRecorder(),
    startButton: createElementRecorder(),
    end: createElementRecorder(),
    restartButton: createElementRecorder(),
  };
  let renderInvalidations = 0;
  const runtime = createRuntimeController({
    state,
    player,
    audio,
    inputSystem,
    interfaceController,
    stages: stageDefinitions,
    showcaseConfig,
    bgCanvas: canvases.background,
    gameCanvas: canvases.game,
    backgroundRenderer,
    startScreen: overlays.start,
    startButton: overlays.startButton,
    endScreen: overlays.end,
    restartButton: overlays.restartButton,
    windowObject: windowTarget,
    documentObject: documentTarget,
    onRenderInvalidated() {
      renderInvalidations += 1;
    },
  });

  return {
    state,
    player,
    audio,
    interfaceController,
    backgroundRenderer,
    windowTarget,
    canvases,
    overlays,
    runtime,
    get renderInvalidations() {
      return renderInvalidations;
    },
  };
}

test("runtime resize calculations stay deterministic across viewport modes", () => {
  const scenario = createRuntimeScenario(1280, 720, 2);
  scenario.runtime.init();

  assert.equal(scenario.state.playfield.active, true);
  assert.equal(scenario.state.playfield.leftBayWidth, 0);
  assert.equal(scenario.state.playfield.rightBayWidth, 0);
  assert.equal(scenario.state.playfield.minX <= 80, true);
  assert.equal(scenario.state.playfield.maxX >= 1200, true);
  assert.equal(scenario.state.view.dpr, 2);
  assert.deepEqual(scenario.canvases.background, { width: 1920, height: 1080 });
  assert.deepEqual(scenario.canvases.game, { width: 2560, height: 1440 });
  assert.deepEqual(scenario.backgroundRenderer.resizeCalls[0], [1280, 720, 1.5]);
  assert.equal(scenario.renderInvalidations, 1);

  scenario.windowTarget.innerWidth = 900;
  scenario.windowTarget.innerHeight = 720;
  scenario.windowTarget.devicePixelRatio = 1;
  scenario.runtime.resize();

  assert.equal(scenario.state.playfield.active, false);
  assert.equal(scenario.state.playfield.leftBayWidth, 0);
  assert.equal(scenario.state.playfield.rightBayWidth, 0);
  assert.deepEqual(scenario.backgroundRenderer.resizeCalls.at(-1), [900, 720, 1]);
  assert.deepEqual(scenario.canvases.game, { width: 900, height: 720 });
  assert.equal(scenario.renderInvalidations, 2);
});

test("runtime resize falls back to DPR 1 for invalid device scale values", () => {
  for (const invalidDpr of [Infinity, -1, 0, Number.NaN]) {
    const scenario = createRuntimeScenario(640, 480, invalidDpr);
    scenario.runtime.init();

    assert.equal(scenario.state.view.dpr, 1);
    assert.deepEqual(scenario.canvases.background, { width: 640, height: 480 });
    assert.deepEqual(scenario.canvases.game, { width: 640, height: 480 });
    assert.deepEqual(scenario.backgroundRenderer.resizeCalls, [[640, 480, 1]]);

    scenario.runtime.dispose();
  }
});

test("active-run resize clamps player and pointer to calculated bounds", () => {
  const scenario = createRuntimeScenario();
  scenario.runtime.init();
  scenario.runtime.startGame();
  scenario.state.boss = {};
  scenario.player.x = 1200;
  scenario.player.y = 700;
  scenario.state.input.pointerX = 1200;
  scenario.state.input.pointerY = 700;

  scenario.windowTarget.innerWidth = 520;
  scenario.windowTarget.innerHeight = 900;
  scenario.runtime.resize();

  assert.equal(scenario.player.x <= scenario.state.playfield.maxX, true);
  assert.equal(scenario.player.y <= scenario.state.playfield.maxY, true);
  assert.equal(scenario.state.input.pointerX <= scenario.state.playfield.maxX, true);
  assert.equal(scenario.state.input.pointerY <= scenario.state.playfield.maxY, true);
  assert.equal(scenario.player.x >= scenario.state.playfield.minX, true);
  assert.equal(scenario.player.y >= scenario.state.playfield.minY, true);
});

test("fresh-run reset restores gameplay state while keeping an auto-started run active", () => {
  const scenario = createRuntimeScenario();
  scenario.runtime.init();
  scenario.runtime.startGame();
  scenario.state.over = true;
  scenario.state.finalRunTime = 61;
  scenario.state.score = 9000;
  scenario.player.hp = 0;

  scenario.runtime.resetGame(true);

  assert.equal(scenario.state.started, true);
  assert.equal(scenario.state.over, false);
  assert.equal(scenario.state.finalRunTime, null);
  assert.equal(scenario.state.score, 0);
  assert.equal(scenario.player.hp, 5);
  assert.equal(scenario.audio.resetCalls, 1);
  assert.equal(scenario.audio.beginCalls, 2);
  assert.equal(scenario.interfaceController.syncCalls, 2);
  assert.equal(scenario.renderInvalidations, 4);
});

test("showcase activation invalidates after resize and scene construction", () => {
  const showcase = getShowcaseConfig("?mode=render&enemy=cherub");
  const scenario = createRuntimeScenario(1280, 720, 1, showcase);

  scenario.runtime.init();

  assert.equal(scenario.state.showcase, showcase);
  assert.equal(scenario.state.entities.length, 1);
  assert.equal(scenario.renderInvalidations, 2);
});

test("interface projection uses the latched final runtime after simulation time changes", () => {
  const projection = createInterfaceProjectionFixture();
  const controller = createInterfaceController(projection.document);
  const state = createGameState();
  const player = createPlayerState(1280, 720);
  state.started = true;
  state.over = true;
  state.time = 61;
  state.finalRunTime = 61;

  controller.sync(state, player, stageDefinitions);
  assert.equal(projection.elements["run-time"].textContent, "01:01");
  assert.equal(projection.elements["end-time"].textContent, "01:01");

  state.time = 5_061;
  controller.sync(state, player, stageDefinitions);
  assert.equal(projection.elements["run-time"].textContent, "01:01");
  assert.equal(projection.elements["end-time"].textContent, "01:01");
});

test("showcase scenes bootstrap and evolve enemy and boss studies deterministically", () => {
  const enemyConfig = getShowcaseConfig("?mode=render&enemy=cherub");
  assert.deepEqual(enemyConfig, {
    type: "enemy",
    key: "cherub",
    label: "Enemy Study: Nebula Cherub",
  });

  const enemyState = createGameState();
  enemyState.view.width = 1280;
  enemyState.view.height = 720;
  const enemyPlayer = createPlayerState(1280, 720);
  createShowcaseScene(enemyState, enemyPlayer, enemyConfig);
  assert.equal(enemyState.entities.length, 1);
  updateShowcaseScene(enemyState, 0.5);
  assert.equal(enemyState.entities[0].components.ai.t > 0, true);

  const bossConfig = getShowcaseConfig("?mode=render&boss=seraph&phase=2");
  const bossState = createGameState();
  bossState.view.width = 1280;
  bossState.view.height = 720;
  const bossPlayer = createPlayerState(1280, 720);
  createShowcaseScene(bossState, bossPlayer, bossConfig);
  assert.equal(bossState.boss.key, "seraph");
  assert.equal(bossState.boss.phaseIndex, 1);
  updateShowcaseScene(bossState, 0.5);
  assert.equal(bossState.boss.phaseTime > 0, true);
});
