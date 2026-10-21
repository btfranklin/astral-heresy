import { test as base, expect } from "@playwright/test";

const test = base.extend({
  browserErrors: async ({ context, page }, use) => {
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
      if (response.url().startsWith("http://127.0.0.1:") && response.status() >= 400) {
        record("response", `${response.status()} ${response.url()}`);
      }
    });
    page.on("dialog", async (dialog) => {
      record("dialog", `${dialog.type()}: ${dialog.message()}`);
      await dialog.dismiss();
    });
    context.on("weberror", (error) => record("weberror", error.error().message));

    await page.addInitScript(() => {
      window.__browserTest = {
        keyEvents: [],
        animationFrameCallbacks: 0,
        canvasClears: 0,
        mainRadialGradients: 0,
        offscreenCanvases: 0,
        webglDraws: 0,
        domMutations: 0,
      };

      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) =>
        nativeRequestAnimationFrame((timestamp) => {
          window.__browserTest.animationFrameCallbacks += 1;
          callback(timestamp);
        });

      const nativeCreateElement = Document.prototype.createElement;
      Document.prototype.createElement = function (...args) {
        const element = nativeCreateElement.apply(this, args);
        if (String(args[0]).toLowerCase() === "canvas") {
          window.__browserTest.offscreenCanvases += 1;
        }
        return element;
      };

      const nativeClearRect = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas?.id === "game") {
          window.__browserTest.canvasClears += 1;
        }
        return nativeClearRect.apply(this, args);
      };

      const nativeCreateRadialGradient = CanvasRenderingContext2D.prototype.createRadialGradient;
      CanvasRenderingContext2D.prototype.createRadialGradient = function (...args) {
        if (this.canvas?.id === "game") {
          window.__browserTest.mainRadialGradients += 1;
        }
        return nativeCreateRadialGradient.apply(this, args);
      };

      const nativeDrawArrays = WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays = function (...args) {
        if (this.canvas?.id === "bg") {
          window.__browserTest.webglDraws += 1;
        }
        return nativeDrawArrays.apply(this, args);
      };

      document.addEventListener(
        "DOMContentLoaded",
        () => {
          const observer = new MutationObserver((records) => {
            window.__browserTest.domMutations += records.length;
          });
          observer.observe(document.documentElement, {
            attributes: true,
            characterData: true,
            childList: true,
            subtree: true,
          });
        },
        { once: true }
      );

      document.addEventListener(
        "keydown",
        (event) => {
          setTimeout(() => {
            window.__browserTest.keyEvents.push({
              code: event.code,
              defaultPrevented: event.defaultPrevented,
              isTrusted: event.isTrusted,
            });
          }, 0);
        },
        true
      );
    });

    await use(errors);
    expect.soft(errors, "unexpected browser errors").toEqual([]);
  },
});

async function openGame(page, path = "/") {
  const response = await page.goto(path);
  expect(response?.ok()).toBe(true);
  await page.waitForFunction(() => Boolean(window.__astralHeresy));
  await expect.poll(() => page.evaluate(() => window.__browserTest.animationFrameCallbacks)).toBeGreaterThan(0);
  if (path.includes("mode=render")) {
    await expect(page.locator("#start-screen")).toBeHidden();
  } else {
    await expect(page.locator("#start-screen")).toBeVisible();
  }
}

async function launchWithClick(page) {
  await page.getByRole("button", { name: "Launch Sortie" }).click();
  await expect.poll(() => page.evaluate(() => window.__astralHeresy.state.started)).toBe(true);
  await expect(page.locator("#start-screen")).toBeHidden();
}

async function readRenderCounts(page) {
  return page.evaluate(() => ({
    callbacks: window.__browserTest.animationFrameCallbacks,
    canvasClears: window.__browserTest.canvasClears,
    webglDraws: window.__browserTest.webglDraws,
    domMutations: window.__browserTest.domMutations,
  }));
}

