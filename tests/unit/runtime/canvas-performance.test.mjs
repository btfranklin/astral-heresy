import test from "node:test";
import assert from "node:assert/strict";

import { createBossInstance } from "../../../src/data/bosses.js";
import { stageDefinitions } from "../../../src/data/stages.js";
import { drawBossByKey } from "../../../src/rendering/bossRenderers.js";
import { createCanvasRenderer } from "../../../src/rendering/canvasRenderer.js";
import {
  createGlowSpriteCache,
  drawGlowCircle,
} from "../../../src/rendering/drawHelpers.js";
import { drawEnemy } from "../../../src/rendering/enemyRenderers.js";
import { spawnEnemy } from "../../../src/systems/enemySystem.js";
import { makeBossContext, makeState } from "../../helpers/fixtures.mjs";
import { createRecording2dContext } from "../../helpers/runtimeFixture.mjs";

function createCanvasFactory() {
  const canvases = [];
  function createCanvas() {
    const context = createRecording2dContext();
    const canvas = {
      width: 0,
      height: 0,
      context,
      getContext(type) {
        assert.equal(type, "2d");
        return context;
      },
    };
    context.canvas = canvas;
    canvases.push(canvas);
    return canvas;
  }
  return { canvases, createCanvas };
}

function createBuckets(overrides = {}) {
  return {
    enemies: [],
    enemyBullets: [],
    playerBullets: [],
    pickups: [],
    scoreShards: [],
    particles: [],
    ...overrides,
  };
}

function createParticle(id, color, size) {
  return {
    id,
    type: "particle",
    components: {
      position: { x: 100 + id, y: 160 + id },
      lifetime: { age: 0.25, life: 1 },
      render: { color, size },
    },
  };
}

function createBullet(color, radius = 4) {
  return {
    id: 1000,
    type: "enemyBullet",
    components: {
      position: { x: 320, y: 240 },
      velocity: { vx: 120, vy: 0 },
      collider: { r: radius },
      lifetime: { age: 0.25, life: 1 },
      render: { color, trail: 0.5 },
    },
  };
}

function prepareStaticState({ dpr = 1 } = {}) {
  const { state, player } = makeState();
  state.view.dpr = dpr;
  state.playfield.active = false;
  state.over = true;
  player.hp = 0;
  return { state, player };
}

test("particle sprites share one normalized color resource across 120 sizes and rebuild for DPR", () => {
  const factory = createCanvasFactory();
  const ctx = createRecording2dContext();
  const renderer = createCanvasRenderer(ctx, { createCanvas: factory.createCanvas });
  const { state, player } = prepareStaticState({ dpr: 0.5 });
  const color = "#fefefe";
  const particles = Array.from(
    { length: 120 },
    (_, index) => createParticle(index, color, 1 + index / 100)
  );
  const buckets = createBuckets({
    particles,
    enemyBullets: [createBullet(color)],
  });

  renderer.render(state, player, stageDefinitions, buckets);

  assert.equal(factory.canvases.length, 2, "Particle and bullet sprites use separate caches.");
  assert.equal(factory.canvases[0].width, 32, "A 64-logical-pixel particle sprite honors DPR 0.5.");
  assert.equal(factory.canvases[1].width, 32, "The exact-radius bullet sprite remains independent.");
  const particleDraws = ctx.calls.filter(
    (call) => call.type === "drawImage" && call.args.length === 9
  );
  const bulletDraws = ctx.calls.filter(
    (call) => call.type === "drawImage" && call.args.length === 3
  );
  assert.equal(particleDraws.length, 120);
  assert.equal(bulletDraws.length, 1);
  assert.equal(new Set(particleDraws.map((call) => call.args[0])).size, 1);
  assert.deepEqual(
    particleDraws[1].args.slice(5),
    [101 - 4.5, 161 - 4.5, 9, 9],
    "The nine-argument draw uses the exact ceil(radius * 8) logical extent."
  );

  state.view.dpr = 1.25;
  renderer.render(state, player, stageDefinitions, buckets);
  assert.equal(factory.canvases.length, 3);
  assert.equal(factory.canvases[0].width, 0, "The old-DPR particle surface is released.");
  assert.equal(factory.canvases[2].width, 80);

  renderer.dispose();
  renderer.dispose();
  assert.equal(factory.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0), true);
  const callCount = ctx.calls.length;
  renderer.render(state, player, stageDefinitions, buckets);
  assert.equal(ctx.calls.length, callCount, "A disposed renderer remains inert.");
});

