import { expect, test } from "@playwright/test";

async function openAndLaunch(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  page.on("requestfailed", (request) =>
    errors.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`)
  );
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await page.waitForFunction(() => Boolean(window.__astralHeresy));
  await page.getByRole("button", { name: "Launch Sortie" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__astralHeresy.debugAudioDiagnostics().workletStatus))
    .toBe("enhanced");
  return errors;
}

test("offline rendered worlds and endings stay finite, bounded, decaying, and audibly distinct", async ({
  page,
}) => {
  await page.goto("/");
  const results = await page.evaluate(async () => {
    const { createAudioEngine } = await import("/src/audio/audioEngine.js");
    const sampleRate = 12_000;

    async function render({ stageKey, event = "burst", outcome = null, duration = 4 }) {
      const context = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate);
      const audio = createAudioEngine({
        contextFactory: () => context,
        enableWorklet: false,
        seed: 0x51a7e,
      });
      audio.init();
      audio.beginRun({
        active: false,
        time: 3.25,
        stageKey,
        stageIndex: 0,
        loopIndex: 0,
        hull: 3,
        hullRatio: 0.6,
        bossKey: null,
        bossPhaseIndex: -1,
        bossProgress: 0,
        chainRatio: 0.5,
        grazeRatio: 0.45,
        densityRatio: 0.55,
        playerX: 640,
        playfieldMinX: 0,
        playfieldMaxX: 1280,
      });
      if (outcome) audio.endRun(outcome, { pan: 1 });
      else audio.playEvent(event, { pan: 1 });
      const buffer = await context.startRendering();
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);

      function windowStats(startSeconds, endSeconds) {
        const start = Math.floor(startSeconds * sampleRate);
        const end = Math.min(left.length, Math.floor(endSeconds * sampleRate));
        let sumSquares = 0;
        let sum = 0;
        let peak = 0;
        let crossings = 0;
        let rightSquares = 0;
        let previous = left[start] || 0;
        for (let index = start; index < end; index += 1) {
          const sample = left[index];
          const rightSample = right[index];
          if (!Number.isFinite(sample) || !Number.isFinite(rightSample)) {
            return { finite: false };
          }
          sumSquares += sample * sample;
          rightSquares += rightSample * rightSample;
          sum += sample;
          peak = Math.max(peak, Math.abs(sample), Math.abs(rightSample));
          if ((sample >= 0) !== (previous >= 0)) crossings += 1;
          previous = sample;
        }
        const length = Math.max(1, end - start);
        return {
          finite: true,
          rms: Math.sqrt(sumSquares / length),
          rightRms: Math.sqrt(rightSquares / length),
          dc: sum / length,
          peak,
          crossingRate: crossings / length,
        };
      }

      return {
        stageKey,
        all: windowStats(0, duration),
        impact: windowStats(0.05, 0.5),
        middle: windowStats(1.5, 2),
        tail: windowStats(2.65, 3.15),
      };
    }

    const stages = await Promise.all([
      render({ stageKey: "nebula-gate", duration: 3.2 }),
      render({ stageKey: "crystalline-choir", duration: 3.2 }),
      render({ stageKey: "abyssal-cathedral", duration: 3.2 }),
    ]);
    const hit = await render({
      stageKey: "nebula-gate",
      event: "player-hit",
      duration: 3.2,
    });
    const death = await render({
      stageKey: "nebula-gate",
      outcome: "death",
      duration: 3.2,
    });
    const victory = await render({
      stageKey: "abyssal-cathedral",
      outcome: "victory",
      duration: 3.2,
    });
    return { stages, hit, death, victory };
  });

  for (const scenario of [...results.stages, results.hit, results.death, results.victory]) {
    expect(scenario.all.finite).toBe(true);
    expect(Math.abs(scenario.all.dc)).toBeLessThan(0.02);
    expect(scenario.all.peak).toBeLessThan(0.98);
    expect(scenario.impact.rms).toBeGreaterThan(0.0001);
  }

  const signatures = results.stages.map(({ all, tail }) =>
    [all.crossingRate.toFixed(5), tail.rms.toFixed(5)].join(":")
  );
  expect(new Set(signatures).size).toBe(3);
  expect(results.death.middle.rms).toBeGreaterThan(results.hit.middle.rms * 1.5);
  expect(results.death.tail.rms).toBeLessThan(results.death.middle.rms);
  expect(results.death.middle.rms).toBeGreaterThan(0.0001);
  expect(results.victory.middle.rms).toBeGreaterThan(0.0001);
  expect(results.death.impact.rms / results.death.impact.rightRms).toBeGreaterThan(0.7);
  expect(results.death.impact.rms / results.death.impact.rightRms).toBeLessThan(1.3);
});

test("complete score renders distinct processions and survives real-browser transport stalls", async ({
  page,
}) => {
  await page.goto("/");
  const rendered = await page.evaluate(async () => {
    const { createAudioEngine } = await import("/src/audio/audioEngine.js");
    const sampleRate = 12_000;
    const duration = 8;

    async function renderScore({
      stageKey,
      stageIndex,
      bossKey = null,
      bossPhaseIndex = -1,
    }) {
      const context = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
      const audio = createAudioEngine({
        contextFactory: () => context,
        enableWorklet: false,
        seed: 0x51a7e,
        scoreLookahead: duration,
      });
      audio.init();
      audio.beginRun({
        active: true,
        time: 0,
        stageKey,
        stageIndex,
        stageProgress: bossKey ? 1 : 0.6,
        loopIndex: 0,
        hull: 5,
        hullRatio: 1,
        bossKey,
        bossPhaseIndex,
        bossPhaseProgress: 0.4,
        bossProgress: 0.4,
        chainRatio: 0.6,
        grazeRatio: 0.7,
        densityRatio: 0.55,
        playerX: 640,
        playfieldMinX: 0,
        playfieldMaxX: 1280,
      });
      const buffer = await context.startRendering();
      const channel = buffer.getChannelData(0);

      function stats(startSeconds, endSeconds) {
        const start = Math.floor(startSeconds * sampleRate);
        const end = Math.floor(endSeconds * sampleRate);
        let sum = 0;
        let squares = 0;
        let peak = 0;
        let crossings = 0;
        let previous = channel[start] || 0;
        for (let index = start; index < end; index += 1) {
          const sample = channel[index];
          sum += sample;
          squares += sample * sample;
          peak = Math.max(peak, Math.abs(sample));
          if ((sample >= 0) !== (previous >= 0)) crossings += 1;
          previous = sample;
        }
        const length = Math.max(1, end - start);
        return {
          rms: Math.sqrt(squares / length),
          dc: sum / length,
          peak,
          crossingRate: crossings / length,
        };
      }

      return {
        early: stats(0.5, 2),
        middle: stats(3, 4.5),
        late: stats(6, 7.5),
      };
    }

    return Object.fromEntries(await Promise.all([
      ["nebula", { stageKey: "nebula-gate", stageIndex: 0 }],
      [
        "seraph",
        {
          stageKey: "nebula-gate",
          stageIndex: 0,
          bossKey: "seraph",
          bossPhaseIndex: 2,
        },
      ],
      ["crystal", { stageKey: "crystalline-choir", stageIndex: 1 }],
      [
        "prism",
        {
          stageKey: "crystalline-choir",
          stageIndex: 1,
          bossKey: "prism",
          bossPhaseIndex: 2,
        },
      ],
      ["abyss", { stageKey: "abyssal-cathedral", stageIndex: 2 }],
      [
        "cathedral",
        {
          stageKey: "abyssal-cathedral",
          stageIndex: 2,
          bossKey: "cathedral",
          bossPhaseIndex: 2,
        },
      ],
    ].map(async ([key, options]) => [key, await renderScore(options)])));
  });

  for (const score of Object.values(rendered)) {
    for (const window of Object.values(score)) {
      expect(window.rms).toBeGreaterThan(0.0001);
      expect(Math.abs(window.dc)).toBeLessThan(0.02);
      expect(window.peak).toBeLessThan(0.98);
    }
    expect(
      new Set(Object.values(score).map(({ crossingRate }) => crossingRate.toFixed(5))).size
    ).toBeGreaterThan(1);
  }
  const signatures = Object.values(rendered).map(({ early, middle, late }) =>
    [
      early.crossingRate.toFixed(4),
      middle.crossingRate.toFixed(4),
      late.rms.toFixed(4),
    ].join(":")
  );
  expect(new Set(signatures).size).toBe(6);

  const errors = await openAndLaunch(page);
  await expect
    .poll(() => page.evaluate(() => window.__astralHeresy.debugAudioDiagnostics().scoreBar))
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(() => page.evaluate(() => window.__astralHeresy.debugAudioDiagnostics().rms))
    .toBeGreaterThan(0.00001);

  const beforeState = await page.evaluate(() => ({
    stageIndex: window.__astralHeresy.state.stageIndex,
    hp: window.__astralHeresy.player.hp,
  }));
  const study = await page.evaluate(() => {
    const game = window.__astralHeresy;
    game.debugSetAudioWorld({
      stageKey: "nebula-gate",
      bossKey: "seraph",
      bossPhaseIndex: 1,
      bossPhaseProgress: 0.5,
    });
    const diagnostics = game.debugSetAudioScore({
      soloBus: "harmony",
      arrangementTier: 2,
      restartPhrase: true,
    });
    return {
      diagnostics,
      invalid: game.debugSetAudioScore({ soloBus: "invalid" }),
      state: { stageIndex: game.state.stageIndex, hp: game.player.hp },
    };
  });
  expect(study.invalid).toBe(false);
  expect(study.state).toEqual(beforeState);
  expect(study.diagnostics).toMatchObject({
    scoreSectionKey: "seraph",
    scorePhaseKey: "halo-bloom",
    scoreBpm: 138,
    scoreMeter: "4/4",
    scoreArrangementTier: 2,
  });

  const skippedBefore = study.diagnostics.skippedLateScoreSteps;
  await page.evaluate(() => {
    const until = performance.now() + 900;
    while (performance.now() < until) {
      // Deliberately block the main thread while the audio clock advances.
    }
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__astralHeresy.debugAudioDiagnostics().skippedLateScoreSteps)
    )
    .toBeGreaterThan(skippedBefore);

  const finalDiagnostics = await page.evaluate(() => {
    const game = window.__astralHeresy;
    game.debugClearAudioScore();
    game.debugClearAudioWorld();
    return game.debugAudioDiagnostics();
  });
  expect(finalDiagnostics.activePercussionVoices).toBeLessThanOrEqual(12);
  expect(errors).toEqual([]);
});

test("real gameplay death rings past game over and an immediate restart severs the old graph", async ({
  page,
}) => {
  const errors = await openAndLaunch(page);
  const initial = await page.evaluate(() => {
    const game = window.__astralHeresy;
    return {
      state: {
        stageIndex: game.state.stageIndex,
        loopIndex: game.state.loopIndex,
        hp: game.player.hp,
      },
      diagnostics: game.debugAudioDiagnostics(),
      invalidCue: game.debugPlayAudioEvent("not-a-real-cue"),
    };
  });
  expect(initial.invalidCue).toBe(false);

  const overrideResult = await page.evaluate(() => {
    const game = window.__astralHeresy;
    const before = {
      stageIndex: game.state.stageIndex,
      loopIndex: game.state.loopIndex,
      hp: game.player.hp,
    };
    game.debugSetAudioWorld({
      stageKey: "crystalline-choir",
      bossKey: "prism",
      bossPhaseIndex: 2,
      chainRatio: 1,
      grazeRatio: 1,
      densityRatio: 1,
    });
    const during = game.debugAudioDiagnostics();
    game.debugClearAudioWorld();
    return {
      before,
      after: {
        stageIndex: game.state.stageIndex,
        loopIndex: game.state.loopIndex,
        hp: game.player.hp,
      },
      during,
    };
  });
  expect(overrideResult.after).toEqual(overrideResult.before);
  expect(overrideResult.during).toMatchObject({
    stageKey: "crystalline-choir",
    bossKey: "prism",
    bossPhaseIndex: 2,
  });
  expect(overrideResult.during.resonantBodies).toBeLessThanOrEqual(2);

  await page.evaluate(() => {
    const game = window.__astralHeresy;
    game.player.hp = 1;
    game.player.invuln = 0;
    game.player.activePowerups.haloShield = 0;
    game.debugSpawnEnemyBullet(game.player.x, game.player.y, 0, 0, { r: 8 });
    game.advanceTime(16);
  });
  await expect(page.locator("#end-screen")).toBeVisible();
  const ended = await page.evaluate(() => {
    const game = window.__astralHeresy;
    return {
      over: game.state.over,
      victory: game.state.victory,
      finalRunTime: game.state.finalRunTime,
      diagnostics: game.debugAudioDiagnostics(),
    };
  });
  expect(ended.over).toBe(true);
  expect(ended.victory).toBe(false);
  expect(ended.finalRunTime).not.toBeNull();
  expect(ended.diagnostics.mode).toBe("ending-death");
  expect(ended.diagnostics.endingVoices).toBeGreaterThan(0);

  await page.waitForTimeout(650);
  expect(await page.evaluate(() => window.__astralHeresy.debugAudioDiagnostics().rms)).toBeGreaterThan(0.00001);
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.__astralHeresy.debugAudioDiagnostics().rms)).toBeGreaterThan(0.00001);

  await page.keyboard.press("r");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const game = window.__astralHeresy;
        const diagnostics = game.debugAudioDiagnostics();
        return {
          over: game.state.over,
          hp: game.player.hp,
          mode: diagnostics.mode,
          retiredGraphs: diagnostics.retiredGraphs,
          resonantBodies: diagnostics.resonantBodies,
        };
      })
    )
    .toEqual({
      over: false,
      hp: 5,
      mode: "active",
      retiredGraphs: 0,
      resonantBodies: 1,
    });

  await page.evaluate(() => {
    const game = window.__astralHeresy;
    const stages = ["nebula-gate", "crystalline-choir", "abyssal-cathedral"];
    for (let index = 0; index < 90; index += 1) {
      game.debugSetAudioWorld({
        stageKey: stages[index % stages.length],
        time: index / 60,
        densityRatio: 1,
      });
      game.debugPlayAudioEvent(index % 2 ? "fire" : "graze", { pan: index % 3 - 1 });
    }
    game.debugClearAudioWorld();
  });
  const stressed = await page.evaluate(() => window.__astralHeresy.debugAudioDiagnostics());
  expect(stressed.activeVoices).toBeLessThanOrEqual(48);
  expect(stressed.resonantBodies).toBeLessThanOrEqual(2);
  await page.waitForTimeout(1400);
  const settled = await page.evaluate(() => window.__astralHeresy.debugAudioDiagnostics());
  expect(settled.resonantBodies).toBe(1);
  expect(settled.retiredGraphs).toBe(0);
  expect(errors).toEqual([]);
});
