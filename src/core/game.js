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
  };

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
      return;
    }

    state.time += dt;
    state.pulse = Math.max(0, state.pulse - dt * 0.7);
    if (state.showcase) {
      updateShowcaseScene(state, dt);
      renderBuckets = buildEntityBuckets(state);
      return;
    }
    if (state.over) {
      updateParticles(state, dt);
      flushEntities(state);
      renderBuckets = buildEntityBuckets(state);
      return;
    }

    updateStage(state, stages, dataContext, audio, dt);
    updatePlayer(state, player, audio, dt);
    updateBullets(state, player, dt);
    updateEnemies(state, dt);
    updateMovement(state, dt);
    updateParticles(state, dt);

    if (state.boss) {
      updateBoss(state, state.boss, dt, dataContext);
      if (state.boss.phaseIndex >= state.boss.phases.length) {
        state.boss.hp = 0;
      }
      if (state.boss.hp <= 0) {
        defeatBoss(state, state.boss, spawnParticle, audio, stages);
      }
    }

    const collisionBuckets = buildEntityBuckets(state);
    handleCollisions(
      state,
      player,
      audio,
      spawnParticle,
      advanceBossPhase,
      (innerState, boss, particle, audioEngine) =>
        defeatBoss(innerState, boss, particle, audioEngine, stages),
      collisionBuckets
    );

    cleanupBullets(state);
    flushEntities(state);
    renderBuckets = buildEntityBuckets(state);
  }

  const nextFrame = createFrameTimer();

  function loop(timestamp) {
    if (disposed) return;
    const dt = nextFrame(timestamp);
    update(dt);
    backgroundRenderer.render(state, player);
    canvasRenderer.render(state, player, stages, renderBuckets);
    interfaceController.sync(state, player, stages);
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
    startGame: runtimeController.startGame,
    resetGame: runtimeController.resetGame,
  };
}