test("particle and glow color caches evict their oldest entries at fixed bounds", () => {
  const particleFactory = createCanvasFactory();
  const particleCtx = createRecording2dContext();
  const renderer = createCanvasRenderer(particleCtx, {
    createCanvas: particleFactory.createCanvas,
  });
  const { state, player } = prepareStaticState();
  const particles = Array.from(
    { length: 33 },
    (_, index) => createParticle(index, `rgb(${index}, ${index + 1}, ${index + 2})`, 2)
  );

  renderer.render(state, player, stageDefinitions, createBuckets({ particles }));
  assert.equal(particleFactory.canvases.length, 33);
  assert.equal(particleFactory.canvases[0].width, 0);
  assert.equal(particleFactory.canvases.filter((canvas) => canvas.width > 0).length, 32);

  renderer.render(
    state,
    player,
    stageDefinitions,
    createBuckets({ particles: [particles[0]] })
  );
  assert.equal(particleFactory.canvases.length, 34);
  assert.equal(particleFactory.canvases[1].width, 0);
  renderer.dispose();

  const glowFactory = createCanvasFactory();
  const glowCache = createGlowSpriteCache(glowFactory.createCanvas);
  const glowCtx = createRecording2dContext();
  const resources = { dpr: 1, glowSprites: glowCache };
  for (let index = 0; index < 65; index++) {
    drawGlowCircle(
      glowCtx,
      20,
      20,
      8,
      `rgb(${index}, ${index + 1}, ${index + 2})`,
      0.2,
      resources
    );
  }
  assert.equal(glowFactory.canvases.length, 65);
  assert.equal(glowFactory.canvases[0].width, 0);
  assert.equal(glowFactory.canvases.filter((canvas) => canvas.width > 0).length, 64);
  assert.equal(
    glowCtx.calls.filter((call) => call.type === "drawImage").every((call) => call.args.length === 9),
    true
  );

  const directCtx = createRecording2dContext();
  drawGlowCircle(directCtx, 20, 20, 8, "#fff", 0.2);
  assert.equal(directCtx.calls.filter((call) => call.type === "createRadialGradient").length, 1);
  assert.equal(directCtx.calls.filter((call) => call.type === "drawImage").length, 0);

  glowCache.dispose();
  glowCache.dispose();
  assert.equal(glowFactory.canvases.every((canvas) => canvas.width === 0), true);
});

test("boss HUD reuses one DPR-aware background-gradient-foreground entry and releases replacements", () => {
  const factory = createCanvasFactory();
  const ctx = createRecording2dContext();
  const renderer = createCanvasRenderer(ctx, { createCanvas: factory.createCanvas });
  const { state, player } = prepareStaticState({ dpr: 2 });
  const boss = createBossInstance("seraph", makeBossContext(state, player));
  boss.hp = boss.maxHp * 0.5;
  boss.weakpoint = null;
  state.boss = boss;
  const buckets = createBuckets();

  renderer.render(state, player, stageDefinitions, buckets);
  const firstCanvasCount = factory.canvases.length;
  const hudCanvases = factory.canvases.filter(
    (canvas) => canvas.width > 0 && !(canvas.width === 128 && canvas.height === 128)
  );
  assert.equal(hudCanvases.length, 3);
  const background = hudCanvases.find((canvas) =>
    canvas.context.calls.some((call) => call.type === "strokeRect")
  );
  const gradient = hudCanvases.find((canvas) =>
    canvas.context.calls.some((call) => call.type === "createLinearGradient")
  );
  const foreground = hudCanvases.find((canvas) =>
    canvas.context.calls.some((call) => call.type === "fillText")
  );
  assert.ok(background);
  assert.ok(gradient);
  assert.ok(foreground);
  assert.equal(
    foreground.context.calls.filter((call) => call.type === "stroke").length,
    1,
    "Seven HUD ticks are submitted in one stroke."
  );
  const gradientDraw = ctx.calls.find(
    (call) => call.type === "drawImage" && call.args[0] === gradient
  );
  assert.ok(gradientDraw);
  assert.equal(gradientDraw.args.length, 9);
  assert.equal(gradientDraw.args[3], gradient.width * 0.5);
  assert.equal(gradientDraw.args[7], 230);

  renderer.render(state, player, stageDefinitions, buckets);
  assert.equal(factory.canvases.length, firstCanvasCount, "Stable HUD inputs reuse all three layers.");

  const beforeEmptyHp = ctx.calls.length;
  boss.hp = 0;
  renderer.render(state, player, stageDefinitions, buckets);
  assert.equal(
    ctx.calls
      .slice(beforeEmptyHp)
      .some((call) => call.type === "drawImage" && call.args[0] === gradient),
    false,
    "An empty HP bar skips the gradient draw."
  );

  boss.phaseIndex = 1;
  renderer.render(state, player, stageDefinitions, buckets);
  assert.equal(factory.canvases.length, firstCanvasCount + 3);
  assert.equal([background, gradient, foreground].every((canvas) => canvas.width === 0), true);

  renderer.dispose();
  assert.equal(factory.canvases.every((canvas) => canvas.width === 0), true);
});

test("repeated enemy, boss, HUD, and playfield primitives use batched path submissions", () => {
  const { state } = makeState();
  state.time = 10;
  const enemy = spawnEnemy(state, "halo", { x: 640, y: 200, vx: 0, vy: 0 });
  const enemyCtx = createRecording2dContext();
  drawEnemy(enemyCtx, enemy, state);
  assert.equal(enemyCtx.calls.filter((call) => call.type === "stroke").length, 4);

  const bossState = makeState();
  bossState.state.time = 10;
  const boss = createBossInstance(
    "seraph",
    makeBossContext(bossState.state, bossState.player)
  );
  boss.phaseIndex = 2;
  const bossCtx = createRecording2dContext();
  drawBossByKey(bossCtx, bossState.state, boss);
  assert.equal(bossCtx.calls.filter((call) => call.type === "stroke").length, 7);
  assert.equal(bossCtx.calls.filter((call) => call.type === "save").length, 13);

  const playfieldCtx = createRecording2dContext();
  const renderer = createCanvasRenderer(playfieldCtx);
  const staticState = prepareStaticState();
  staticState.state.playfield.active = true;
  renderer.render(
    staticState.state,
    staticState.player,
    stageDefinitions,
    createBuckets()
  );
  assert.equal(
    playfieldCtx.calls.filter((call) => call.type === "stroke").length,
    3,
    "The playfield rails, all markers, and static player HUD each use one stroke."
  );
  renderer.dispose();
});