test("boots real modules, renders with Canvas and WebGL, and initializes audio after a gesture", async ({
  page,
  context,
  browserErrors: _browserErrors,
}, testInfo) => {
  const cdp = await context.newCDPSession(page);
  const audioContexts = new Map();
  cdp.on("WebAudio.contextCreated", ({ context: audioContext }) => {
    audioContexts.set(audioContext.contextId, audioContext);
  });
  cdp.on("WebAudio.contextChanged", ({ context: audioContext }) => {
    audioContexts.set(audioContext.contextId, audioContext);
  });
  await cdp.send("WebAudio.enable");

  await openGame(page);
  expect(audioContexts.size).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__browserTest.animationFrameCallbacks)).toBeGreaterThan(1);

  const initialSurface = await page.evaluate(() => {
    const gameCanvas = document.getElementById("game");
    const backgroundCanvas = document.getElementById("bg");
    const gl = backgroundCanvas.getContext("webgl");
    return {
      has2d: Boolean(gameCanvas.getContext("2d")),
      hasWebgl: Boolean(gl),
      glError: gl?.getError(),
      noError: gl?.NO_ERROR,
      gameSize: [gameCanvas.width, gameCanvas.height],
      backgroundSize: [backgroundCanvas.width, backgroundCanvas.height],
    };
  });
  expect(initialSurface.has2d).toBe(true);
  expect(initialSurface.hasWebgl).toBe(true);
  expect(initialSurface.glError).toBe(initialSurface.noError);
  expect(initialSurface.gameSize).toEqual([1280, 720]);
  expect(initialSurface.backgroundSize).toEqual([1280, 720]);

  await launchWithClick(page);
  await expect.poll(() => audioContexts.size).toBe(1);
  await expect
    .poll(() => [...audioContexts.values()][0]?.contextState)
    .toBe("running");
  await expect
    .poll(() => page.evaluate(() => window.__astralHeresy.debugAudioDiagnostics().workletStatus))
    .toBe("enhanced");

  const renderedPixels = await page.evaluate(() => {
    window.advanceTime(16);
    const gameCanvas = document.getElementById("game");
    const ctx = gameCanvas.getContext("2d");
    const pixels = ctx.getImageData(0, 0, gameCanvas.width, gameCanvas.height).data;
    let visibleSamples = 0;
    for (let index = 0; index < pixels.length; index += 4 * 97) {
      if (pixels[index + 3] > 0 && (pixels[index] || pixels[index + 1] || pixels[index + 2])) {
        visibleSamples += 1;
      }
    }

    const gl = document.getElementById("bg").getContext("webgl");
    const pixel = new Uint8Array(4);
    gl.readPixels(640, 360, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return { visibleSamples, backgroundPixel: [...pixel], glError: gl.getError(), noError: gl.NO_ERROR };
  });
  expect(renderedPixels.visibleSamples).toBeGreaterThan(0);
  expect(renderedPixels.backgroundPixel.some((value) => value > 0)).toBe(true);
  expect(renderedPixels.glError).toBe(renderedPixels.noError);
  await page.screenshot({ path: testInfo.outputPath("startup-and-combat.png") });
  await cdp.detach();
});

test("repeats seeded gameplay after restart and reload", async ({ page, browserErrors: _browserErrors }) => {
  const replay = () => page.evaluate(() => {
    const game = window.__astralHeresy;
    game.resetGame(true);
    game.player.invuln = 60;
    game.state.input.KeyZ = true;
    game.debugSpawnPickup("beam", 280, 140, { spawnPause: 0 });
    game.advanceTime(8000);
    return {
      seed: JSON.parse(game.renderGameToText()).seed,
      score: game.state.score,
      kills: game.state.kills,
      entities: game.state.entities
        .filter(({ type }) => type !== "particle")
        .map(({ id, type, components }) => ({ id, type, components })),
    };
  });

  for (const seed of [42, 0]) {
    await openGame(page, `/?seed=${seed}`);
    await launchWithClick(page);
    const first = await replay();
    expect(first.seed).toBe(seed);
    expect(first.entities.some(({ type }) => type === "enemyBullet")).toBe(true);
    expect(await replay()).toEqual(first);
    await openGame(page, `/?seed=${seed}`);
    await launchWithClick(page);
    expect(await replay()).toEqual(first);
    if (seed === 42) {
      await openGame(page, "/?seed=43");
      await launchWithClick(page);
      expect((await replay()).entities).not.toEqual(first.entities);
    }
  }

  await openGame(page, "/?seed=invalid");
  expect(await page.evaluate(() => window.__astralHeresy.state.randomSeed)).toBeNull();
  await launchWithClick(page);
});

