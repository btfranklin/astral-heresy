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
