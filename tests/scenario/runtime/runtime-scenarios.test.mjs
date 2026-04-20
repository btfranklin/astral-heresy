import test from "node:test";
import assert from "node:assert/strict";

import { createGame } from "../../../src/core/game.js";
import { createShowcaseScene, getShowcaseConfig, updateShowcaseScene } from "../../../src/debug/showcase.js";
import { createGameState } from "../../../src/state/gameState.js";
import { createPlayerState } from "../../../src/state/playerState.js";
import { createInterfaceController } from "../../../src/ui/interfaceController.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { getListenerCount, withDomFixture } from "../../helpers/runtimeFixture.mjs";

test("game start, burst, blur reset, restart, and dispose flow stay deterministic", async () => {
  await withDomFixture("", (fixture) => {
    const game = createGame({
      bgCanvas: fixture.elements.bg,
      gameCanvas: fixture.elements.game,
      startScreen: fixture.elements["start-screen"],
      startButton: fixture.elements["start-button"],
      endScreen: fixture.elements["end-screen"],
      restartButton: fixture.elements["restart-button"],
      documentRoot: fixture.document,
    });

    assert(game);
    game.init();
    assert.equal(fixture.elements["status-copy"].textContent, "Awaiting launch clearance");
    assert.equal(fixture.elements["stage-label"].textContent, "Act 1");
    assert.equal(fixture.elements["stage-name"].textContent, "Nebula Gate");
    assert.equal(fixture.elements["chain-value"].textContent, "x1.00");
    assert.equal(fixture.elements["loop-value"].textContent, "I");
    assert.equal(fixture.elements["weapon-value"].textContent, "Standard");
    assert.equal(fixture.elements["burst-chip"].textContent, "Burst 1/2");
    assert.equal(game.state.playfield.active, true);
    assert.equal(fixture.pendingAnimationFrames(), 1);

    fixture.elements["start-button"].click();
    assert.equal(game.state.started, true);
    assert.equal(typeof game.advanceTime, "function");
    assert.equal(typeof game.renderGameToText, "function");

    fixture.document.dispatchEvent({ type: "keydown", code: "KeyX", preventDefault() {} });
    fixture.runNextAnimationFrame(33);
    fixture.document.dispatchEvent({ type: "keyup", code: "KeyX", preventDefault() {} });
    assert.equal(game.state.feedback.burst > 0, true);
    assert.equal(game.state.burstStocks, 0);
    assert.equal(game.renderGameToText().includes("\"grazeCharge\""), true);
    assert.equal(game.renderGameToText().includes("\"playfield\""), true);
    assert.equal(game.renderGameToText().includes("\"density\""), true);

    fixture.document.dispatchEvent({ type: "keydown", code: "KeyZ", preventDefault() {} });
    fixture.document.dispatchEvent({ type: "keydown", code: "KeyA", preventDefault() {} });
    fixture.elements.game.dispatchEvent({ type: "pointerdown", clientX: 180, clientY: 320 });
    fixture.window.dispatchEvent({ type: "blur" });
    assert.equal(game.state.input.KeyZ, false);
    assert.equal(game.state.input.KeyA, false);
    assert.equal(game.state.input.PointerFire, false);

    fixture.document.dispatchEvent({ type: "keydown", code: "ArrowLeft", preventDefault() {} });
    fixture.document.hidden = true;
    fixture.document.visibilityState = "hidden";
    fixture.document.dispatchEvent({ type: "visibilitychange" });
    assert.equal(game.state.input.ArrowLeft, false);
    fixture.document.hidden = false;
    fixture.document.visibilityState = "visible";

    game.state.over = true;
    game.player.hp = 0;
    fixture.document.dispatchEvent({
      type: "keydown",
      code: "KeyR",
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    });
    assert.equal(game.state.over, false);
    assert.equal(game.state.started, true);
    assert.equal(game.player.hp, 5);

    const startedBeforeDispose = game.state.started;
    game.dispose();
    game.dispose();
    game.resetGame(false);
    assert.equal(game.state.started, startedBeforeDispose);
    assert.equal(fixture.pendingAnimationFrames(), 0);
    assert.equal(getListenerCount(fixture.document.listeners, "keydown"), 0);
    assert.equal(getListenerCount(fixture.document.listeners, "keyup"), 0);
    assert.equal(getListenerCount(fixture.document.listeners, "visibilitychange"), 0);
    assert.equal(getListenerCount(fixture.windowListeners, "resize"), 0);
    assert.equal(getListenerCount(fixture.windowListeners, "pointerup"), 0);
    assert.equal(getListenerCount(fixture.windowListeners, "pointercancel"), 0);
    assert.equal(getListenerCount(fixture.windowListeners, "blur"), 0);
  });
});