test("keeps idle animation callbacks alive while invalidating only changed render surfaces", async ({
  page,
  browserErrors: _browserErrors,
}) => {
  await openGame(page);
  await expect.poll(() => page.evaluate(() => window.__browserTest.canvasClears)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__browserTest.webglDraws)).toBeGreaterThan(0);

  const idleStart = await readRenderCounts(page);
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.animationFrameCallbacks))
    .toBeGreaterThanOrEqual(idleStart.callbacks + 30);
  expect(await readRenderCounts(page)).toMatchObject({
    canvasClears: idleStart.canvasClears,
    webglDraws: idleStart.webglDraws,
  });

  const mutationsBeforeForcedProjection = await page.evaluate(
    () => window.__browserTest.domMutations
  );
  await page.evaluate(() => window.advanceTime(16));
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.canvasClears))
    .toBeGreaterThan(idleStart.canvasClears);
  await page.evaluate(() => new Promise((resolve) => queueMicrotask(resolve)));
  expect(await page.evaluate(() => window.__browserTest.domMutations)).toBe(
    mutationsBeforeForcedProjection
  );

  const beforeResize = await readRenderCounts(page);
  await page.setViewportSize({ width: 1100, height: 680 });
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.canvasClears))
    .toBeGreaterThan(beforeResize.canvasClears);
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.webglDraws))
    .toBeGreaterThan(beforeResize.webglDraws);
  const resized = await readRenderCounts(page);
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.animationFrameCallbacks))
    .toBeGreaterThanOrEqual(resized.callbacks + 30);
  expect(await readRenderCounts(page)).toMatchObject({
    canvasClears: resized.canvasClears,
    webglDraws: resized.webglDraws,
  });

  await launchWithClick(page);
  const active = await readRenderCounts(page);
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.canvasClears))
    .toBeGreaterThan(active.canvasClears + 2);
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.webglDraws))
    .toBeGreaterThan(active.webglDraws + 2);

  await page.evaluate(() => {
    const game = window.__astralHeresy;
    game.state.over = true;
    game.state.entities = [];
    game.state.shake = 0;
    game.player.hp = 0;
  });
  const settlingStart = await readRenderCounts(page);
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.animationFrameCallbacks))
    .toBeGreaterThanOrEqual(settlingStart.callbacks + 5);
  const settled = await readRenderCounts(page);
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.animationFrameCallbacks))
    .toBeGreaterThanOrEqual(settled.callbacks + 30);
  expect(await readRenderCounts(page)).toMatchObject({
    canvasClears: settled.canvasClears,
    webglDraws: settled.webglDraws,
  });
});

