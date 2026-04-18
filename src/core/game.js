import { createFrameTimer } from "./time.js";
import { createEventBus } from "./events.js";
import { createGameState } from "../state/gameState.js";
import { createPlayerState } from "../state/playerState.js";
import { createRuntimeController } from "./runtimeController.js";
import { createInputSystem } from "../systems/inputSystem.js";
import { updatePlayer } from "../systems/playerSystem.js";
import { updateBullets, cleanupBullets, spawnEnemyBullet } from "../systems/bulletSystem.js";
import { spawnEnemy, updateEnemies } from "../systems/enemySystem.js";
import { updateMovement } from "../systems/movementSystem.js";
import { spawnParticle, updateParticles } from "../systems/particleSystem.js";
import { handleCollisions } from "../systems/collisionSystem.js";
import { updateStage } from "../systems/stageSystem.js";
import { updateBoss, advanceBossPhase, defeatBoss } from "../systems/bossSystem.js";
import { updateCombat } from "../systems/combatSystem.js";
import { spawnPickup, updatePickups } from "../systems/pickupSystem.js";
import { buildEntityBuckets, createEntityBuckets } from "../entities/entityBuckets.js";
import { stageDefinitions } from "../data/stages.js";
import { createBackgroundRenderer } from "../rendering/glBackground.js";
import { createCanvasRenderer } from "../rendering/canvasRenderer.js";
import { createAudioEngine } from "../audio/audioEngine.js";
import { flushEntities } from "../entities/entityFactory.js";
import { createInterfaceController } from "../ui/interfaceController.js";
import { getShowcaseConfig, updateShowcaseScene } from "../debug/showcase.js";

