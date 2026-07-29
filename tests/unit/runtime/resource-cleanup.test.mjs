import test from "node:test";
import assert from "node:assert/strict";

import { createAudioEngine } from "../../../src/audio/audioEngine.js";
import { createBackgroundRenderer } from "../../../src/rendering/glBackground.js";

function createParam() {
  return {
    value: 0,
    setValueAtTime(value) { this.value = value; },
    setTargetAtTime(value) { this.value = value; },
    linearRampToValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; },
    cancelAndHoldAtTime() {},
    cancelScheduledValues() {},
  };
}

function createNode(extra = {}) {
  return {
    disconnectCalls: 0,
    connect() {},
    disconnect() { this.disconnectCalls += 1; },
    ...extra,
  };
}

class DisposableAudioContext {
  constructor() {
    this.destination = {};
    this.sampleRate = 100;
    this.currentTime = 0;
    this.state = "running";
    this.closeCalls = 0;
    this.oscillators = [];
    this.sources = [];
  }

  createGain() {
    return createNode({ gain: createParam() });
  }

  createOscillator() {
    const node = createNode({
      frequency: createParam(),
      detune: createParam(),
      stopCalls: 0,
      start() {},
      stop() { this.stopCalls += 1; },
      addEventListener() {},
      setPeriodicWave() {},
    });
    this.oscillators.push(node);
    return node;
  }

  createBiquadFilter() {
    return createNode({ frequency: createParam(), Q: createParam(), gain: createParam() });
  }