test("keeps the background glow at the ship position", async ({ page, browserErrors: _browserErrors }) => {
  await openGame(page);
  const samples = await page.evaluate(() => {
    const game = window.__astralHeresy;
    const gl = document.getElementById("bg").getContext("webgl");
    const pixel = new Uint8Array(4);
    function readGreen(playerY) {
      game.player.x = 640;
      game.player.y = playerY;
      game.advanceTime(0);
      gl.readPixels(640, 100, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return pixel[1];
    }
    return { far: readGreen(120), near: readGreen(620), error: gl.getError() };
  });
  expect(samples.near - samples.far).toBeGreaterThan(10);
  expect(samples.error).toBe(0);
});

test("projects representative gameplay state into the real HUD DOM", async ({
  page,
  browserErrors: _browserErrors,
}) => {
  await openGame(page);
  await expect(page.locator("#interface")).toHaveAttribute("data-mode", "idle");
  await expect(page.locator("#stage-name")).toHaveText("Nebula Gate");
  await expect(page.locator("#run-time")).toHaveText("00:00");
  await expect(page.locator("#score-value")).toHaveText("0");
  await expect(page.locator("#graze-value")).toHaveText("0%");
  await expect(page.locator("#weapon-value")).toHaveText("Standard");
  await expect(page.locator("#hull-pips .hull-pip")).toHaveCount(5);
  await expect(page.locator("#burst-stocks .stock-pip")).toHaveCount(2);
  await expect(page.locator("#effect-strip .effect-chip")).toHaveCount(6);

  await launchWithClick(page);
  await page.evaluate(() => {
    const game = window.__astralHeresy;
    game.debugSpawnPickup("beam", game.player.x, game.player.y);
    game.debugSpawnPickup("halo-shield", game.player.x, game.player.y);
    window.advanceTime(16);
    game.state.score = 12_345;
    game.state.kills = 7;
    game.state.shotsFired = 10;
    game.state.shotsHit = 8;
    game.state.grazeCharge = 45;
    game.state.chainLevel = 2;
    game.state.chainTimer = 2;
    game.state.burstStocks = 2;
    game.player.hp = 3;
  });

  await expect(page.locator("#interface")).toHaveAttribute("data-mode", "combat");
  await expect(page.locator("#score-value")).toHaveText("12,345");
  await expect(page.locator("#kill-value")).toHaveText("7");
  await expect(page.locator("#accuracy-value")).toHaveText("80%");
  await expect(page.locator("#chain-value")).toHaveText("x1.30");
  await expect(page.locator("#graze-value")).toHaveText("45%");
  await expect(page.locator("#weapon-value")).toContainText("Beam");
  await expect(page.locator("#hull-pips .hull-pip.is-full")).toHaveCount(3);
  await expect(page.locator("#burst-stocks .stock-pip.is-full")).toHaveCount(2);
  await expect(page.locator("#effect-strip .effect-chip:not(.hidden)")).toHaveCount(2);
  await expect(page.locator("#effect-strip")).toContainText("Beam");
  await expect(page.locator("#effect-strip")).toContainText("Shield");
});

test("uses native keyboard, pointer, blur, visibility, and restart behavior", async ({
  page,
  browserErrors: _browserErrors,
}) => {
  await openGame(page);
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__astralHeresy.state.started)).toBe(true);

  await page.keyboard.down("z");
  await expect.poll(() => page.evaluate(() => window.__astralHeresy.state.input.KeyZ)).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => window.__browserTest.keyEvents.findLast((event) => event.code === "KeyZ"))
    )
    .toMatchObject({ code: "KeyZ", defaultPrevented: true, isTrusted: true });

  const canvasBox = await page.locator("#game").boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 260);
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() => window.__astralHeresy.state.input.PointerFire)).toBe(true);
  const pointer = await page.evaluate(() => ({
    x: window.__astralHeresy.state.input.pointerX,
    y: window.__astralHeresy.state.input.pointerY,
  }));
  expect(pointer.x).toBeCloseTo(180, 0);
  expect(pointer.y).toBeCloseTo(260, 0);

  await page.keyboard.down("a");
  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.dataset.browserTest = "blur-target";
    frame.srcdoc = '<button type="button">Focus another document</button>';
    document.body.append(frame);
  });
  await page
    .frameLocator('iframe[data-browser-test="blur-target"]')
    .getByRole("button", { name: "Focus another document" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        fire: window.__astralHeresy.state.input.KeyZ,
        left: window.__astralHeresy.state.input.KeyA,
        pointerFire: window.__astralHeresy.state.input.PointerFire,
        pointerX: window.__astralHeresy.state.input.pointerX,
        pointerY: window.__astralHeresy.state.input.pointerY,
      }))
    )
    .toEqual({ fire: false, left: false, pointerFire: false, pointerX: null, pointerY: null });
  await page.keyboard.up("z");
  await page.keyboard.up("a");
  await page.mouse.up();
  await page.evaluate(() => document.querySelector('iframe[data-browser-test="blur-target"]').remove());

  await page.keyboard.down("z");
  await page.keyboard.down("a");
  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 260);
  await page.mouse.down();
  await page.evaluate(() => {
    localStorage.removeItem("browser-visibility-snapshot");
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "hidden") return;
      localStorage.setItem(
        "browser-visibility-snapshot",
        JSON.stringify({
          visibilityState: document.visibilityState,
          fire: window.__astralHeresy.state.input.KeyZ,
          left: window.__astralHeresy.state.input.KeyA,
          pointerFire: window.__astralHeresy.state.input.PointerFire,
          pointerX: window.__astralHeresy.state.input.pointerX,
          pointerY: window.__astralHeresy.state.input.pointerY,
        })
      );
    });
  });
  await openGame(page, "/?visibility-return=1");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("browser-visibility-snapshot")))
  ).toEqual({ visibilityState: "hidden", fire: false, left: false, pointerFire: false, pointerX: null, pointerY: null });

  await launchWithClick(page);
  await page.keyboard.down("m");
  await expect.poll(() => page.evaluate(() => window.__astralHeresy.state.input.pointerEnabled)).toBe(false);
  await page.keyboard.down("m");
  expect(await page.evaluate(() => window.__astralHeresy.state.input.pointerEnabled)).toBe(false);
  await page.keyboard.up("m");

  await page.evaluate(() => {
    window.__astralHeresy.state.over = true;
    window.__astralHeresy.player.hp = 0;
  });
  await page.keyboard.press("r");
  await expect
    .poll(() =>
      page.evaluate(() => ({
        started: window.__astralHeresy.state.started,
        over: window.__astralHeresy.state.over,
        hp: window.__astralHeresy.player.hp,
      }))
    )
    .toEqual({ started: true, over: false, hp: 5 });
});

