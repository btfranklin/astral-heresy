#!/usr/bin/env node

import assert from "node:assert/strict";

import { createGame } from "../src/core/game.js";
import { stageDefinitions } from "../src/data/stages.js";
import { createShowcaseScene, getShowcaseConfig, updateShowcaseScene } from "../src/debug/showcase.js";
import { createGameState } from "../src/state/gameState.js";
import { createPlayerState } from "../src/state/playerState.js";
import { createInterfaceController } from "../src/ui/interfaceController.js";

function createValueParam() {
  return {
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  };
}

class FakeAudioContext {
  constructor() {
    this.destination = {};
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = "running";
  }

  createGain() {
    return {
      gain: createValueParam(),
      connect() {},
    };
  }

  createOscillator() {
    return {
      type: "sine",
      frequency: createValueParam(),
      detune: createValueParam(),
      connect() {},
      start() {},
      stop() {},
    };
  }

  createBiquadFilter() {
    return {
      type: "lowpass",
      frequency: createValueParam(),
      Q: createValueParam(),
      connect() {},
    };
  }

  createBuffer(_channels, length) {
    return {
      getChannelData() {
        return new Float32Array(length);
      },
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect() {},
      start() {},
      stop() {},
    };
  }

  resume() {}
}

function createFakeWebGLContext() {
  return {
    COMPILE_STATUS: 1,
    LINK_STATUS: 1,
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    TRIANGLES: 4,
    createShader() {
      return {};
    },
    shaderSource() {},
    compileShader() {},
    getShaderParameter() {
      return true;
    },
    getShaderInfoLog() {
      return "";
    },
    deleteShader() {},
    createProgram() {
      return {};
    },
    attachShader() {},
    linkProgram() {},
    getProgramParameter() {
      return true;
    },
    getProgramInfoLog() {
      return "";
    },
    deleteProgram() {},
    getAttribLocation() {
      return 0;
    },
    getUniformLocation() {
      return {};
    },
    createBuffer() {
      return {};
    },
    bindBuffer() {},
    bufferData() {},
    viewport() {},
    useProgram() {},
    enableVertexAttribArray() {},
    vertexAttribPointer() {},
    uniform2f() {},
    uniform1f() {},
    drawArrays() {},
  };
}

function createFake2dContext() {
  const gradient = { addColorStop() {} };
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "createRadialGradient" || key === "createLinearGradient") {
          return () => gradient;
        }
        return () => {};
      },
      set() {
        return true;
      },
    }
  );
}

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  add(...tokens) {
    for (const token of tokens) this.values.add(token);
  }

  remove(...tokens) {
    for (const token of tokens) this.values.delete(token);
  }

  contains(token) {
    return this.values.has(token);
  }

  toggle(token, force) {
    if (force === undefined) {
      if (this.values.has(token)) {
        this.values.delete(token);
        return false;
      }
      this.values.add(token);
      return true;
    }
    if (force) {
      this.values.add(token);
      return true;
    }
    this.values.delete(token);
    return false;
  }
}

class FakeElement {
  constructor(id = null, classNames = []) {
    this.id = id;
    this.textContent = "";
    this.style = {};
    this.dataset = {};
    this.classList = new FakeClassList(classNames);
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  dispatchEvent(event) {
    event.target = this;
    event.currentTarget = this;
    if (!event.preventDefault) {
      event.preventDefault = () => {
        event.defaultPrevented = true;
      };
    }
    for (const handler of this.listeners.get(event.type) || []) {
      handler(event);
    }
  }

  click() {
    this.dispatchEvent({ type: "click" });
  }
}

class FakeCanvas extends FakeElement {
  constructor(id, contextFactory) {
    super(id);
    this.width = 0;
    this.height = 0;
    this._contextFactory = contextFactory;
  }

  getContext(type) {
    return this._contextFactory(type);
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1280, height: 720 };
  }
}

class FakeDocument {
  constructor(elements, hullPips, burstStockPips, effectChips) {
    this.elements = elements;
    this.hullPips = hullPips;
    this.burstStockPips = burstStockPips;
    this.effectChips = effectChips;
    this.listeners = new Map();
  }

