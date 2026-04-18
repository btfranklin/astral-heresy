function createValueParam(initialValue = 0) {
  return {
    value: initialValue,
    setValueAtTime(value) {
      this.value = value;
    },
    exponentialRampToValueAtTime(value) {
      this.value = value;
    },
  };
}

function createAudioNode() {
  return {
    connections: [],
    connect(target) {
      this.connections.push(target);
    },
  };
}

export class FakeAudioContext {
  constructor() {
    this.destination = {};
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = "running";
    this.gains = [];
    this.oscillators = [];
    this.filters = [];
    this.buffers = [];
    this.sources = [];
    this.resumeCalls = 0;
  }

  createGain() {
    const node = {
      ...createAudioNode(),
      gain: createValueParam(),
    };
    this.gains.push(node);
    return node;
  }

  createOscillator() {
    const node = {
      ...createAudioNode(),
      type: "sine",
      frequency: createValueParam(),
      detune: createValueParam(),
      start() {},
      stop() {},
    };
    this.oscillators.push(node);
    return node;
  }

  createBiquadFilter() {
    const node = {
      ...createAudioNode(),
      type: "lowpass",
      frequency: createValueParam(),
      Q: createValueParam(),
    };
    this.filters.push(node);
    return node;
  }

  createBuffer(_channels, length) {
    const buffer = {
      getChannelData() {
        return new Float32Array(length);
      },
    };
    this.buffers.push(buffer);
    return buffer;
  }

  createBufferSource() {
    const node = {
      ...createAudioNode(),
      buffer: null,
      start() {},
      stop() {},
    };
    this.sources.push(node);
    return node;
  }

  resume() {
    this.resumeCalls += 1;
    this.state = "running";
  }
}

function createGradientRecorder(calls, type, args) {
  return {
    type,
    args,
    stops: [],
    addColorStop(offset, color) {
      this.stops.push({ offset, color });
      calls.push({ type: `${type}.addColorStop`, args: [offset, color] });
    },
  };
}

export function createRecording2dContext() {
  const calls = [];
  const state = {
    canvas: { width: 0, height: 0 },
  };

  return new Proxy(state, {
    get(target, key) {
      if (key === "calls") return calls;
      if (key === "createRadialGradient" || key === "createLinearGradient") {
        return (...args) => {
          calls.push({ type: key, args });
          return createGradientRecorder(calls, key, args);
        };
      }
      if (key === "measureText") {
        return (text) => ({ width: String(text).length * 10 });
      }
      if (key in target) {
        return target[key];
      }
      return (...args) => {
        calls.push({ type: key, args });
        return undefined;
      };
    },
    set(target, key, value) {
      target[key] = value;
      calls.push({ type: `set:${String(key)}`, value });
      return true;
    },
  });
}

export function createFakeWebGLContext() {
  const calls = [];
  const gl = {
    calls,
    COMPILE_STATUS: 1,
    LINK_STATUS: 1,
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    TRIANGLES: 4,
    createShader(type) {
      calls.push({ type: "createShader", args: [type] });
      return { type };
    },
    shaderSource(shader, source) {
      calls.push({ type: "shaderSource", args: [shader, source] });
    },
    compileShader(shader) {
      calls.push({ type: "compileShader", args: [shader] });
    },
    getShaderParameter() {
      return true;
    },
    getShaderInfoLog() {
      return "";
    },
    deleteShader(shader) {
      calls.push({ type: "deleteShader", args: [shader] });
    },
    createProgram() {
      calls.push({ type: "createProgram", args: [] });
      return {};
    },
    attachShader(program, shader) {
      calls.push({ type: "attachShader", args: [program, shader] });
    },
    linkProgram(program) {
      calls.push({ type: "linkProgram", args: [program] });
    },
    getProgramParameter() {
      return true;
    },
    getProgramInfoLog() {
      return "";
    },
    deleteProgram(program) {
      calls.push({ type: "deleteProgram", args: [program] });
    },
    getAttribLocation(program, name) {
      calls.push({ type: "getAttribLocation", args: [program, name] });
      return 0;
    },
    getUniformLocation(program, name) {
      calls.push({ type: "getUniformLocation", args: [program, name] });
      return { name };
    },
    createBuffer() {
      calls.push({ type: "createBuffer", args: [] });
      return {};
    },
    bindBuffer(target, buffer) {
      calls.push({ type: "bindBuffer", args: [target, buffer] });
    },
    bufferData(target, data, usage) {
      calls.push({ type: "bufferData", args: [target, data, usage] });
    },
    viewport(x, y, width, height) {
      calls.push({ type: "viewport", args: [x, y, width, height] });
    },
    useProgram(program) {
      calls.push({ type: "useProgram", args: [program] });
    },
    enableVertexAttribArray(index) {
      calls.push({ type: "enableVertexAttribArray", args: [index] });
    },
    vertexAttribPointer(index, size, type, normalized, stride, offset) {
      calls.push({ type: "vertexAttribPointer", args: [index, size, type, normalized, stride, offset] });
    },
    uniform2f(location, x, y) {
      calls.push({ type: "uniform2f", args: [location, x, y] });
    },
    uniform1f(location, value) {
      calls.push({ type: "uniform1f", args: [location, value] });
    },
    drawArrays(mode, first, count) {
      calls.push({ type: "drawArrays", args: [mode, first, count] });
    },
  };
  return gl;
}

export class FakeClassList {
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

export class FakeElement {
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

export class FakeCanvas extends FakeElement {
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

export class FakeDocument {
  constructor(elements, hullPips, burstStockPips, effectChips) {
    this.elements = elements;
    this.hullPips = hullPips;
    this.burstStockPips = burstStockPips;
    this.effectChips = effectChips;
    this.listeners = new Map();
    this.hidden = false;
    this.visibilityState = "visible";
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
      return new FakeCanvas(null, (type) => (type === "2d" ? createRecording2dContext() : null));
    }
    return new FakeElement();
  }
}

export function getListenerCount(listenerMap, type) {
  return listenerMap.get(type)?.size ?? 0;
}

export function createRuntimeFixture(search = "") {
  const hullPips = Array.from({ length: 5 }, () => new FakeElement(null, ["hull-pip", "is-full"]));
  const burstStockPips = Array.from({ length: 2 }, (_, index) =>
    new FakeElement(null, index === 0 ? ["stock-pip", "is-full"] : ["stock-pip"])
  );
  const effectChips = Array.from({ length: 6 }, () => new FakeElement(null, ["effect-chip", "hidden"]));
  const elements = {
    bg: new FakeCanvas("bg", (type) => (type === "webgl" ? createFakeWebGLContext() : null)),
    game: new FakeCanvas("game", (type) => (type === "2d" ? createRecording2dContext() : null)),
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

export async function withDomFixture(search, fn) {
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
    return await fn(fixture);
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    globalThis.cancelAnimationFrame = previous.cancelAnimationFrame;
    globalThis.alert = previous.alert;
  }
}
