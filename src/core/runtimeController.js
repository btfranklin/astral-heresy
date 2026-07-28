import { createPlayfield } from "../state/playfieldState.js";
import { getPlayerBounds } from "../state/playerState.js";
import { resetFreshRunState } from "../state/runReset.js";
import { createShowcaseScene } from "../debug/showcase.js";
import { sfxStart } from "../audio/sfx.js";

const BACKGROUND_DPR_CAP = 1.5;

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
  getAudioWorld = () => null,
  windowObject = window,
  documentObject = document,
  onGameStart = () => {},
  onRenderInvalidated = () => {},
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
    const devicePixelRatio = windowObject.devicePixelRatio;
    state.view.dpr =
      Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const backgroundDpr = Math.min(state.view.dpr, BACKGROUND_DPR_CAP);
    state.view.width = windowObject.innerWidth;
    state.view.height = windowObject.innerHeight;
    state.playfield = createPlayfield(state.view.width, state.view.height);

    bgCanvas.width = Math.floor(state.view.width * backgroundDpr);
    bgCanvas.height = Math.floor(state.view.height * backgroundDpr);
    gameCanvas.width = Math.floor(state.view.width * state.view.dpr);
    gameCanvas.height = Math.floor(state.view.height * state.view.dpr);

    backgroundRenderer.resize(state.view.width, state.view.height, backgroundDpr);
    const playerBounds = getPlayerBounds(state.view.width, state.view.height);
    onRenderInvalidated();

    if (!state.started) {
      player.x = playerBounds.startX;
      player.y = playerBounds.startY;
      resetPointers();
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
      state.input.pointerX = Math.min(
        playerBounds.maxX,
        Math.max(playerBounds.minX, (state.input.pointerX / previousWidth) * state.view.width)
      );
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
    audio.beginRun(getAudioWorld());
    sfxStart(audio, { x: player.x });
    hideOverlays();
    onGameStart();
    onRenderInvalidated();
  }

  function prepareFreshState() {
    audio.resetRun();
    resetFreshRunState(state, player);
  }

  function activateShowcase(config) {
    prepareFreshState();
    hideOverlays();
    createShowcaseScene(state, player, config);
    sync();
    onRenderInvalidated();
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
    onRenderInvalidated();
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
