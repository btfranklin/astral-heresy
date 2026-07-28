import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const SCHEMA = "astral-heresy.render-performance.v1";
const WARMUP_CALLBACKS = 60;
const SAMPLE_CALLBACKS = 180;
const UNTIMED_CALLBACKS = 30;

const scenes = [
  { id: "idle", path: "/" },
  { id: "six-halos-42-bullets", path: "/?mode=render&enemy=halo" },
  { id: "seraph-phase-3", path: "/?mode=render&boss=seraph&phase=3" },
];

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
  const mean = sorted.reduce((total, value) => total + value, 0) / sorted.length;
  return {
    count: sorted.length,
    mean: Number(mean.toFixed(3)),
    p50: Number(percentile(0.5).toFixed(3)),
    p95: Number(percentile(0.95).toFixed(3)),
    p99: Number(percentile(0.99).toFixed(3)),
    max: Number(sorted.at(-1).toFixed(3)),
  };
}

function metricsByName(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]));
}

function metricDelta(before, after, name) {
  return Number(((after[name] ?? Number.NaN) - (before[name] ?? Number.NaN)).toFixed(6));
}

function attachBrowserErrorRecorder(page, baseURL) {
  const errors = [];
  const record = (kind, value) => errors.push(`${kind}: ${value}`);

  page.on("pageerror", (error) => record("pageerror", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") record("console.error", message.text());
  });
  page.on("requestfailed", (request) =>
    record("requestfailed", `${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`)
  );
  page.on("response", (response) => {
    if (response.url().startsWith(baseURL) && response.status() >= 400) {
      record("response", `${response.status()} ${response.url()}`);
    }
  });
  page.on("dialog", async (dialog) => {
    record("dialog", `${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });

  return errors;
}

function installTimingInstrumentation() {
  const timing = {
    active: false,
    target: 0,
    records: [],
    lastRafTimestamp: null,
    resolve: null,
  };
  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);

  window.__renderPerformanceTiming = {
    begin(target) {
      timing.active = true;
      timing.target = target;
      timing.records = [];
      timing.resolve = null;
    },
    waitForTarget() {
      if (timing.records.length >= timing.target) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        timing.resolve = resolve;
      });
    },
    snapshot() {
      return timing.records.map((record) => ({ ...record }));
    },
  };

  window.requestAnimationFrame = (callback) =>
    nativeRequestAnimationFrame((timestamp) => {
      const previousTimestamp = timing.lastRafTimestamp;
      timing.lastRafTimestamp = timestamp;
      const measure = timing.active && timing.records.length < timing.target;
      const startedAt = measure ? performance.now() : 0;

      try {
        callback(timestamp);
      } finally {
        if (measure) {
          timing.records.push({
            durationMs: performance.now() - startedAt,
            intervalMs: previousTimestamp === null ? null : timestamp - previousTimestamp,
          });
          if (timing.records.length >= timing.target) {
            timing.active = false;
            const resolve = timing.resolve;
            timing.resolve = null;
            resolve?.();
          }
        }
      }
    });

  const gpu = {
    active: false,
    target: 0,
    issued: 0,
    gl: null,
    extension: null,
    queries: [],
    reason: "GPU timing was not started.",
  };
  const nativeDrawArrays = WebGLRenderingContext.prototype.drawArrays;

  window.__renderPerformanceGpu = {
    start(target) {
      gpu.active = false;
      gpu.target = target;
      gpu.issued = 0;
      gpu.queries = [];
      gpu.gl = document.getElementById("bg")?.getContext("webgl") || null;
      gpu.extension = gpu.gl?.getExtension("EXT_disjoint_timer_query") || null;
      if (!gpu.gl) {
        gpu.reason = "The background WebGL context was unavailable.";
        return;
      }
      if (!gpu.extension) {
        gpu.reason = "EXT_disjoint_timer_query is unavailable for this renderer.";
        return;
      }
      gpu.reason = null;
      gpu.active = true;
    },
    async collect() {
      gpu.active = false;
      if (!gpu.gl || !gpu.extension) {
        return { supported: false, reason: gpu.reason };
      }

      gpu.gl.finish();
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (
          gpu.queries.every((query) =>
            gpu.extension.getQueryObjectEXT(query, gpu.extension.QUERY_RESULT_AVAILABLE_EXT)
          )
        ) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const disjoint = Boolean(gpu.gl.getParameter(gpu.extension.GPU_DISJOINT_EXT));
      const durationsMs = [];
      let unavailableQueries = 0;
      for (const query of gpu.queries) {
        if (gpu.extension.getQueryObjectEXT(query, gpu.extension.QUERY_RESULT_AVAILABLE_EXT)) {
          durationsMs.push(
            gpu.extension.getQueryObjectEXT(query, gpu.extension.QUERY_RESULT_EXT) / 1_000_000
          );
        } else {
          unavailableQueries += 1;
        }
        gpu.extension.deleteQueryEXT(query);
      }
      gpu.queries = [];

      if (disjoint) {
        return {
          supported: false,
          reason: "The GPU reported a disjoint timer interval.",
          issuedQueries: gpu.issued,
        };
      }
      if (durationsMs.length === 0) {
        return {
          supported: false,
          reason: "GPU timer queries did not produce readable samples.",
          issuedQueries: gpu.issued,
          unavailableQueries,
        };
      }
      return {
        supported: true,
        durationsMs,
        issuedQueries: gpu.issued,
        unavailableQueries,
      };
    },
  };

  WebGLRenderingContext.prototype.drawArrays = function (...args) {
    if (!gpu.active || this !== gpu.gl || gpu.issued >= gpu.target) {
      return nativeDrawArrays.apply(this, args);
    }

    let query;
    try {
      query = gpu.extension.createQueryEXT();
      gpu.extension.beginQueryEXT(gpu.extension.TIME_ELAPSED_EXT, query);
    } catch (error) {
      gpu.active = false;
      gpu.reason = `Unable to start a GPU timer query: ${error.message}`;
      return nativeDrawArrays.apply(this, args);
    }

    try {
      return nativeDrawArrays.apply(this, args);
    } finally {
      gpu.extension.endQueryEXT(gpu.extension.TIME_ELAPSED_EXT);
      gpu.queries.push(query);
      gpu.issued += 1;
      if (gpu.issued >= gpu.target) {
        gpu.active = false;
      }
    }
  };
}

function installUntimedInstrumentation() {
  const counters = {
    active: false,
    canvasCommands: 0,
    canvasCommandsByMethod: {},
    offscreenCanvasElements: 0,
    offscreenCanvasContexts: 0,
    offscreenCanvasConstructors: 0,
    domMutations: 0,
    domMutationsByType: {},
    domAttributeMutations: {},
    frames: 0,
    targetFrames: 0,
    finishing: false,
    resolve: null,
    observer: null,
  };

  function recordMutations(records) {
    for (const record of records) {
      counters.domMutations += 1;
      counters.domMutationsByType[record.type] =
        (counters.domMutationsByType[record.type] || 0) + 1;
      if (record.type === "attributes") {
        const name = record.attributeName || "unknown";
        counters.domAttributeMutations[name] =
          (counters.domAttributeMutations[name] || 0) + 1;
      }
    }
  }

  function ensureObserver() {
    if (counters.observer || !document.documentElement) return;
    counters.observer = new MutationObserver((records) => {
      if (counters.active) recordMutations(records);
    });
    counters.observer.observe(document.documentElement, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  if (document.documentElement) {
    ensureObserver();
  } else {
    document.addEventListener("DOMContentLoaded", ensureObserver, { once: true });
  }

  for (const name of Object.getOwnPropertyNames(CanvasRenderingContext2D.prototype)) {
    if (name === "constructor") continue;
    const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, name);
    if (typeof descriptor?.value !== "function") continue;
    const nativeMethod = descriptor.value;
    try {
      Object.defineProperty(CanvasRenderingContext2D.prototype, name, {
        ...descriptor,
        value(...args) {
          if (counters.active) {
            counters.canvasCommands += 1;
            counters.canvasCommandsByMethod[name] =
              (counters.canvasCommandsByMethod[name] || 0) + 1;
          }
          return nativeMethod.apply(this, args);
        },
      });
    } catch {
      // Some browser-owned prototype methods may not be replaceable.
    }
  }

  const nativeCreateElement = Document.prototype.createElement;
  Document.prototype.createElement = function (name, ...args) {
    const element = nativeCreateElement.call(this, name, ...args);
    if (counters.active && String(name).toLowerCase() === "canvas") {
      counters.offscreenCanvasElements += 1;
    }
    return element;
  };

  const nativeGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    if (counters.active && !this.isConnected) {
      counters.offscreenCanvasContexts += 1;
    }
    return nativeGetContext.apply(this, args);
  };

  if (typeof window.OffscreenCanvas === "function") {
    const NativeOffscreenCanvas = window.OffscreenCanvas;
    try {
      window.OffscreenCanvas = new Proxy(NativeOffscreenCanvas, {
        construct(target, args, newTarget) {
          if (counters.active) counters.offscreenCanvasConstructors += 1;
          return Reflect.construct(target, args, newTarget);
        },
      });
    } catch {
      // The constructor is optional and may be non-configurable.
    }
  }

  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    nativeRequestAnimationFrame((timestamp) => {
      try {
        callback(timestamp);
      } finally {
        if (counters.active && !counters.finishing) {
          counters.frames += 1;
          if (counters.frames >= counters.targetFrames) {
            counters.finishing = true;
            setTimeout(() => {
              if (!counters.active) return;
              if (counters.observer) {
                recordMutations(counters.observer.takeRecords());
              }
              counters.active = false;
              const resolve = counters.resolve;
              counters.resolve = null;
              resolve?.();
            }, 0);
          }
        }
      }
    });

  window.__renderPerformanceCounters = {
    begin(targetFrames) {
      ensureObserver();
      if (counters.observer) counters.observer.takeRecords();
      counters.active = true;
      counters.canvasCommands = 0;
      counters.canvasCommandsByMethod = {};
      counters.offscreenCanvasElements = 0;
      counters.offscreenCanvasContexts = 0;
      counters.offscreenCanvasConstructors = 0;
      counters.domMutations = 0;
      counters.domMutationsByType = {};
      counters.domAttributeMutations = {};
      counters.frames = 0;
      counters.targetFrames = targetFrames;
      counters.finishing = false;
      counters.resolve = null;
    },
    waitForTarget() {
      if (!counters.active && counters.frames >= counters.targetFrames) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        counters.resolve = resolve;
      });
    },
    snapshot() {
      if (counters.observer) recordMutations(counters.observer.takeRecords());
      return {
        frames: counters.frames,
        canvasCommands: counters.canvasCommands,
        canvasCommandsByMethod: { ...counters.canvasCommandsByMethod },
        offscreenAllocations: {
          canvasElements: counters.offscreenCanvasElements,
          canvasContexts: counters.offscreenCanvasContexts,
          offscreenCanvasConstructors: counters.offscreenCanvasConstructors,
        },
        domMutations: counters.domMutations,
        domMutationsByType: { ...counters.domMutationsByType },
        domAttributeMutations: { ...counters.domAttributeMutations },
      };
    },
  };
}

async function waitForGame(page) {
  const response = await page.waitForFunction(
    () => Boolean(window.__astralHeresy),
    null,
    { polling: 100, timeout: 10_000 }
  );
  await response.dispose();
}

async function prepareScene(page, sceneId) {
  return page.evaluate(
    (id) => {
      const game = window.__astralHeresy;
      if (!game) throw new Error("The game handle is unavailable.");

      if (id === "six-halos-42-bullets") {
        game.state.entities = [];
        game.state.boss = null;
        game.state.time = 0;
        game.state.pulse = 0;

        const enemyPositions = [
          [0.28, 0.24],
          [0.5, 0.24],
          [0.72, 0.24],
          [0.28, 0.46],
          [0.5, 0.46],
          [0.72, 0.46],
        ];
        for (const [xRatio, yRatio] of enemyPositions) {
          game.debugSpawnEnemy(
            "halo",
            {
              x: game.state.view.width * xRatio,
              y: game.state.view.height * yRatio,
              vx: 0,
              vy: 0,
              hp: 999,
              behavior() {},
            },
            { laneAware: false }
          );
        }

        for (let index = 0; index < 42; index += 1) {
          const column = index % 7;
          const row = Math.floor(index / 7);
          game.debugSpawnEnemyBullet(
            game.state.view.width * (0.2 + column * 0.1),
            game.state.view.height * (0.16 + row * 0.11),
            0,
            0,
            {
              r: 4,
              life: 600,
              seed: index + 1,
              color: "#ff8fd8",
              glow: 1,
            }
          );
        }
      } else if (id === "seraph-phase-3") {
        game.state.time = 0;
        game.state.pulse = 0;
        if (game.state.boss) {
          game.state.boss.phaseTime = 0;
        }
      }

      const enemies = game.state.entities.filter((entity) => entity.type === "enemy").length;
      const enemyBullets = game.state.entities.filter(
        (entity) => entity.type === "enemyBullet"
      ).length;
      const state = {
        started: game.state.started,
        showcaseType: game.state.showcase?.type || null,
        enemies,
        enemyBullets,
        bossKey: game.state.boss?.key || null,
        bossPhaseIndex: game.state.boss?.phaseIndex ?? null,
      };
      state.valid =
        id === "idle"
          ? state.started === false && state.showcaseType === null
          : id === "six-halos-42-bullets"
            ? state.started === true &&
              state.showcaseType === "enemy" &&
              enemies === 6 &&
              enemyBullets === 42
            : state.started === true &&
              state.showcaseType === "boss" &&
              state.bossKey === "seraph" &&
              state.bossPhaseIndex === 2;
      return state;
    },
    sceneId
  );
}

async function waitForAnimationFrames(page, count) {
  await page.evaluate(
    (frameCount) =>
      new Promise((resolve) => {
        let remaining = frameCount;
        function onFrame() {
          remaining -= 1;
          if (remaining <= 0) {
            resolve();
            return;
          }
          requestAnimationFrame(onFrame);
        }
        requestAnimationFrame(onFrame);
      }),
    count
  );
}

async function readEnvironment(page) {
  return page.evaluate(() => {
    const backgroundCanvas = document.getElementById("bg");
    const gameCanvas = document.getElementById("game");
    const backgroundRect = backgroundCanvas.getBoundingClientRect();
    const gameRect = gameCanvas.getBoundingClientRect();
    const gl = backgroundCanvas.getContext("webgl");
    const rendererInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory ?? null,
      devicePixelRatio: window.devicePixelRatio,
      renderer: rendererInfo
        ? gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      vendor: rendererInfo
        ? gl.getParameter(rendererInfo.UNMASKED_VENDOR_WEBGL)
        : gl.getParameter(gl.VENDOR),
      gpuTimerExtensionAvailable: Boolean(gl.getExtension("EXT_disjoint_timer_query")),
      contextAttributes: gl.getContextAttributes(),
      canvases: {
        background: {
          backing: [backgroundCanvas.width, backgroundCanvas.height],
          css: [backgroundRect.width, backgroundRect.height],
        },
        game: {
          backing: [gameCanvas.width, gameCanvas.height],
          css: [gameRect.width, gameRect.height],
        },
      },
    };
  });
}

async function runUntimedPass(context, baseURL, scene) {
  const page = await context.newPage();
  const browserErrors = attachBrowserErrorRecorder(page, baseURL);
  await page.addInitScript(installUntimedInstrumentation);
  try {
    const response = await page.goto(scene.path, { waitUntil: "load" });
    expect(response?.ok(), `untimed ${scene.id} page response`).toBe(true);
    await waitForGame(page);
    const sceneState = await prepareScene(page, scene.id);
    expect(sceneState.valid, `untimed ${scene.id} scene setup`).toBe(true);
    await waitForAnimationFrames(page, WARMUP_CALLBACKS);
    await page.evaluate(
      (count) => window.__renderPerformanceCounters.begin(count),
      UNTIMED_CALLBACKS
    );
    await page.evaluate(() => window.__renderPerformanceCounters.waitForTarget());
    const counters = await page.evaluate(() => window.__renderPerformanceCounters.snapshot());
    expect(counters.frames).toBe(UNTIMED_CALLBACKS);
    expect(browserErrors, `untimed ${scene.id} browser errors`).toEqual([]);
    return counters;
  } finally {
    await page.close();
  }
}

test.describe.configure({ mode: "serial" });

for (const scene of scenes) {
  test(`${scene.id} records render performance telemetry`, async (
    { page, context, baseURL },
    testInfo
  ) => {
    const browserErrors = attachBrowserErrorRecorder(page, baseURL);
    await page.addInitScript(installTimingInstrumentation);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");

    const response = await page.goto(scene.path, { waitUntil: "load" });
    expect(response?.ok(), `${scene.id} page response`).toBe(true);
    await waitForGame(page);
    const sceneState = await prepareScene(page, scene.id);
    expect(sceneState.valid, `${scene.id} scene setup`).toBe(true);

    await page.evaluate(
      (count) => window.__renderPerformanceTiming.begin(count),
      WARMUP_CALLBACKS
    );
    await page.evaluate(() => window.__renderPerformanceTiming.waitForTarget());

    const metricsBefore = metricsByName(await cdp.send("Performance.getMetrics"));
    await page.evaluate((count) => {
      window.__renderPerformanceTiming.begin(count);
      window.__renderPerformanceGpu.start(count);
    }, SAMPLE_CALLBACKS);
    await page.evaluate(() => window.__renderPerformanceTiming.waitForTarget());
    const metricsAfter = metricsByName(await cdp.send("Performance.getMetrics"));

    const records = await page.evaluate(() => window.__renderPerformanceTiming.snapshot());
    const gpuRaw = await page.evaluate(() => window.__renderPerformanceGpu.collect());
    const environment = await readEnvironment(page);
    const untimed = await runUntimedPass(context, baseURL, scene);

    const callbackDurationsMs = records.map((record) => record.durationMs);
    const callbackIntervalsMs = records.map((record) => record.intervalMs);
    const validDurations = callbackDurationsMs.every(
      (value) => Number.isFinite(value) && value >= 0
    );
    const validIntervals = callbackIntervalsMs.every(
      (value) => Number.isFinite(value) && value > 0
    );
    const cdpMetrics = {
      taskDurationSeconds: metricDelta(metricsBefore, metricsAfter, "TaskDuration"),
      scriptDurationSeconds: metricDelta(metricsBefore, metricsAfter, "ScriptDuration"),
    };

    expect(records).toHaveLength(SAMPLE_CALLBACKS);
    expect(validDurations, `${scene.id} callback duration samples`).toBe(true);
    expect(validIntervals, `${scene.id} callback interval samples`).toBe(true);
    expect(Number.isFinite(cdpMetrics.taskDurationSeconds)).toBe(true);
    expect(Number.isFinite(cdpMetrics.scriptDurationSeconds)).toBe(true);
    expect(browserErrors, `${scene.id} browser errors`).toEqual([]);

    const gpu = gpuRaw.supported
      ? {
          supported: true,
          durationMs: summarize(gpuRaw.durationsMs),
          issuedQueries: gpuRaw.issuedQueries,
          unavailableQueries: gpuRaw.unavailableQueries,
        }
      : {
          supported: false,
          reason: gpuRaw.reason,
          issuedQueries: gpuRaw.issuedQueries ?? 0,
          unavailableQueries: gpuRaw.unavailableQueries ?? 0,
        };
    const result = {
      schema: SCHEMA,
      timestamp: new Date().toISOString(),
      project: testInfo.project.name,
      scene: scene.id,
      sample: {
        warmupCallbacks: WARMUP_CALLBACKS,
        sampledCallbacks: SAMPLE_CALLBACKS,
        callbackDurationMs: summarize(callbackDurationsMs),
        callbackIntervalMs: summarize(callbackIntervalsMs),
        callbackDurationsMs,
        callbackIntervalsMs,
      },
      cdp: cdpMetrics,
      gpu,
      environment,
      sceneState,
      untimed: {
        ...untimed,
        note: "Canvas, DOM, and allocation counters come from a separate untimed page.",
      },
    };

    const attachmentPath = testInfo.outputPath("render-performance.json");
    await writeFile(attachmentPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    await testInfo.attach("render-performance.json", {
      path: attachmentPath,
      contentType: "application/json",
    });

    console.log(
      `[render-performance] ${JSON.stringify({
        schema: result.schema,
        timestamp: result.timestamp,
        project: result.project,
        scene: result.scene,
        backing: result.environment.canvases,
        userAgent: result.environment.userAgent,
        renderer: result.environment.renderer,
        callbackDurationMs: result.sample.callbackDurationMs,
        callbackIntervalMs: result.sample.callbackIntervalMs,
        cdp: result.cdp,
        gpu: result.gpu,
        untimed: {
          frames: result.untimed.frames,
          canvasCommands: result.untimed.canvasCommands,
          domMutations: result.untimed.domMutations,
          offscreenAllocations: result.untimed.offscreenAllocations,
        },
      })}`
    );

    await cdp.detach();
  });
}