test("resizes real canvas geometry and clamps active player and pointer state", async ({
  page,
  browserErrors: _browserErrors,
}) => {
  await openGame(page);
  await page.setViewportSize({ width: 900, height: 720 });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        width: window.__astralHeresy.state.view.width,
        height: window.__astralHeresy.state.view.height,
        canvas: [document.getElementById("game").width, document.getElementById("game").height],
        rect: [document.getElementById("game").getBoundingClientRect().width, document.getElementById("game").getBoundingClientRect().height],
        playfieldActive: window.__astralHeresy.state.playfield.active,
      }))
    )
    .toEqual({ width: 900, height: 720, canvas: [900, 720], rect: [900, 720], playfieldActive: false });

  await launchWithClick(page);
  await page.evaluate(() => {
    const game = window.__astralHeresy;
    game.state.over = true;
    game.player.x = 880;
    game.player.y = 700;
    game.state.input.pointerX = 880;
    game.state.input.pointerY = 700;
  });
  await page.setViewportSize({ width: 520, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const game = window.__astralHeresy;
        return (
          game.player.x <= game.state.playfield.maxX &&
          game.player.y <= game.state.playfield.maxY &&
          game.state.input.pointerX <= game.state.playfield.maxX &&
          game.state.input.pointerY <= game.state.playfield.maxY
        );
      })
    )
    .toBe(true);
});

test("lets keyboard and pointer movement reach the measured hull panel boundary across viewports", async ({
  page,
  browserErrors: _browserErrors,
}) => {
  await openGame(page);
  await launchWithClick(page);
  await page.evaluate(() => {
    window.__astralHeresy.player.invuln = 1_000_000;
  });

  const viewports = [
    { width: 565, height: 866 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 900, height: 720 },
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() => page.evaluate(() => window.__astralHeresy.state.view.height))
      .toBe(viewport.height);

    const geometry = await page.evaluate(() => {
      const game = window.__astralHeresy;
      const canvas = document.getElementById("game").getBoundingClientRect();
      const hull = document.getElementById("hull-panel").getBoundingClientRect();
      return {
        canvas: { left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height },
        hullTop: hull.top,
        maxY: game.state.playfield.maxY,
      };
    });
    const expectedMaxY = Math.min(
      viewport.height,
      geometry.hullTop - geometry.canvas.top
    ) - 32;
    expect(geometry.maxY).toBeCloseTo(expectedMaxY, 0);

    await page.keyboard.press("m");
    await page.keyboard.down("ArrowDown");
    await expect
      .poll(() => page.evaluate(() => window.__astralHeresy.player.y))
      .toBeGreaterThan(expectedMaxY - 2);
    await page.keyboard.up("ArrowDown");

    await page.keyboard.press("m");
    await page.mouse.move(
      geometry.canvas.left + geometry.canvas.width / 2,
      geometry.canvas.top + Math.min(200, expectedMaxY - 100)
    );
    await expect
      .poll(() => page.evaluate(() => window.__astralHeresy.player.y))
      .toBeLessThan(expectedMaxY - 80);

    await page.mouse.move(
      geometry.canvas.left + geometry.canvas.width / 2,
      geometry.canvas.top + expectedMaxY
    );
    await expect
      .poll(() => page.evaluate(() => window.__astralHeresy.state.input.pointerY))
      .toBeCloseTo(expectedMaxY, 0);
    await expect
      .poll(() => page.evaluate(() => window.__astralHeresy.player.y))
      .toBeGreaterThan(expectedMaxY - 2);

    const finalPosition = await page.evaluate(() => {
      const game = window.__astralHeresy;
      const hullTop =
        document.getElementById("hull-panel").getBoundingClientRect().top -
        document.getElementById("game").getBoundingClientRect().top;
      return { playerY: game.player.y, maxY: game.state.playfield.maxY, hullTop };
    });
    expect(finalPosition.playerY).toBeCloseTo(finalPosition.maxY, 0);
    expect(finalPosition.hullTop - finalPosition.playerY).toBeGreaterThanOrEqual(31);
    expect(finalPosition.hullTop - finalPosition.playerY).toBeLessThanOrEqual(33);

    await page.evaluate(() => {
      window.__astralHeresy.state.over = true;
      window.__astralHeresy.player.hp = 0;
    });
    await page.keyboard.press("r");
    await expect.poll(() => page.evaluate(() => window.__astralHeresy.state.over)).toBe(false);
    await expect
      .poll(() => page.evaluate(() => window.__astralHeresy.state.playfield.maxY))
      .toBeCloseTo(expectedMaxY, 0);
  }

  const beforeHudGrowth = await page.evaluate(() => ({
    hullTop: document.getElementById("hull-panel").getBoundingClientRect().top,
    maxY: window.__astralHeresy.state.playfield.maxY,
  }));
  await page.locator("#hull-panel").evaluate((panel) => {
    panel.style.height = "120px";
  });
  await expect
    .poll(() => page.evaluate(() => window.__astralHeresy.state.playfield.maxY))
    .toBeLessThan(beforeHudGrowth.maxY - 20);
  const afterHudGrowth = await page.evaluate(() => ({
    hullTop: document.getElementById("hull-panel").getBoundingClientRect().top,
    maxY: window.__astralHeresy.state.playfield.maxY,
  }));
  expect(afterHudGrowth.maxY).toBeCloseTo(afterHudGrowth.hullTop - 32, 0);
});