export function createGame({
  bgCanvas,
  gameCanvas,
  startScreen,
  startButton,
  endScreen,
  restartButton,
  documentRoot,
}) {
  const ctx = gameCanvas.getContext("2d");
  const gl = bgCanvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });

  if (!gl) {
    alert("WebGL not supported in this browser.");
    return null;
  }

  const state = createGameState();
  const events = createEventBus();
  const audio = createAudioEngine();
  const player = createPlayerState(window.innerWidth, window.innerHeight);
  const inputSystem = createInputSystem(state, gameCanvas);
  const backgroundRenderer = createBackgroundRenderer(gl);
  const canvasRenderer = createCanvasRenderer(ctx);
  const interfaceController = createInterfaceController(documentRoot);
  const showcaseConfig = getShowcaseConfig();

  const dataContext = {
    view: state.view,
    player,
    spawnEnemyBullet: (x, y, angle, speed, opts) =>
      spawnEnemyBullet(state, x, y, angle, speed, opts),
    spawnEnemy: (archetypeKey, overrides) => spawnEnemy(state, archetypeKey, overrides),
    spawnPickup: (kind, x, y, overrides) => spawnPickup(state, kind, x, y, overrides),
  };
  Object.defineProperty(dataContext, "loopIndex", {
    get() {
      return state.loopIndex;
    },
  });

  const stages = stageDefinitions;
  const runtimeController = createRuntimeController({
    state,
    player,
    audio,
    inputSystem,
    interfaceController,
    stages,
    showcaseConfig,
    bgCanvas,
    gameCanvas,
    backgroundRenderer,
    startScreen,
    startButton,
    endScreen,
    restartButton,
    onGameStart: () => events.emit("game:start"),
  });

  let disposed = false;
  let initialized = false;
  let rafId = null;
  let renderBuckets = createEntityBuckets();

  function update(dt) {
    if (!state.started) {
      renderBuckets = buildEntityBuckets(state);
      audio.updateMusic(state, player);
      return;
    }

    state.time += dt;
    state.pulse = Math.max(0, state.pulse - dt * 0.7);
    if (state.showcase) {
      updateShowcaseScene(state, dt);
      renderBuckets = buildEntityBuckets(state);
      audio.updateMusic(state, player);
      return;
    }
    if (state.over) {
      updateParticles(state, dt);
      flushEntities(state);
      renderBuckets = buildEntityBuckets(state);
      audio.updateMusic(state, player);
      return;
    }

    updateStage(state, stages, dataContext, audio, dt);
    updatePlayer(state, player, audio, dt);
    updateCombat(state, player, dt);
    updateBullets(state, player, dt);
    updateEnemies(state, dt);
    updateMovement(state, dt);
    updatePickups(state, player, dt);
    updateParticles(state, dt);

    if (state.boss) {
      updateBoss(state, state.boss, dt, dataContext);
      if (state.boss.phaseIndex >= state.boss.phases.length) {
        state.boss.hp = 0;
      }
      if (state.boss.hp <= 0) {
        defeatBoss(state, player, state.boss, spawnParticle, audio, stages);
      }
    }

    const collisionBuckets = buildEntityBuckets(state);
    handleCollisions(
      state,
      player,
      audio,
      spawnParticle,
      advanceBossPhase,
      (innerState, innerPlayer, boss, particle, audioEngine) =>
        defeatBoss(innerState, innerPlayer, boss, particle, audioEngine, stages),
      (kind, x, y, overrides) => spawnPickup(state, kind, x, y, overrides),
      collisionBuckets
    );

    cleanupBullets(state);
    flushEntities(state);
    renderBuckets = buildEntityBuckets(state);
    audio.updateMusic(state, player);
  }

  const nextFrame = createFrameTimer();

  function renderFrame() {
    backgroundRenderer.render(state, player);
    canvasRenderer.render(state, player, stages, renderBuckets);
    interfaceController.sync(state, player, stages);
  }

  function buildTextSnapshot() {
    const sample = (entities, limit = 8) =>
      entities.slice(0, limit).map((entity) => ({
        id: entity.id,
        type: entity.type,
        x: Math.round(entity.components.position?.x || 0),
        y: Math.round(entity.components.position?.y || 0),
        r: Number((entity.components.collider?.r || 0).toFixed(1)),
      }));

    return {
      coordinateSystem: "origin top-left; +x right; +y down",
      mode: state.showcase
        ? "showcase"
        : !state.started
          ? "start"
          : state.over
            ? (state.victory ? "victory" : "defeat")
            : "combat",
      stage: stages[state.stageIndex]?.name || "Complete",
      loop: state.loopIndex + 1,
      player: {
        x: Math.round(player.x),
        y: Math.round(player.y),
        hp: player.hp,
        invuln: Number(player.invuln.toFixed(2)),
        weapon: player.weaponMode,
        weaponTimer: Number(player.weaponTimer.toFixed(2)),
        burstStocks: state.burstStocks,
        grazeCharge: state.grazeCharge,
      },
      boss: state.boss
        ? {
            key: state.boss.key,
            hp: Math.round(state.boss.hp),
            phase: state.boss.phases[state.boss.phaseIndex]?.name || "Final Form",
            weakpoint: state.boss.weakpoint
              ? {
                  x: Math.round(state.boss.weakpoint.x),
                  y: Math.round(state.boss.weakpoint.y),
                  radius: Number(state.boss.weakpoint.radius.toFixed(1)),
                }
              : null,
          }
        : null,
      score: state.score,
      chainLevel: state.chainLevel,
      chainTimer: Number(state.chainTimer.toFixed(2)),
      pickups: sample(renderBuckets.pickups, 4),
      enemies: sample(renderBuckets.enemies, 6),
      enemyBullets: renderBuckets.enemyBullets.length,
      playerBullets: renderBuckets.playerBullets.length,
    };
  }

  function loop(timestamp) {
    if (disposed) return;
    const dt = nextFrame(timestamp);
    update(dt);
    renderFrame();
    rafId = requestAnimationFrame(loop);
  }

  function init() {
    if (initialized || disposed) return;
    initialized = true;
    runtimeController.init();
    renderBuckets = buildEntityBuckets(state);
    rafId = requestAnimationFrame(loop);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    initialized = false;
    runtimeController.dispose();
    if (rafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  return {
    state,
    player,
    events,
    init,
    dispose,
    advanceTime(ms) {
      const steps = Math.max(1, Math.round(ms / (1000 / 60)));
      for (let i = 0; i < steps; i++) {
        update(1 / 60);
      }
      renderFrame();
      return JSON.stringify(buildTextSnapshot());
    },
    renderGameToText() {
      return JSON.stringify(buildTextSnapshot());
    },
    startGame: runtimeController.startGame,
    resetGame: runtimeController.resetGame,
  };
}