  getElementById(id) {
    return this.elements[id] ?? null;
  }

  querySelectorAll(selector) {
    if (selector === "#hull-pips .hull-pip") {
      return this.hullPips;
    }
    if (selector === "#burst-stocks .stock-pip") {
      return this.burstStockPips;
    }
    if (selector === "#effect-strip .effect-chip") {
      return this.effectChips;
    }
    return [];
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  dispatchEvent(event) {
    if (!event.preventDefault) {
      event.preventDefault = () => {
        event.defaultPrevented = true;
      };
    }
    for (const handler of this.listeners.get(event.type) || []) {
      handler(event);
    }
  }

  createElement(tag) {
    if (tag === "canvas") {
      return new FakeCanvas(null, (type) => (type === "2d" ? createFake2dContext() : null));
    }
    return new FakeElement();
  }
}

function getListenerCount(listenerMap, type) {
  return listenerMap.get(type)?.size ?? 0;
}

function createRuntimeFixture(search = "") {
  const hullPips = Array.from({ length: 5 }, () => new FakeElement(null, ["hull-pip", "is-full"]));
  const burstStockPips = Array.from({ length: 2 }, (_, index) =>
    new FakeElement(null, index === 0 ? ["stock-pip", "is-full"] : ["stock-pip"])
  );
  const effectChips = Array.from({ length: 6 }, () => new FakeElement(null, ["effect-chip", "hidden"]));
  const elements = {
    bg: new FakeCanvas("bg", (type) => (type === "webgl" ? createFakeWebGLContext() : null)),
    game: new FakeCanvas("game", (type) => (type === "2d" ? createFake2dContext() : null)),
    "start-screen": new FakeElement("start-screen"),
    "start-button": new FakeElement("start-button"),
    "end-screen": new FakeElement("end-screen", ["hidden"]),
    "restart-button": new FakeElement("restart-button"),
    interface: new FakeElement("interface"),
    "status-copy": new FakeElement("status-copy"),
    "stage-label": new FakeElement("stage-label"),
    "stage-name": new FakeElement("stage-name"),
    "stage-progress": new FakeElement("stage-progress"),
    "run-time": new FakeElement("run-time"),
    "score-value": new FakeElement("score-value"),
    "kill-value": new FakeElement("kill-value"),
    "accuracy-value": new FakeElement("accuracy-value"),
    "chain-value": new FakeElement("chain-value"),
    "loop-value": new FakeElement("loop-value"),
    "move-chip": new FakeElement("move-chip"),
    "fire-chip": new FakeElement("fire-chip"),
    "focus-chip": new FakeElement("focus-chip"),
    "burst-chip": new FakeElement("burst-chip"),
    "hull-pips": new FakeElement("hull-pips"),
    "graze-progress": new FakeElement("graze-progress"),
    "graze-value": new FakeElement("graze-value"),
    "burst-stocks": new FakeElement("burst-stocks"),
    "weapon-value": new FakeElement("weapon-value"),
    "bonus-banner": new FakeElement("bonus-banner"),
    "powerup-feed": new FakeElement("powerup-feed", ["hidden"]),
    "powerup-notice-category": new FakeElement("powerup-notice-category"),
    "powerup-notice-role": new FakeElement("powerup-notice-role"),
    "powerup-notice-sigil": new FakeElement("powerup-notice-sigil"),
    "powerup-notice-title": new FakeElement("powerup-notice-title"),
    "boss-panel": new FakeElement("boss-panel", ["hidden"]),
    "boss-name": new FakeElement("boss-name"),
    "boss-phase": new FakeElement("boss-phase"),
    "boss-progress": new FakeElement("boss-progress"),
    "end-kicker": new FakeElement("end-kicker"),
    "end-title": new FakeElement("end-title"),
    "end-text": new FakeElement("end-text"),
    "end-score": new FakeElement("end-score"),
    "end-kills": new FakeElement("end-kills"),
    "end-accuracy": new FakeElement("end-accuracy"),
    "end-time": new FakeElement("end-time"),
  };

  const document = new FakeDocument(elements, hullPips, burstStockPips, effectChips);
  const windowListeners = new Map();
  const rafQueue = [];
  let nextFrameId = 1;

  const windowObject = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    location: { search },
    AudioContext: FakeAudioContext,
    webkitAudioContext: null,
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) {
        windowListeners.set(type, new Set());
      }
      windowListeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      windowListeners.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      if (!event.preventDefault) {
        event.preventDefault = () => {
          event.defaultPrevented = true;
        };
      }
      for (const handler of windowListeners.get(event.type) || []) {
        handler(event);
      }
    },
  };

  function requestAnimationFrame(callback) {
    const id = nextFrameId++;
    rafQueue.push({ id, callback, canceled: false });
    return id;
  }

  function cancelAnimationFrame(id) {
    const frame = rafQueue.find((item) => item.id === id);
    if (frame) {
      frame.canceled = true;
    }
  }

  function runNextAnimationFrame(timestamp = 16) {
    while (rafQueue.length > 0) {
      const frame = rafQueue.shift();
      if (!frame.canceled) {
        frame.callback(timestamp);
        return;
      }
    }
  }

  function pendingAnimationFrames() {
    return rafQueue.filter((frame) => !frame.canceled).length;
  }

  return {
    document,
    window: windowObject,
    windowListeners,
    elements,
    hullPips,
    burstStockPips,
    effectChips,
    requestAnimationFrame,
    cancelAnimationFrame,
    runNextAnimationFrame,
    pendingAnimationFrames,
  };
}

