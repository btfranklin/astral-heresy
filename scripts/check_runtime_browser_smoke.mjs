#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output", "playwright", "runtime-smoke");
const PORT = process.env.PORT || "8040";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SESSION = `ahsmoke-${Date.now().toString(36)}`;
const PLAYWRIGHT_ARGS = ["--yes", "--package", "@playwright/mcp", "playwright-cli", "--session", SESSION];
const PLAYWRIGHT_KILL_PATTERN = "playwright-mcp|Google Chrome for Testing.*playwright_chromiumdev_profile";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runPwcli(...args) {
  try {
    const stdout = execFileSync("npx", [...PLAYWRIGHT_ARGS, ...args], {
      cwd: OUTPUT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    if (stdout.includes("### Error")) {
      throw new Error(stdout.trim());
    }
    return stdout;
  } catch (error) {
    const stdout = error.stdout?.toString() || "";
    const stderr = error.stderr?.toString() || "";
    const message = [stdout.trim(), stderr.trim(), error.message].filter(Boolean).join("\n");
    throw new Error(message);
  }
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function findPythonCommand() {
  if (commandExists("python3")) return "python3";
  if (commandExists("python")) return "python";
  throw new Error("Python is required to run the browser smoke server.");
}

function cleanupPlaywrightProcesses() {
  for (const signal of ["-TERM", "-KILL"]) {
    try {
      execFileSync("pkill", [signal, "-f", PLAYWRIGHT_KILL_PATTERN], { stdio: "ignore" });
    } catch {
      // No stale process matched the scoped Playwright cleanup pattern.
    }
  }
}

function extractResult(output) {
  const marker = "### Result";
  const index = output.lastIndexOf(marker);
  if (index === -1) {
    throw new Error(`Expected a Playwright CLI result block.\n${output}`);
  }

  const tail = output.slice(index + marker.length).trimStart();
  const nextHeadingIndex = tail.indexOf("\n### ");
  return (nextHeadingIndex === -1 ? tail : tail.slice(0, nextHeadingIndex)).trim();
}

function evalJson(expression) {
  const output = runPwcli("eval", expression);
  return JSON.parse(JSON.parse(extractResult(output)));
}

async function main() {
  if (!commandExists("npx")) {
    throw new Error("npx is required to run the browser smoke script.");
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const python = findPythonCommand();
  const server = spawn(python, ["-m", "http.server", PORT, "--directory", REPO_ROOT], {
    cwd: REPO_ROOT,
    stdio: "ignore",
  });

  await sleep(500);

  try {
    runPwcli("open", `${BASE_URL}/`);
    const beforeLaunch = evalJson(
      "(() => { return JSON.stringify({ startVisible: !document.getElementById('start-screen').classList.contains('hidden'), statusCopy: document.getElementById('status-copy').textContent }); })()"
    );
    if (!beforeLaunch.startVisible || beforeLaunch.statusCopy !== "Awaiting launch clearance") {
      throw new Error(`Unexpected pre-launch state: ${JSON.stringify(beforeLaunch)}`);
    }

    const afterLaunch = evalJson(
      "(() => { document.getElementById('start-button').click(); return JSON.stringify({ started: window.__astralHeresy.state.started, startHidden: document.getElementById('start-screen').classList.contains('hidden'), textState: Boolean(window.render_game_to_text), advanceTime: Boolean(window.advanceTime) }); })()"
    );
    if (!afterLaunch.started || !afterLaunch.startHidden || !afterLaunch.textState || !afterLaunch.advanceTime) {
      throw new Error(`Unexpected launch state: ${JSON.stringify(afterLaunch)}`);
    }

    const afterRestart = evalJson(
      "(() => { window.__astralHeresy.state.over = true; window.__astralHeresy.player.hp = 0; document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true, cancelable: true })); return JSON.stringify({ started: window.__astralHeresy.state.started, over: window.__astralHeresy.state.over, hp: window.__astralHeresy.player.hp }); })()"
    );
    if (!afterRestart.started || afterRestart.over || afterRestart.hp !== 5) {
      throw new Error(`Unexpected restart state: ${JSON.stringify(afterRestart)}`);
    }

    const playfieldState = evalJson(
      "(() => { const textState = JSON.parse(window.render_game_to_text()); return JSON.stringify({ active: textState.playfield.active, leftBayWidth: textState.playfield.leftBayWidth, rightBayWidth: textState.playfield.rightBayWidth, minX: textState.playfield.minX, maxX: textState.playfield.maxX, viewWidth: window.innerWidth, density: textState.density }); })()"
    );
    if (
      !playfieldState.active ||
      playfieldState.leftBayWidth !== 0 ||
      playfieldState.rightBayWidth !== 0 ||
      playfieldState.minX > 80 ||
      playfieldState.maxX < playfieldState.viewWidth - 80
    ) {
      throw new Error(`Unexpected desktop playfield state: ${JSON.stringify(playfieldState)}`);
    }
    runPwcli("screenshot");

    const clampedEnemy = evalJson(
      "(() => { const game = window.__astralHeresy; const enemy = game.debugSpawnEnemy('cherub', { x: 0, y: 160, vx: 0, vy: 0 }); window.advanceTime(16); const textState = JSON.parse(window.render_game_to_text()); return JSON.stringify({ enemyX: Math.round(enemy.components.position.x), laneMinX: textState.playfield.minX, density: textState.density }); })()"
    );
    if (clampedEnemy.enemyX < clampedEnemy.laneMinX - 80) {
      throw new Error(`Enemy lane clamp failed: ${JSON.stringify(clampedEnemy)}`);
    }
    runPwcli("screenshot");

    const burstState = evalJson(
      "(() => { window.__astralHeresy.state.burstStocks = 2; document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true, cancelable: true })); window.advanceTime(50); document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', bubbles: true, cancelable: true })); return JSON.stringify({ burstStocks: window.__astralHeresy.state.burstStocks, burstFeedback: window.__astralHeresy.state.feedback.burst > 0, textState: JSON.parse(window.render_game_to_text()) }); })()"
    );
    if (burstState.burstStocks !== 1 || !burstState.burstFeedback || typeof burstState.textState.player?.burstStocks !== "number") {
      throw new Error(`Unexpected burst state: ${JSON.stringify(burstState)}`);
    }
    runPwcli("screenshot");

    const pickupHud = evalJson(
      "(() => { window.__astralHeresy.player.weaponMode = 'spread'; window.__astralHeresy.player.weaponLabel = 'Spread'; window.__astralHeresy.player.weaponTimer = 8.4; window.__astralHeresy.state.grazeCharge = 60; window.__astralHeresy.state.burstStocks = 2; window.advanceTime(16); return JSON.stringify({ weaponText: document.getElementById('weapon-value').textContent, grazeText: document.getElementById('graze-value').textContent }); })()"
    );
    if (!pickupHud.weaponText.includes("Spread") || pickupHud.grazeText !== "60%") {
      throw new Error(`Unexpected pickup HUD state: ${JSON.stringify(pickupHud)}`);
    }
    runPwcli("screenshot");

    const pickupNotice = evalJson(
      "(() => { const game = window.__astralHeresy; game.debugSpawnPickup('halo-shield', game.player.x, game.player.y, {}); window.advanceTime(16); return JSON.stringify({ feedVisible: !document.getElementById('powerup-feed').classList.contains('hidden'), textState: JSON.parse(window.render_game_to_text()) }); })()"
    );
    if (pickupNotice.feedVisible || pickupNotice.textState.powerupNotice?.title !== "Halo Shield") {
      throw new Error(`Unexpected pickup notice state: ${JSON.stringify(pickupNotice)}`);
    }
    runPwcli("screenshot");

    const shieldBreak = evalJson(
      "(() => { const game = window.__astralHeresy; game.player.activePowerups.haloShield = 10; game.player.hp = 5; game.player.invuln = 0; game.debugSpawnEnemyBullet(game.player.x, game.player.y, 0, 0, { r: 4 }); window.advanceTime(16); return JSON.stringify({ hp: game.player.hp, shieldTimer: game.player.activePowerups.haloShield, shieldFeedback: game.state.feedback.shield > 0 }); })()"
    );
    if (shieldBreak.hp !== 5 || shieldBreak.shieldTimer !== 0 || !shieldBreak.shieldFeedback) {
      throw new Error(`Unexpected shield break state: ${JSON.stringify(shieldBreak)}`);
    }
    runPwcli("screenshot");

    const orbitalsState = evalJson(
      "(() => { const game = window.__astralHeresy; game.player.weaponMode = 'orbitals'; game.player.weaponLabel = 'Orbitals'; game.player.weaponTimer = 9.1; document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true, cancelable: true })); window.advanceTime(140); document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', bubbles: true, cancelable: true })); return JSON.stringify({ weapon: JSON.parse(window.render_game_to_text()).player.weapon, playerBullets: JSON.parse(window.render_game_to_text()).playerBullets }); })()"
    );
    if (orbitalsState.weapon !== "orbitals" || orbitalsState.playerBullets < 2) {
      throw new Error(`Unexpected orbitals state: ${JSON.stringify(orbitalsState)}`);
    }
    runPwcli("screenshot");

    const magnetState = evalJson(
      "(() => { const game = window.__astralHeresy; game.player.activePowerups.magnetCore = 10; game.debugSpawnScoreShards(game.player.x + 180, game.player.y - 20, 3, { seedOffset: Math.PI / 2 }); window.advanceTime(120); const textState = JSON.parse(window.render_game_to_text()); return JSON.stringify({ magnetTimer: game.player.activePowerups.magnetCore, scoreShards: textState.scoreShards.length }); })()"
    );
    if (magnetState.magnetTimer <= 0 || magnetState.scoreShards === 0) {
      throw new Error(`Unexpected magnet state: ${JSON.stringify(magnetState)}`);
    }
    runPwcli("screenshot");

    const loopHud = evalJson(
      "(() => { window.__astralHeresy.state.loopIndex = 1; window.__astralHeresy.state.loopTimer = 1.8; window.advanceTime(16); return JSON.stringify({ stageLabel: document.getElementById('stage-label').textContent, loopValue: document.getElementById('loop-value').textContent }); })()"
    );
    if (!loopHud.stageLabel.includes('Loop II') || loopHud.loopValue !== 'II') {
      throw new Error(`Unexpected loop HUD state: ${JSON.stringify(loopHud)}`);
    }
    runPwcli("screenshot");
    runPwcli("close");

    runPwcli("open", `${BASE_URL}/?mode=render&enemy=halo`);
    const enemyShowcase = evalJson(
      "(() => { return JSON.stringify({ type: window.__astralHeresy.state.showcase?.type, key: window.__astralHeresy.state.showcase?.key, entities: window.__astralHeresy.state.entities.length }); })()"
    );
    if (enemyShowcase.type !== "enemy" || enemyShowcase.key !== "halo" || enemyShowcase.entities !== 1) {
      throw new Error(`Unexpected enemy showcase state: ${JSON.stringify(enemyShowcase)}`);
    }
    runPwcli("screenshot");
    runPwcli("close");

    runPwcli("open", `${BASE_URL}/?mode=render&boss=prism&phase=2`);
    const bossShowcase = evalJson(
      "(() => { return JSON.stringify({ type: window.__astralHeresy.state.showcase?.type, key: window.__astralHeresy.state.boss?.key, phaseIndex: window.__astralHeresy.state.boss?.phaseIndex }); })()"
    );
    if (bossShowcase.type !== "boss" || bossShowcase.key !== "prism" || bossShowcase.phaseIndex !== 1) {
      throw new Error(`Unexpected boss showcase state: ${JSON.stringify(bossShowcase)}`);
    }
    const amplifierBrand = evalJson(
      "(() => { window.__astralHeresy.state.boss.weakpointBrandTimer = 1.1; window.__astralHeresy.state.feedback.weakpoint = 0.6; window.advanceTime(16); return JSON.stringify({ weakpointBrandTimer: window.__astralHeresy.state.boss.weakpointBrandTimer }); })()"
    );
    if (amplifierBrand.weakpointBrandTimer <= 0) {
      throw new Error(`Unexpected amplifier brand state: ${JSON.stringify(amplifierBrand)}`);
    }
    runPwcli("screenshot");
    runPwcli("close");

    const artifactDir = path.join(OUTPUT_DIR, ".playwright-cli");
    const screenshots = readdirSync(artifactDir).filter((entry) => entry.endsWith(".png"));
    if (screenshots.length === 0) {
      throw new Error("Expected the browser smoke lane to capture at least one screenshot.");
    }

    console.log("Browser runtime smoke checks passed.");
  } finally {
    try {
      runPwcli("close");
    } catch {
      // Session may already be closed.
    }

    cleanupPlaywrightProcesses();
    server.kill("SIGTERM");
    await sleep(200);
    server.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error("Browser runtime smoke checks failed.\n");
  console.error(
    `${error.message}\n\nRepair path: verify npx-backed Playwright CLI access, confirm the local server booted, and recheck the launch/restart/showcase flows in a real browser.`
  );
  process.exit(1);
});