test.describe("high-DPR browser context", () => {
  test.use({ deviceScaleFactor: 2, viewport: { width: 640, height: 480 } });

  test("keeps gameplay native while capping the background backing DPR", async ({
    page,
    browserErrors: _browserErrors,
  }) => {
    await openGame(page);
    const dimensions = await page.evaluate(() => ({
      dpr: window.devicePixelRatio,
      game: [document.getElementById("game").width, document.getElementById("game").height],
      background: [document.getElementById("bg").width, document.getElementById("bg").height],
    }));
    expect(dimensions).toEqual({ dpr: 2, game: [1280, 960], background: [960, 720] });
  });
});

test("renders deterministic showcase surfaces in the real browser", async ({
  page,
  browserErrors: _browserErrors,
}, testInfo) => {
  test.setTimeout(60_000);
  const scenarios = [
    ...["cherub", "halo", "oracle", "shard", "weaver", "harp", "spear", "throne", "fang"].map((key) => ({
      name: `enemy-${key}`,
      path: `/?mode=render&enemy=${key}`,
      showcase: { type: "enemy", key },
      target: { type: "enemy", key },
    })),
    ...["seraph", "prism", "cathedral"].flatMap((key) => [1, 2, 3].map((phase) => ({
      name: `boss-${key}-${phase}`,
      path: `/?mode=render&boss=${key}&phase=${phase}`,
      showcase: { type: "boss", key, phase },
      target: { type: "boss", key, phaseIndex: phase - 1 },
    }))),
  ];

  for (const scenario of scenarios) {
    await openGame(page, scenario.path);
    const surface = await page.evaluate(() => {
      window.advanceTime(16);
      const game = window.__astralHeresy;
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");
      let target = null;

      if (game.state.showcase.type === "enemy") {
        const enemy = game.state.entities.find((entity) => entity.type === "enemy");
        const position = enemy?.components.position;
        const collider = enemy?.components.collider;
        const render = enemy?.components.render;
        if (position && collider && render) {
          target = {
            type: "enemy",
            key: render.renderKey,
            x: position.x,
            y: position.y,
            cropRadius: collider.r * 0.8,
          };
        }
      } else if (game.state.boss) {
        target = {
          type: "boss",
          key: game.state.boss.renderKey,
          phaseIndex: game.state.boss.phaseIndex,
          x: game.state.boss.x,
          y: game.state.boss.y,
          cropRadius: game.state.boss.r * 0.45,
        };
      }

      if (!target) {
        return { showcase: game.state.showcase, target: null, targetVisiblePixels: 0 };
      }

      const dpr = game.state.view.dpr;
      const left = Math.max(0, Math.floor((target.x - target.cropRadius) * dpr));
      const top = Math.max(0, Math.floor((target.y - target.cropRadius) * dpr));
      const right = Math.min(canvas.width, Math.ceil((target.x + target.cropRadius) * dpr));
      const bottom = Math.min(canvas.height, Math.ceil((target.y + target.cropRadius) * dpr));
      const pixels = ctx.getImageData(left, top, right - left, bottom - top).data;
      let targetVisiblePixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (
          pixels[index + 3] > 0 &&
          (pixels[index] > 0 || pixels[index + 1] > 0 || pixels[index + 2] > 0)
        ) {
          targetVisiblePixels += 1;
        }
      }

      return {
        showcase: game.state.showcase,
        target: {
          type: target.type,
          key: target.key,
          phaseIndex: target.phaseIndex,
        },
        targetVisiblePixels,
      };
    });
    expect(surface.showcase).toMatchObject(scenario.showcase);
    expect(surface.target).toMatchObject(scenario.target);
    expect(surface.targetVisiblePixels).toBeGreaterThan(25);
    await page.screenshot({ path: testInfo.outputPath(`${scenario.name}.png`) });
  }
});

