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
      };

      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) =>
        nativeRequestAnimationFrame((timestamp) => {
          window.__browserTest.animationFrameCallbacks += 1;
          callback(timestamp);
        });

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
      }))
    )
    .toEqual({ fire: false, left: false, pointerFire: false });
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
        })
      );
    });
  });
  await openGame(page, "/?visibility-return=1");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("browser-visibility-snapshot")))
  ).toEqual({ visibilityState: "hidden", fire: false, left: false, pointerFire: false });

  await launchWithClick(page);
  await page.keyboard.press("m");
  await expect.poll(() => page.evaluate(() => window.__astralHeresy.state.input.pointerEnabled)).toBe(false);

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

test.describe("high-DPR browser context", () => {
  test.use({ deviceScaleFactor: 2, viewport: { width: 640, height: 480 } });

  test("matches canvas backing dimensions to the browser DPR", async ({
    page,
    browserErrors: _browserErrors,
  }) => {
    await openGame(page);
    const dimensions = await page.evaluate(() => ({
      dpr: window.devicePixelRatio,
      game: [document.getElementById("game").width, document.getElementById("game").height],
      background: [document.getElementById("bg").width, document.getElementById("bg").height],
    }));
    expect(dimensions).toEqual({ dpr: 2, game: [1280, 960], background: [1280, 960] });
  });
});

test("renders deterministic showcase surfaces in the real browser", async ({
  page,
  browserErrors: _browserErrors,
}, testInfo) => {
  for (const [name, path] of [
    ["enemy-halo", "/?mode=render&enemy=halo"],
    ["boss-prism", "/?mode=render&boss=prism&phase=2"],
  ]) {
    await openGame(page, path);
    await expect.poll(() => page.evaluate(() => window.__astralHeresy.state.showcase?.type)).not.toBeNull();
    const surface = await page.evaluate(() => {
      window.advanceTime(16);
      const canvas = document.getElementById("game");
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let visible = 0;
      for (let index = 3; index < pixels.length; index += 4 * 83) {
        if (pixels[index] > 0) visible += 1;
      }
      return { visible, showcase: window.__astralHeresy.state.showcase.type };
    });
    expect(surface.visible).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  }
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