  createBuffer(_channels, length, sampleRate = this.sampleRate) {
    return {
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }

  createBufferSource() {
    const node = createNode({
      stopCalls: 0,
      start() {},
      stop() { this.stopCalls += 1; },
      addEventListener() {},
    });
    this.sources.push(node);
    return node;
  }

  createDelay() {
    return createNode({ delayTime: createParam() });
  }

  createConvolver() {
    return createNode({ buffer: null });
  }

  createStereoPanner() {
    return createNode({ pan: createParam() });
  }

  createWaveShaper() {
    return createNode({ curve: null, oversample: "none" });
  }

  createDynamicsCompressor() {
    return createNode({
      threshold: createParam(),
      knee: createParam(),
      ratio: createParam(),
      attack: createParam(),
      release: createParam(),
    });
  }

  createAnalyser() {
    return createNode({
      fftSize: 512,
      getFloatTimeDomainData(array) {
        array.fill(0);
      },
    });
  }

  createPeriodicWave() {
    return {};
  }

  close() {
    this.closeCalls += 1;
    this.state = "closed";
    return Promise.resolve();
  }
}

function createWebGLRecorder() {
  const calls = [];
  const record = (type, result) => (...args) => {
    calls.push({ type, args });
    return typeof result === "function" ? result(...args) : result;
  };
  return {
    calls,
    COMPILE_STATUS: 1,
    LINK_STATUS: 2,
    VERTEX_SHADER: 3,
    FRAGMENT_SHADER: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLES: 8,
    createShader: record("createShader", (type) => ({ type })),
    shaderSource: record("shaderSource"),
    compileShader: record("compileShader"),
    getShaderParameter: () => true,
    getShaderInfoLog: () => "",
    deleteShader: record("deleteShader"),
    createProgram: record("createProgram", {}),
    attachShader: record("attachShader"),
    linkProgram: record("linkProgram"),
    getProgramParameter: () => true,
    getProgramInfoLog: () => "",
    deleteProgram: record("deleteProgram"),
    getAttribLocation: () => 0,
    getUniformLocation: (_program, name) => ({ name }),
    createBuffer: record("createBuffer", {}),
    bindBuffer: record("bindBuffer"),
    bufferData: record("bufferData"),
    viewport: record("viewport"),
    useProgram: record("useProgram"),
    enableVertexAttribArray: record("enableVertexAttribArray"),
    vertexAttribPointer: record("vertexAttribPointer"),
    uniform2f: record("uniform2f"),
    uniform1f: record("uniform1f"),
    drawArrays: record("drawArrays"),
    deleteBuffer: record("deleteBuffer"),
  };
}

test("audio disposal stops active sources, disconnects nodes, and closes its context once", async () => {
  const context = new DisposableAudioContext();
  const audio = createAudioEngine({
    contextFactory: () => context,
    enableWorklet: false,
  });
  audio.init();
  audio.beginRun({
    active: true,
    time: 0,
    stageKey: "nebula-gate",
    stageProgress: 0,
    loopIndex: 0,
    hull: 5,
    bossKey: null,
    bossPhaseIndex: -1,
    bossPhaseProgress: 0,
    chainRatio: 0,
    grazeRatio: 0,
    densityRatio: 0,
    playerX: 640,
    playfieldMinX: 0,
    playfieldMaxX: 1280,
  });
  audio.playEvent("fire", { x: 640 });
  audio.playEvent("player-hit", { x: 640 });

  await audio.dispose();
  await audio.dispose();

  assert.equal(context.closeCalls, 1);
  assert.equal(context.oscillators.every((node) => node.stopCalls >= 1), true);
  assert.equal(context.sources.every((node) => node.stopCalls >= 1), true);
  assert.equal(context.oscillators.every((node) => node.disconnectCalls >= 1), true);
  assert.equal(context.sources.every((node) => node.disconnectCalls >= 1), true);
  assert.equal(audio.getDiagnostics().mode, "disposed");

  audio.init();
  assert.equal(context.closeCalls, 1);
});

test("WebGL disposal releases the buffer and program once and disables later rendering", () => {
  const gl = createWebGLRecorder();
  const renderer = createBackgroundRenderer(gl);
  const state = {
    time: 0,
    pulse: 0,
    view: { width: 1280, height: 720, dpr: 1 },
    playfield: { minX: 0, maxX: 1280, active: false },
  };

  assert.equal(renderer.render(state, { x: 640, y: 620 }), true);
  renderer.dispose();
  renderer.dispose();
  assert.equal(renderer.render(state, { x: 640, y: 620 }), false);

  assert.equal(gl.calls.filter((call) => call.type === "deleteShader").length, 2);
  assert.equal(gl.calls.filter((call) => call.type === "deleteBuffer").length, 1);
  assert.equal(gl.calls.filter((call) => call.type === "deleteProgram").length, 1);
  assert.equal(gl.calls.filter((call) => call.type === "drawArrays").length, 1);
});

test("WebGL rendering memoizes scalar signatures and uses its resized buffer scale", () => {
  const gl = createWebGLRecorder();
  gl.drawingBufferWidth = 1919;
  gl.drawingBufferHeight = 1079;
  const renderer = createBackgroundRenderer(gl);
  const state = {
    time: 0,
    pulse: 0,
    view: { width: 1280, height: 720, dpr: 2 },
    playfield: { minX: 48, maxX: 1232, active: true },
  };
  const player = { x: 640, y: 620 };

  renderer.resize(1280, 720, 1.5);
  assert.equal(renderer.render(state, player), true);
  assert.equal(renderer.render(state, player), false);
  assert.equal(gl.calls.filter((call) => call.type === "drawArrays").length, 1);
  assert.deepEqual(
    gl.calls.find((call) => call.type === "viewport").args,
    [0, 0, 1919, 1079]
  );
  assert.deepEqual(
    gl.calls.find(
      (call) => call.type === "uniform2f" && call.args[0].name === "u_resolution"
    ).args.slice(1),
    [1919, 1079]
  );
  assert.deepEqual(
    gl.calls.find(
      (call) => call.type === "uniform2f" && call.args[0].name === "u_player"
    ).args.slice(1),
    [640 * (1919 / 1280), 620 * (1079 / 720)]
  );

  state.pulse = 0.5;
  assert.equal(renderer.render(state, player), true);
  assert.equal(renderer.render(state, player), false);
  assert.equal(gl.calls.filter((call) => call.type === "drawArrays").length, 2);

  renderer.resize(1280, 720, 1.5);
  assert.equal(renderer.render(state, player), true);
  assert.equal(gl.calls.filter((call) => call.type === "drawArrays").length, 3);
});