function withFixture(search, fn) {
  const fixture = createRuntimeFixture(search);
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    alert: globalThis.alert,
  };

  globalThis.window = fixture.window;
  globalThis.document = fixture.document;
  globalThis.requestAnimationFrame = fixture.requestAnimationFrame;
  globalThis.cancelAnimationFrame = fixture.cancelAnimationFrame;
  globalThis.alert = () => {};

  try {
    fn(fixture);
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    globalThis.cancelAnimationFrame = previous.cancelAnimationFrame;
    globalThis.alert = previous.alert;
  }
}

function makeContentContext() {
  return {
    view: { width: 1280, height: 720, dpr: 1 },
    player: { x: 640, y: 600 },
    spawnEnemyBullet() {},
    spawnEnemy() {},
  };
}

function testGameStartRestartAndDisposeFlow() {
  withFixture("", (fixture) => {
    const game = createGame({
      bgCanvas: fixture.elements.bg,
      gameCanvas: fixture.elements.game,
      startScreen: fixture.elements["start-screen"],
      startButton: fixture.elements["start-button"],
      endScreen: fixture.elements["end-screen"],
      restartButton: fixture.elements["restart-button"],
      documentRoot: fixture.document,
    });

    assert(game, "createGame should succeed with a fake WebGL context.");
    game.init();

    assert.equal(
      fixture.elements["status-copy"].textContent,
      "Awaiting launch clearance",
      "init() should sync the default HUD copy."
    );
    assert.equal(fixture.elements["stage-label"].textContent, "Act 1");
    assert.equal(fixture.elements["stage-name"].textContent, "Nebula Gate");
    assert.equal(fixture.elements["chain-value"].textContent, "x1.00");
    assert.equal(fixture.elements["loop-value"].textContent, "I");
    assert.equal(fixture.elements["weapon-value"].textContent, "Standard");
    assert.equal(fixture.elements["burst-chip"].textContent, "Burst 1/2");
    assert.equal(game.state.playfield.active, true, "Desktop layout should expose an active combat lane.");
    assert.equal(game.state.playfield.leftBayWidth > 0, true, "Desktop layout should reserve left side-bay width.");
    assert.equal(
      fixture.elements["start-screen"].classList.contains("hidden"),
      false,
      "The start screen should be visible before launch."
    );
    assert.equal(fixture.pendingAnimationFrames(), 1, "init() should queue one animation frame.");

    fixture.elements["start-button"].click();
    assert.equal(game.state.started, true, "Clicking launch should start the game.");
    assert.equal(
      fixture.elements["start-screen"].classList.contains("hidden"),
      true,
      "Starting should hide the start screen."
    );
    assert.equal(typeof game.advanceTime, "function", "The runtime should expose deterministic stepping.");
    assert.equal(typeof game.renderGameToText, "function", "The runtime should expose text-state rendering.");

    fixture.document.dispatchEvent({ type: "keydown", code: "KeyX", preventDefault() {} });
    fixture.runNextAnimationFrame(33);
    fixture.document.dispatchEvent({ type: "keyup", code: "KeyX", preventDefault() {} });

    assert.equal(game.state.feedback.burst > 0, true, "KeyX should trigger burst feedback after launch.");
    assert.equal(game.state.burstStocks, 0, "Burst should spend the starting stock.");
    assert.equal(game.renderGameToText().includes("\"grazeCharge\""), true, "Text-state output should include combat economy fields.");
    assert.equal(game.renderGameToText().includes("\"playfield\""), true, "Text-state output should include playfield geometry.");
    assert.equal(game.renderGameToText().includes("\"density\""), true, "Text-state output should include density telemetry.");

    game.state.powerupNotice = {
      title: "Halo Shield",
      roleTag: "BARRIER READY",
      category: "utility",
      timer: 0.8,
      hudTimer: 1.9,
      ribbonTimer: 0.3,
      color: "#bdfdff",
      sigil: "hex",
      x: game.player.x,
      y: game.player.y,
    };
    game.player.activePowerups.haloShield = 10;
    fixture.runNextAnimationFrame(40);
    assert.equal(fixture.elements["powerup-feed"].classList.contains("hidden"), false, "Active pickup notices should appear in the HUD feed.");
    assert.equal(fixture.elements["powerup-notice-title"].textContent, "Halo Shield");
    assert.equal(fixture.effectChips[0].classList.contains("hidden"), false, "Active effects should appear in the timer strip.");

    game.state.loopIndex = 1;
    game.state.loopTimer = 1.5;
    fixture.runNextAnimationFrame(48);
    assert.equal(fixture.elements["stage-label"].textContent.includes("Loop II"), true, "Loop two should be reflected in the HUD.");

    game.state.over = true;
    game.player.hp = 0;
    const restartEvent = {
      type: "keydown",
      code: "KeyR",
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    fixture.document.dispatchEvent(restartEvent);

    assert.equal(restartEvent.defaultPrevented, true, "Restart should prevent the default key action.");
    assert.equal(game.state.over, false, "Restart should clear the game-over state.");
    assert.equal(game.state.started, true, "Restart should relaunch immediately.");
    assert.equal(game.player.hp, 5, "Restart should restore player hp.");
    assert.equal(game.state.loopIndex, 0, "Restart should clear loop state.");

    const startedBeforeDispose = game.state.started;
    game.dispose();
    game.dispose();
    game.resetGame(false);

    assert.equal(game.state.started, startedBeforeDispose, "dispose() should prevent later runtime mutations.");
    assert.equal(fixture.pendingAnimationFrames(), 0, "dispose() should cancel pending animation frames.");
    assert.equal(getListenerCount(fixture.document.listeners, "keydown"), 0, "dispose() should remove document keydown listeners.");
    assert.equal(getListenerCount(fixture.document.listeners, "keyup"), 0, "dispose() should remove document keyup listeners.");
    assert.equal(getListenerCount(fixture.windowListeners, "resize"), 0, "dispose() should remove window resize listeners.");
    assert.equal(getListenerCount(fixture.windowListeners, "pointerup"), 0, "dispose() should remove window pointerup listeners.");
    assert.equal(getListenerCount(fixture.windowListeners, "pointercancel"), 0, "dispose() should remove window pointercancel listeners.");
    assert.equal(getListenerCount(fixture.elements.game.listeners, "pointermove"), 0, "dispose() should remove canvas pointermove listeners.");
    assert.equal(getListenerCount(fixture.elements.game.listeners, "pointerdown"), 0, "dispose() should remove canvas pointerdown listeners.");

    fixture.runNextAnimationFrame();
    assert.equal(fixture.pendingAnimationFrames(), 0, "Disposed animation frames should not reschedule.");
  });
}

function testPlayfieldGeometryAdaptsByViewport() {
  withFixture("", (fixture) => {
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
    assert.equal(game.state.playfield.active, true, "Desktop runtime should create side bays.");
    assert.equal(game.player.x >= game.state.playfield.minX && game.player.x <= game.state.playfield.maxX, true);

    fixture.window.innerWidth = 900;
    fixture.window.innerHeight = 720;
    fixture.window.dispatchEvent({ type: "resize" });

    assert.equal(game.state.playfield.active, false, "Tablet width should disable desktop side bays.");
    assert.equal(game.state.playfield.leftBayWidth, 0);
    assert.equal(game.state.playfield.rightBayWidth, 0);
  });
}

function testShowcaseAndInterfaceFlows() {
  withFixture("", (fixture) => {
    const state = createGameState();
    state.view.width = 1280;
    state.view.height = 720;
    const player = createPlayerState(state.view.width, state.view.height);
    const stages = stageDefinitions;
    const interfaceController = createInterfaceController(fixture.document);

    const bossConfig = getShowcaseConfig("?mode=render&boss=prism&phase=2");
    assert.equal(bossConfig?.type, "boss");
    assert.equal(bossConfig?.key, "prism");
    assert.equal(bossConfig?.phase, 2);

    createShowcaseScene(state, player, bossConfig);
    interfaceController.sync(state, player, stages);

    assert.equal(state.started, true, "Render-study mode should mark the run as started.");
    assert.equal(state.boss?.name, "Prism Leviathan");
    assert.equal(state.boss?.phaseIndex, 1, "Phase query parameter should map to the expected phase index.");
    assert.equal(
      fixture.elements["status-copy"].textContent,
      "Render study mode. Use direct URLs to inspect silhouettes and boss phases."
    );
    assert.equal(fixture.elements["boss-panel"].classList.contains("hidden"), false);
    assert.equal(
      fixture.elements["boss-phase"].textContent.startsWith("Refraction Choir"),
      true,
      "Boss showcase HUD should reflect the selected phase."
    );

    const prevPhaseTime = state.boss.phaseTime;
    state.time = 1;
    updateShowcaseScene(state, 0.25);
    assert(
      state.boss.phaseTime > prevPhaseTime,
      "Boss render-study updates should advance phase time."
    );

    const enemyConfig = getShowcaseConfig("?mode=render&enemy=halo");
    createShowcaseScene(state, player, enemyConfig);
    assert.equal(state.entities.length, 1, "Enemy render-study mode should spawn one showcase enemy.");
    const showcaseEnemy = state.entities[0];
    const aiTimeBefore = showcaseEnemy.components.ai.t;
    updateShowcaseScene(state, 0.25);
    assert(
      showcaseEnemy.components.ai.t > aiTimeBefore,
      "Enemy render-study updates should advance showcase enemy AI time."
    );

    state.showcase = null;
    state.over = true;
    state.victory = false;
    interfaceController.sync(state, player, stages);
    assert.equal(fixture.elements["end-screen"].classList.contains("hidden"), false);
    assert.equal(fixture.elements["end-title"].textContent, "Ship Lost");
  });
}

function run() {
  testGameStartRestartAndDisposeFlow();
  testPlayfieldGeometryAdaptsByViewport();
  testShowcaseAndInterfaceFlows();
  console.log("Runtime smoke checks passed.");
}

try {
  run();
} catch (error) {
  console.error("Runtime smoke checks failed.\n");
  console.error(
    `${error.message}\n\nRepair path: keep the start flow, restart path, dispose lifecycle, interface sync, and render-study URL behavior aligned with docs/RUNTIME.md and docs/content/stages-bosses.md.`
  );
  process.exit(1);
}
