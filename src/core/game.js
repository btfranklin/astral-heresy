import { createFrameTimer } from "./time.js";
import { createEventBus } from "./events.js";
import { createPlayfieldContext } from "../state/playfieldState.js";
import { createGameState } from "../state/gameState.js";
import { createPlayerState } from "../state/playerState.js";
import { createRuntimeController } from "./runtimeController.js";
import { createStageDirector, refreshDensityState } from "./director.js";
import { createInputSystem } from "../systems/inputSystem.js";
import { updatePlayer } from "../systems/playerSystem.js";
import { updateBullets, cleanupBullets, spawnEnemyBullet, spawnPlayerBullet } from "../systems/bulletSystem.js";
import { spawnEnemy, updateEnemies } from "../systems/enemySystem.js";
import { updateMovement } from "../systems/movementSystem.js";
import { spawnParticle, updateParticles } from "../systems/particleSystem.js";
import { handleCollisions } from "../systems/collisionSystem.js";
import { updateStage } from "../systems/stageSystem.js";
import { updateBoss, advanceBossPhase, defeatBoss } from "../systems/bossSystem.js";
import { updateCombat } from "../systems/combatSystem.js";
import { updateVisualFeedback } from "../systems/visualFeedbackSystem.js";
import { spawnPickup, spawnScoreShards, updatePickups } from "../systems/pickupSystem.js";
import { buildEntityBuckets, createEntityBuckets } from "../entities/entityBuckets.js";
import { stageDefinitions } from "../data/stages.js";
import { createBackgroundRenderer } from "../rendering/glBackground.js";
import { createCanvasRenderer } from "../rendering/canvasRenderer.js";
import { createAudioEngine } from "../audio/audioEngine.js";
import { projectAudioWorld } from "../audio/audioState.js";
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
  const playfieldContext = createPlayfieldContext(state);
  const stageDirector = createStageDirector(state);

  const dataContext = {
    view: state.view,
    player,
    playfield: playfieldContext,
    director: stageDirector,
    spawnEnemyBullet: (x, y, angle, speed, opts) =>
      spawnEnemyBullet(state, x, y, angle, speed, opts),
    spawnEnemy: (archetypeKey, overrides, spawnOptions) =>
      spawnEnemy(state, archetypeKey, overrides, spawnOptions),
    spawnPickup: (kind, x, y, overrides, spawnOptions) =>
      spawnPickup(state, kind, x, y, overrides, spawnOptions),
    spawnScoreShards: (x, y, count, options, spawnOptions) =>
      spawnScoreShards(state, x, y, count, options, spawnOptions),
  };
  Object.defineProperty(dataContext, "loopIndex", {
    get() {
      return state.loopIndex;
    },
  });

  const stages = stageDefinitions;
  let renderDirty = true;
  let wasContinuouslyAnimated = false;

  function invalidateRender() {
    renderDirty = true;
  }

  function getAudioWorld() {
    return projectAudioWorld(state, player, stages);
  }

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
    getAudioWorld,
    onGameStart: () => events.emit("game:start"),
    onRenderInvalidated: invalidateRender,
  });

  let disposed = false;
  let initialized = false;
  let rafId = null;
  let renderBuckets = createEntityBuckets();

  function latchFinalRunTime() {
    if (state.over && state.finalRunTime === null) {
      state.finalRunTime = state.time;
    }
  }

  function update(dt) {
    updateVisualFeedback(state, dt);

    if (!state.started) {
      renderBuckets = buildEntityBuckets(state);
      audio.updateWorld(getAudioWorld());
      return;
    }

    if (state.showcase) {
      state.time += dt;
      state.pulse = Math.max(0, state.pulse - dt * 0.7);
      updateShowcaseScene(state, dt);
      renderBuckets = buildEntityBuckets(state);
      audio.updateWorld(getAudioWorld());
      return;
    }

    latchFinalRunTime();

    if (state.over) {
      updateParticles(state, dt);
      flushEntities(state);
      renderBuckets = buildEntityBuckets(state);
      audio.updateWorld(getAudioWorld());
      return;
    }

    state.time += dt;
    state.pulse = Math.max(0, state.pulse - dt * 0.7);

    refreshDensityState(state, stages[state.stageIndex]);
    stageDirector.beginFrame();
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
      (kind, x, y, overrides, spawnOptions) => spawnPickup(state, kind, x, y, overrides, spawnOptions),
      (x, y, count, options, spawnOptions) => spawnScoreShards(state, x, y, count, options, spawnOptions),
      collisionBuckets,
      dt
    );

    cleanupBullets(state);
    flushEntities(state);
    latchFinalRunTime();
    renderBuckets = buildEntityBuckets(state);
    audio.updateWorld(getAudioWorld());
  }

  const nextFrame = createFrameTimer();

  function renderFrame() {
    backgroundRenderer.render(state, player);
    canvasRenderer.render(state, player, stages, renderBuckets);
    interfaceController.sync(state, player, stages);
  }

  function isContinuouslyAnimated() {
    return Boolean(
      state.showcase ||
      (state.started && !state.over) ||
      state.shake > 0 ||
      renderBuckets.particles.length > 0
    );
  }

  function renderIfNeeded(force = false) {
    const continuouslyAnimated = isContinuouslyAnimated();
    if (force || renderDirty || continuouslyAnimated || wasContinuouslyAnimated) {
      renderFrame();
      renderDirty = false;
    }
    wasContinuouslyAnimated = continuouslyAnimated;
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
        activePowerups: Object.fromEntries(
          Object.entries(player.activePowerups)
            .filter(([, timer]) => timer > 0)
            .map(([key, timer]) => [key, Number(timer.toFixed(2))])
        ),
      },
      powerupNotice:
        state.powerupNotice?.hudTimer > 0 || state.powerupNotice?.timer > 0
          ? {
              title: state.powerupNotice.title,
              roleTag: state.powerupNotice.roleTag,
              category: state.powerupNotice.category,
              timer: Number(state.powerupNotice.timer.toFixed(2)),
              hudTimer: Number(state.powerupNotice.hudTimer.toFixed(2)),
            }
          : null,
      boss: state.boss
        ? {
            key: state.boss.key,
            hp: Math.round(state.boss.hp),
            phase: state.boss.phases[state.boss.phaseIndex]?.name || "Final Form",
            weakpointBrandTimer: Number((state.boss.weakpointBrandTimer || 0).toFixed(2)),
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
      playfield: {
        active: state.playfield.active,
        minX: Math.round(state.playfield.minX),
        maxX: Math.round(state.playfield.maxX),
        minY: Math.round(state.playfield.minY),
        maxY: Math.round(state.playfield.maxY),
        leftBayWidth: Math.round(state.playfield.leftBayWidth),
        rightBayWidth: Math.round(state.playfield.rightBayWidth),
      },
      density: {
        liveEnemies: state.density.liveEnemies,
        liveEnemyBullets: state.density.liveEnemyBullets,
        maxEnemies: state.density.maxEnemies,
        maxEnemyBullets: state.density.maxEnemyBullets,
        saturated: state.density.saturated,
      },
      chainLevel: state.chainLevel,
      chainTimer: Number(state.chainTimer.toFixed(2)),
      pickups: sample(renderBuckets.pickups, 4),
      scoreShards: sample(renderBuckets.scoreShards, 6),
      enemies: sample(renderBuckets.enemies, 6),
      enemyBullets: renderBuckets.enemyBullets.length,
      playerBullets: renderBuckets.playerBullets.length,
    };
  }

  function loop(timestamp) {
    if (disposed) return;
    const dt = nextFrame(timestamp);
    update(dt);
    renderIfNeeded();
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
    if (rafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    runtimeController.dispose();
    backgroundRenderer.dispose();
    canvasRenderer.dispose();
    return audio.dispose();
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
      renderIfNeeded(true);
      return JSON.stringify(buildTextSnapshot());
    },
    renderGameToText() {
      return JSON.stringify(buildTextSnapshot());
    },
    debugSpawnPickup(kind, x, y, overrides = {}) {
      const entity = spawnPickup(state, kind, x, y, overrides, { laneAware: false });
      invalidateRender();
      return entity;
    },
    debugSpawnEnemy(archetypeKey, overrides = {}, spawnOptions) {
      const entity = spawnEnemy(state, archetypeKey, overrides, spawnOptions);
      invalidateRender();
      return entity;
    },
    debugSpawnScoreShards(x, y, count = 4, options = {}) {
      const entities = spawnScoreShards(state, x, y, count, options, { laneAware: false });
      invalidateRender();
      return entities;
    },
    debugSpawnEnemyBullet(x, y, angle, speed, options = {}) {
      const entity = spawnEnemyBullet(state, x, y, angle, speed, options);
      invalidateRender();
      return entity;
    },
    debugSpawnPlayerBullet(x, y, angle, speed, options = {}) {
      const entity = spawnPlayerBullet(state, x, y, angle, speed, options);
      invalidateRender();
      return entity;
    },
    debugBuildBuckets() {
      return buildEntityBuckets(state);
    },
    debugAudioDiagnostics() {
      return audio.getDiagnostics();
    },
    debugSetAudioWorld(overrides) {
      return audio.setDebugWorld(overrides);
    },
    debugClearAudioWorld() {
      audio.clearDebugWorld();
      return audio.getDiagnostics();
    },
    debugSetAudioScore(options) {
      if (!audio.setDebugScore(options)) return false;
      return audio.getDiagnostics();
    },
    debugClearAudioScore() {
      audio.clearDebugScore();
      return audio.getDiagnostics();
    },
    debugPlayAudioEvent(kind, payload = {}) {
      return audio.playDebugEvent(kind, payload);
    },
    startGame: runtimeController.startGame,
    resetGame: runtimeController.resetGame,
  };
}