test("runtime geometry, HUD sync, and render-study parsing stay stable across viewport modes", async () => {
  await withDomFixture("", (fixture) => {
    const game = createGame({
      bgCanvas: fixture.elements.bg,
      gameCanvas: fixture.elements.game,
      startScreen: fixture.elements["start-screen"],
      startButton: fixture.elements["start-button"],
      endScreen: fixture.elements["end-screen"],
      restartButton: fixture.elements["restart-button"],
      documentRoot: fixture.document,
    });
    game.init();
    assert.equal(game.state.playfield.active, true);
    assert.equal(game.player.x >= game.state.playfield.minX && game.player.x <= game.state.playfield.maxX, true);

    fixture.window.innerWidth = 900;
    fixture.window.innerHeight = 720;
    fixture.window.dispatchEvent({ type: "resize" });
    assert.equal(game.state.playfield.active, false);
    assert.equal(game.state.playfield.leftBayWidth, 0);
    assert.equal(game.state.playfield.rightBayWidth, 0);

    const controller = createInterfaceController(fixture.document);
    controller.sync(game.state, game.player, stageDefinitions);
    assert.equal(fixture.elements["status-copy"].textContent.length > 0, true);
  });
});

test("displayed runtime freezes at the loss moment even if simulation frames continue", async () => {
  await withDomFixture("", (fixture) => {
    const game = createGame({
      bgCanvas: fixture.elements.bg,
      gameCanvas: fixture.elements.game,
      startScreen: fixture.elements["start-screen"],
      startButton: fixture.elements["start-button"],
      endScreen: fixture.elements["end-screen"],
      restartButton: fixture.elements["restart-button"],
      documentRoot: fixture.document,
    });

    game.init();
    fixture.elements["start-button"].click();

    game.state.time = 61;
    game.player.hp = 1;
    game.player.invuln = 0;
    game.debugSpawnEnemyBullet(game.player.x, game.player.y, 0, 0, { life: 1 });
    game.advanceTime(16);

    const frozenRunTime = game.state.finalRunTime;
    const frozenDisplay = "01:01";
    assert.notEqual(frozenRunTime, null);
    assert.equal(fixture.elements["run-time"].textContent, frozenDisplay);
    assert.equal(fixture.elements["end-time"].textContent, frozenDisplay);

    game.advanceTime(5_000);

    assert.equal(game.state.finalRunTime, frozenRunTime);
    assert.equal(game.state.time, frozenRunTime);
    assert.equal(fixture.elements["run-time"].textContent, frozenDisplay);
    assert.equal(fixture.elements["end-time"].textContent, frozenDisplay);
  });
});

test("showcase scene bootstraps enemy and boss studies without a browser", async () => {
  await withDomFixture("?mode=render&enemy=cherub", (fixture) => {
    const config = getShowcaseConfig(fixture.window.location.search);
    assert.deepEqual(config, {
      type: "enemy",
      key: "cherub",
      label: "Enemy Study: Nebula Cherub",
    });

    const state = createGameState();
    state.view.width = 1280;
    state.view.height = 720;
    const player = createPlayerState(1280, 720);
    createShowcaseScene(state, player, config);
    assert.equal(state.entities.length, 1);
    updateShowcaseScene(state, 0.5);
    assert.equal(state.entities[0].components.ai.t > 0, true);
  });
});
