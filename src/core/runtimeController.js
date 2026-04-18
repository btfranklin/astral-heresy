import { resetGameState } from "../state/gameState.js";
import { createPlayfield } from "../state/playfieldState.js";
import { getPlayerBounds, resetPlayerState } from "../state/playerState.js";
import { createShowcaseScene } from "../debug/showcase.js";
import { sfxStart } from "../audio/sfx.js";

export function createRuntimeController({
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
  windowObject = window,
  documentObject = document,
  onGameStart = () => {},
}) {
  let initialized = false;
  let disposed = false;

  const handlers = {
    startClick: null,
    restartClick: null,
    keydown: null,
    resize: null,
  };

  function sync() {
    interfaceController.sync(state, player, stages);
  }

  function resetPointers() {
    state.input.pointerX = player.x;
    state.input.pointerY = player.y;
  }

  function resize() {
    const previousWidth = state.view.width || windowObject.innerWidth;
    const previousHeight = state.view.height || windowObject.innerHeight;
    state.view.dpr = windowObject.devicePixelRatio || 1;
    state.view.width = windowObject.innerWidth;
    state.view.height = windowObject.innerHeight;
    state.playfield = createPlayfield(state.view.width, state.view.height);

    bgCanvas.width = Math.floor(state.view.width * state.view.dpr);
    bgCanvas.height = Math.floor(state.view.height * state.view.dpr);
    gameCanvas.width = Math.floor(state.view.width * state.view.dpr);
    gameCanvas.height = Math.floor(state.view.height * state.view.dpr);

    backgroundRenderer.resize(state.view.width, state.view.height, state.view.dpr);
    const playerBounds = getPlayerBounds(state.view.width, state.view.height);

    if (!state.started) {
      player.x = playerBounds.startX;
      player.y = playerBounds.startY;
      resetPointers();
      return;
    }

    if (state.boss) {
      return;
    }

    player.x = Math.min(
      playerBounds.maxX,
      Math.max(playerBounds.minX, (player.x / previousWidth) * state.view.width)
    );
    player.y = Math.min(
      playerBounds.maxY,
      Math.max(playerBounds.minY, (player.y / previousHeight) * state.view.height)
    );

    if (Number.isFinite(state.input.pointerX)) {
      state.input.pointerX = (state.input.pointerX / previousWidth) * state.view.width;
    } else {
      state.input.pointerX = player.x;
    }

    if (Number.isFinite(state.input.pointerY)) {
      state.input.pointerY = Math.min(
        playerBounds.maxY,
        Math.max(playerBounds.minY, (state.input.pointerY / previousHeight) * state.view.height)
      );
    } else {
      state.input.pointerY = player.y;
    }
  }

  function hideOverlays() {
    startScreen.classList.add("hidden");
    endScreen.classList.add("hidden");
  }

  function startGame() {
    if (disposed || state.started) return;
    state.started = true;
    audio.init();
    audio.resume();
    sfxStart(audio);
    hideOverlays();
    onGameStart();
  }

  function prepareFreshState() {
    resetGameState(state);
    resetPlayerState(player, state.view.width, state.view.height);
    audio.engine.lastShot = 0;
    resetPointers();
  }

  function activateShowcase(config) {
    prepareFreshState();
    hideOverlays();
    createShowcaseScene(state, player, config);
    sync();
  }

  function resetGame(autoStart = false) {
    if (disposed) return;
    prepareFreshState();
    endScreen.classList.add("hidden");

    if (autoStart) {
      startGame();
    } else {
      startScreen.classList.remove("hidden");
    }

    sync();
  }

  function attachUI() {
    handlers.startClick = () => startGame();
    handlers.restartClick = () => resetGame(true);
    handlers.keydown = (event) => {
      if (!state.started && event.code === "Enter") {
        startGame();
      } else if (state.over && (event.code === "Enter" || event.code === "KeyR")) {
        event.preventDefault();
        resetGame(true);
      }
    };
    handlers.resize = () => resize();

    startButton.addEventListener("click", handlers.startClick);
    restartButton.addEventListener("click", handlers.restartClick);
    documentObject.addEventListener("keydown", handlers.keydown);
    windowObject.addEventListener("resize", handlers.resize);
  }

  function detachUI() {
    if (handlers.startClick) {
      startButton.removeEventListener("click", handlers.startClick);
      handlers.startClick = null;
    }
    if (handlers.restartClick) {
      restartButton.removeEventListener("click", handlers.restartClick);
      handlers.restartClick = null;
    }
    if (handlers.keydown) {
      documentObject.removeEventListener("keydown", handlers.keydown);
      handlers.keydown = null;
    }
    if (handlers.resize) {
      windowObject.removeEventListener("resize", handlers.resize);
      handlers.resize = null;
    }
  }

  function init() {
    if (initialized || disposed) return;
    initialized = true;
    inputSystem.attach();
    attachUI();
    resize();

    if (showcaseConfig) {
      activateShowcase(showcaseConfig);
    } else {
      sync();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    initialized = false;
    detachUI();
    inputSystem.detach();
  }

  return { init, dispose, resize, startGame, resetGame };
}
