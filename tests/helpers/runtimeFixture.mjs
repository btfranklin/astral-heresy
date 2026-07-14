function createGradientRecorder(calls, type, args) {
  return {
    stops: [],
    addColorStop(offset, color) {
      this.stops.push({ offset, color });
      calls.push({ type: `${type}.addColorStop`, args: [offset, color] });
    },
  };
}

export function createRecording2dContext() {
  const calls = [];
  const context = {
    calls,
    canvas: { width: 0, height: 0 },
    fillStyle: "#000",
    strokeStyle: "#000",
    font: "10px sans-serif",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineCap: "butt",
    lineWidth: 1,
    textAlign: "start",
    arc: record("arc"),
    beginPath: record("beginPath"),
    clearRect: record("clearRect"),
    closePath: record("closePath"),
    drawImage: record("drawImage"),
    ellipse: record("ellipse"),
    fill: record("fill"),
    fillRect: record("fillRect"),
    fillText: record("fillText"),
    lineTo: record("lineTo"),
    moveTo: record("moveTo"),
    quadraticCurveTo: record("quadraticCurveTo"),
    restore: record("restore"),
    rotate: record("rotate"),
    save: record("save"),
    scale: record("scale"),
    setTransform: record("setTransform"),
    stroke: record("stroke"),
    strokeRect: record("strokeRect"),
    translate: record("translate"),
    createLinearGradient: createGradient("createLinearGradient"),
    createRadialGradient: createGradient("createRadialGradient"),
    measureText(text) {
      calls.push({ type: "measureText", args: [text] });
      return { width: String(text).length * 10 };
    },
  };

  function record(type) {
    return (...args) => {
      calls.push({ type, args });
    };
  }

  function createGradient(type) {
    return (...args) => {
      calls.push({ type, args });
      return createGradientRecorder(calls, type, args);
    };
  }

  return context;
}

export function createClassListRecorder(initial = []) {
  const values = new Set(initial);
  const calls = [];
  return {
    calls,
    values,
    add(...tokens) {
      calls.push({ type: "add", tokens });
      for (const token of tokens) values.add(token);
    },
    remove(...tokens) {
      calls.push({ type: "remove", tokens });
      for (const token of tokens) values.delete(token);
    },
    contains(token) {
      return values.has(token);
    },
    toggle(token, force) {
      calls.push({ type: "toggle", token, force });
      const enabled = force === undefined ? !values.has(token) : Boolean(force);
      if (enabled) values.add(token);
      else values.delete(token);
      return enabled;
    },
  };
}

export function createElementRecorder({ classNames = [], rect = null } = {}) {
  const target = createEventTargetRecorder();
  return {
    ...target,
    textContent: "",
    style: {},
    dataset: {},
    classList: createClassListRecorder(classNames),
    width: 0,
    height: 0,
    getBoundingClientRect: rect ? () => ({ ...rect }) : undefined,
  };
}

export function createEventTargetRecorder() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    emit(type, event = {}) {
      const suppliedEvent = {
        type,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...event,
      };
      for (const handler of listeners.get(type) || []) handler(suppliedEvent);
      return suppliedEvent;
    },
  };
}

export function getListenerCount(target, type) {
  return target.listeners.get(type)?.size ?? 0;
}

export function createInterfaceProjectionFixture() {
  const ids = [
    "interface",
    "status-copy",
    "stage-label",
    "stage-name",
    "stage-progress",
    "run-time",
    "score-value",
    "kill-value",
    "accuracy-value",
    "chain-value",
    "loop-value",
    "move-chip",
    "fire-chip",
    "focus-chip",
    "burst-chip",
    "hull-pips",
    "graze-progress",
    "graze-value",
    "burst-stocks",
    "weapon-value",
    "bonus-banner",
    "powerup-feed",
    "powerup-notice-category",
    "powerup-notice-role",
    "powerup-notice-sigil",
    "powerup-notice-title",
    "boss-panel",
    "boss-name",
    "boss-phase",
    "boss-progress",
    "end-screen",
    "end-kicker",
    "end-title",
    "end-text",
    "end-score",
    "end-kills",
    "end-accuracy",
    "end-time",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, createElementRecorder()]));
  elements["powerup-feed"].classList.add("hidden");
  elements["boss-panel"].classList.add("hidden");
  elements["end-screen"].classList.add("hidden");

  const hullPips = Array.from({ length: 5 }, () => createElementRecorder({ classNames: ["is-full"] }));
  const burstStockPips = Array.from({ length: 2 }, () => createElementRecorder());
  const effectChips = Array.from({ length: 6 }, () => createElementRecorder({ classNames: ["hidden"] }));
  const selectorResults = new Map([
    ["#hull-pips .hull-pip", hullPips],
    ["#burst-stocks .stock-pip", burstStockPips],
    ["#effect-strip .effect-chip", effectChips],
  ]);

  return {
    elements,
    hullPips,
    burstStockPips,
    effectChips,
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
      querySelectorAll(selector) {
        return selectorResults.get(selector) ?? [];
      },
    },
  };
}

export async function withInputListenerEnvironment(fn) {
  const previous = { window: globalThis.window, document: globalThis.document };
  const windowTarget = createEventTargetRecorder();
  const documentTarget = createEventTargetRecorder();
  documentTarget.hidden = false;
  documentTarget.visibilityState = "visible";
  globalThis.window = windowTarget;
  globalThis.document = documentTarget;

  try {
    return await fn({ windowTarget, documentTarget });
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
  }
}