test("reuses DPR-aware glow, HUD, and normalized particle sprites", async ({
  page,
  browserErrors: _browserErrors,
}) => {
  await openGame(page, "/?mode=render&boss=seraph&phase=3");
  const warmupStart = await page.evaluate(() => window.__browserTest.animationFrameCallbacks);
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.animationFrameCallbacks))
    .toBeGreaterThanOrEqual(warmupStart + 10);
  const warmed = await page.evaluate(() => ({
    callbacks: window.__browserTest.animationFrameCallbacks,
    offscreenCanvases: window.__browserTest.offscreenCanvases,
    mainRadialGradients: window.__browserTest.mainRadialGradients,
  }));
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.animationFrameCallbacks))
    .toBeGreaterThanOrEqual(warmed.callbacks + 20);
  expect(
    await page.evaluate(() => ({
      offscreenCanvases: window.__browserTest.offscreenCanvases,
      mainRadialGradients: window.__browserTest.mainRadialGradients,
    }))
  ).toEqual({
    offscreenCanvases: warmed.offscreenCanvases,
    mainRadialGradients: warmed.mainRadialGradients,
  });

  await page.evaluate(async () => {
    const game = window.__astralHeresy;
    const { spawnParticle } = await import("/src/systems/particleSystem.js");
    spawnParticle(game.state, 640, 360, "#123456", 120, 0, 999, 4);
    game.state.entities
      .filter((entity) => entity.type === "particle")
      .forEach((particle, index) => {
        particle.components.render.size = 1 + index / 40;
      });
  });
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.offscreenCanvases))
    .toBe(warmed.offscreenCanvases + 1);

  const afterFirstColor = await page.evaluate(() => ({
    callbacks: window.__browserTest.animationFrameCallbacks,
    offscreenCanvases: window.__browserTest.offscreenCanvases,
  }));
  await expect
    .poll(() => page.evaluate(() => window.__browserTest.animationFrameCallbacks))
    .toBeGreaterThanOrEqual(afterFirstColor.callbacks + 20);
  expect(await page.evaluate(() => window.__browserTest.offscreenCanvases)).toBe(
    afterFirstColor.offscreenCanvases
  );
});

test("opens the creator website with Enter without restarting defeat or victory results", async ({
  context,
  page,
  browserErrors: _browserErrors,
}, testInfo) => {
  await context.route("https://btfranklin.info/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Creator website test</title>" })
  );
  await openGame(page);
  await launchWithClick(page);

  for (const victory of [false, true]) {
    await page.evaluate((isVictory) => {
      const game = window.__astralHeresy;
      game.state.over = true;
      game.state.victory = isVictory;
      game.player.hp = isVictory ? 5 : 0;
      game.advanceTime(16);
    }, victory);
    await expect(page.locator("#end-screen")).toBeVisible();
    await expect(page.getByRole("heading", { name: victory ? "Convergence Complete" : "Ship Lost", exact: true })).toBeVisible();
    await expect.poll(() => page.locator("#end-screen").evaluate((screen) => getComputedStyle(screen).opacity)).toBe("1");
    const link = page.getByRole("link", { name: "btfranklin.info", exact: true });
    await expect(link).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath(`creator-credit-${victory ? "victory" : "defeat"}.png`) });
    const [website] = await Promise.all([
      context.waitForEvent("page", { timeout: 5000 }),
      link.press("Enter"),
    ]);
    await expect(website).toHaveURL("https://btfranklin.info/");
    expect(await website.evaluate(() => window.opener)).toBeNull();
    await website.close();
    await expect(page.locator("#end-screen")).toBeVisible();
    expect(await page.evaluate(() => window.__astralHeresy.state.over)).toBe(true);
  }
});

