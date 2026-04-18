function createScoreBonuses() {
  return {
    graze: 0,
    burst: 0,
    chain: 0,
    close: 0,
    weakpoint: 0,
    phaseBreak: 0,
    elite: 0,
    pickup: 0,
  };
}

function createFeedbackState() {
  return {
    graze: 0,
    burst: 0,
    weakpoint: 0,
    phase: 0,
    loop: 0,
    chain: 0,
  };
}

function createDefaults() {
  return {
    time: 0,
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
    scoreBonuses: createScoreBonuses(),
    feedback: createFeedbackState(),
  };
}

export function createGameState() {
  return {
    ...createDefaults(),
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
  Object.assign(state, createDefaults());
  state.input = {
    pointerEnabled: true,
  };
  state.entities = [];
  return state;
}
