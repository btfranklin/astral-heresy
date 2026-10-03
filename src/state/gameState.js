import { createPlayfield } from "./playfieldState.js";
import { createRandom } from "./random.js";

export function createScoreBonuses() {
  return {
    graze: 0,
    burst: 0,
    chain: 0,
    close: 0,
    weakpoint: 0,
    phaseBreak: 0,
    elite: 0,
    pickup: 0,
    shard: 0,
  };
}

export function createFeedbackState() {
  return {
    graze: 0,
    burst: 0,
    weakpoint: 0,
    phase: 0,
    loop: 0,
    chain: 0,
    shield: 0,
  };
}

function createDensityState() {
  return {
    liveEnemies: 0,
    liveEnemyBullets: 0,
    maxEnemies: 6,
    maxEnemyBullets: 42,
    saturated: false,
  };
}

export function createPowerupNotice() {
  return {
    title: "",
    roleTag: "",
    category: "utility",
    timer: 0,
    hudTimer: 0,
    ribbonTimer: 0,
    color: "#79ffe1",
    sigil: "hex",
    x: 0,
    y: 0,
  };
}

function createDefaults(width = 0, height = 0) {
  return {
    time: 0,
    finalRunTime: null,
    stageIndex: 0,
    stageTime: 0,
    stageState: null,
    boss: null,
    pulse: 0,
    shake: 0,
    over: false,
    victory: false,
    started: false,
    showcase: null,
    score: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    grazeCharge: 0,
    grazeWindow: 0,
    burstStocks: 1,
    chainLevel: 0,
    chainTimer: 0,
    loopIndex: 0,
    bonusText: "",
    bonusTimer: 0,
    loopTimer: 0,
    burstOrigin: null,
    shieldOrigin: null,
    playfield: createPlayfield(width, height),
    density: createDensityState(),
    powerupNotice: createPowerupNotice(),
    scoreBonuses: createScoreBonuses(),
    feedback: createFeedbackState(),
  };
}

export function createGameState({ seed = null } = {}) {
  return {
    ...createDefaults(),
    randomSeed: seed,
    random: createRandom(seed),
    nextEntityId: 1,
    input: {
      pointerEnabled: true,
    },
    entities: [],
    view: {
      width: 0,
      height: 0,
      dpr: 1,
    },
  };
}

export function resetGameState(state) {
  const randomSeed = state.randomSeed;
  Object.assign(state, createDefaults(state.view.width, state.view.height));
  state.randomSeed = randomSeed;
  state.random = createRandom(randomSeed);
  state.nextEntityId = 1;
  state.input = {
    pointerEnabled: true,
  };
  state.entities = [];
  return state;
}