test("keeps launch, restart, and creator link reachable on short viewports", async ({ page, browserErrors: _browserErrors }, testInfo) => {
  for (const viewport of [{ width: 390, height: 420 }, { width: 1280, height: 360 }]) {
    await page.setViewportSize(viewport);
    await openGame(page);
    await expect(page.getByRole("heading", { name: "Astral Heresy" })).toBeInViewport({ ratio: 1 });
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 2000);
    await expect(page.getByRole("button", { name: "Launch Sortie" })).toBeInViewport({ ratio: 1 });
    await launchWithClick(page);
    await page.evaluate(() => {
      window.__astralHeresy.state.over = true;
      window.__astralHeresy.player.hp = 0;
    });
    await expect(page.locator("#end-screen")).toBeVisible();
    await expect.poll(() => page.locator("#end-screen").evaluate((screen) => getComputedStyle(screen).opacity)).toBe("1");
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 2000);
    await expect(page.getByRole("button", { name: "Fly Again" })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("link", { name: "btfranklin.info", exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath(`creator-credit-${viewport.width}x${viewport.height}.png`) });
    await page.getByRole("button", { name: "Fly Again" }).click();
    await expect.poll(() => page.evaluate(() => window.__astralHeresy.state.over)).toBe(false);
  }
});

test("restores the WebGL background after context loss while idle", async ({ page, browserErrors: _browserErrors }) => {
  await openGame(page);
  const initialDraws = await page.evaluate(() => {
    const canvas = document.getElementById("bg");
    const gl = canvas.getContext("webgl");
    window.__contextLossExtension = gl.getExtension("WEBGL_lose_context");
    if (!window.__contextLossExtension) throw new Error("Context-loss extension is unavailable.");
    const drawArrays = gl.drawArrays.bind(gl);
    gl.drawArrays = (...args) => {
      drawArrays(...args);
      const pixel = new Uint8Array(4);
      gl.readPixels(640, 360, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      window.__restoredSurface = {
        pixel: [...pixel],
        error: gl.getError(),
        mode: window.__astralHeresy.renderGameToText(),
      };
    };
    window.__contextLossExtension.loseContext();
    return window.__browserTest.webglDraws;
  });
  await expect.poll(() => page.evaluate(() => document.getElementById("bg").getContext("webgl").isContextLost())).toBe(true);
  await page.evaluate(() => window.__contextLossExtension.restoreContext());
  await expect.poll(() => page.evaluate(() => document.getElementById("bg").getContext("webgl").isContextLost())).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__browserTest.webglDraws)).toBeGreaterThan(initialDraws);
  const rendered = await page.evaluate(() => window.__restoredSurface);
  expect(rendered.pixel.some((value) => value > 0)).toBe(true);
  expect(rendered.error).toBe(0);
  expect(JSON.parse(rendered.mode).mode).toBe("start");
});

test("dispose releases browser resources and ignores later browser events", async ({
  page,
  context,
  browserErrors: _browserErrors,
}) => {
  const cdp = await context.newCDPSession(page);
  const audioContexts = new Map();
  cdp.on("WebAudio.contextCreated", ({ context: audioContext }) => audioContexts.set(audioContext.contextId, audioContext));
  cdp.on("WebAudio.contextChanged", ({ context: audioContext }) => audioContexts.set(audioContext.contextId, audioContext));
  await cdp.send("WebAudio.enable");

  await openGame(page);
  await launchWithClick(page);
  await expect.poll(() => page.evaluate(() => window.__astralHeresy.state.time)).toBeGreaterThan(0);
  await expect.poll(() => audioContexts.size).toBe(1);

  const beforeDispose = await page.evaluate(async () => {
    const game = window.__astralHeresy;
    await game.dispose();
    await game.dispose();
    return {
      time: game.state.time,
      frames: window.__browserTest.animationFrameCallbacks,
      canvas: [document.getElementById("game").width, document.getElementById("game").height],
    };
  });
  await page.waitForTimeout(150);
  await page.keyboard.down("z");
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.up();
  await page.setViewportSize({ width: 900, height: 600 });

  const afterDispose = await page.evaluate(() => ({
    time: window.__astralHeresy.state.time,
    frames: window.__browserTest.animationFrameCallbacks,
    canvas: [document.getElementById("game").width, document.getElementById("game").height],
    keyZ: window.__astralHeresy.state.input.KeyZ,
    pointerFire: window.__astralHeresy.state.input.PointerFire,
  }));
  expect(afterDispose).toEqual({
    ...beforeDispose,
    keyZ: false,
    pointerFire: false,
  });
  await expect.poll(() => [...audioContexts.values()][0]?.contextState).toBe("closed");
  await page.keyboard.up("z");
  await cdp.detach();
});
