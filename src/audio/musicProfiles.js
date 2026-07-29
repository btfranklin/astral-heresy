const HOME_RATIOS = [1, 6 / 5, 3 / 2];
const LOOP_TWO_MULTIPLIER = 1.06;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function chord(key, label, semitones, durationSteps) {
  return { key, label, semitones, durationSteps };
}

function accompanimentVoice(octave, semitones, deliberateTensions = []) {
  return { octave, semitones, deliberateTensions };
}

function fourOnFloorPercussion(
  identity,
  {
    low = "boss-kick",
    body = "body",
    tick = "air-tick",
    velocity = 0.82,
  } = {}
) {
  const kicks = [0, 2, 4, 6].map((step, index) => ({
    step,
    instrument: low,
    velocity: velocity - (index % 2) * 0.05,
    fourOnFloor: true,
  }));
  return {
    identity,
    patternSteps: 8,
    tiers: [
      kicks,
      [
        ...kicks,
        { step: 2, instrument: body, velocity: 0.42 },
        { step: 6, instrument: body, velocity: 0.48 },
        { step: 3, instrument: tick, velocity: 0.28 },
        { step: 7, instrument: tick, velocity: 0.32 },
      ],
      [
        ...kicks.map((event) => ({ ...event, velocity: event.velocity + 0.06 })),
        { step: 1, instrument: tick, velocity: 0.3 },
        { step: 2, instrument: body, velocity: 0.5 },
        { step: 3, instrument: tick, velocity: 0.34 },
        { step: 5, instrument: tick, velocity: 0.32 },
        { step: 6, instrument: body, velocity: 0.56 },
        { step: 7, instrument: tick, velocity: 0.38 },
      ],
    ],
  };
}

function fracturedMotorPercussion() {
  const drive = [
    { step: 0, instrument: "boss-kick", velocity: 0.94, driving: true },
    { step: 3, instrument: "boss-kick", velocity: 0.82, driving: true },
    { step: 4, instrument: "boss-kick", velocity: 0.9, driving: true },
    { step: 6, instrument: "boss-kick", velocity: 0.86, driving: true },
  ];
  return {
    identity: "fractured-motor",
    patternSteps: 8,
    tiers: [
      drive,
      [
        ...drive,
        { step: 1, instrument: "glass-tick", velocity: 0.32 },
        { step: 2, instrument: "body", velocity: 0.46 },
        { step: 5, instrument: "glass-tick", velocity: 0.36 },
        { step: 7, instrument: "body", velocity: 0.5 },
      ],
      [
        ...drive.map((event) => ({ ...event, velocity: event.velocity + 0.04 })),
        { step: 1, instrument: "glass-tick", velocity: 0.4 },
        { step: 2, instrument: "body", velocity: 0.52 },
        { step: 5, instrument: "glass-tick", velocity: 0.44 },
        { step: 7, instrument: "body", velocity: 0.58 },
        { step: 7, instrument: "glass-tick", velocity: 0.34, subdivision: true },
      ],
    ],
  };
}

function asymmetricProcessionPercussion() {
  const drive = [
    { step: 0, instrument: "cathedral-low", velocity: 0.96, driving: true },
    { step: 3, instrument: "cathedral-low", velocity: 0.86, driving: true },
    { step: 6, instrument: "cathedral-low", velocity: 0.9, driving: true },
  ];
  return {
    identity: "asymmetric-procession",
    patternSteps: 8,
    tiers: [
      drive,
      [
        ...drive,
        { step: 2, instrument: "body", velocity: 0.48 },
        { step: 5, instrument: "metal-gate", velocity: 0.4 },
        { step: 7, instrument: "body", velocity: 0.52 },
      ],
      [
        ...drive.map((event) => ({ ...event, velocity: event.velocity + 0.03 })),
        { step: 1, instrument: "metal-gate", velocity: 0.36 },
        { step: 2, instrument: "body", velocity: 0.54 },
        { step: 4, instrument: "metal-gate", velocity: 0.42 },
        { step: 5, instrument: "body", velocity: 0.5 },
        { step: 7, instrument: "cathedral-low", velocity: 0.62, ghost: true },
        { step: 7, instrument: "metal-gate", velocity: 0.48 },
      ],
    ],
  };
}

const sixEight = {
  numerator: 6,
  denominator: 8,
  stepsPerQuarter: 2,
  stepsPerBar: 6,
  primaryBeatSteps: 3,
};

const fourFour = {
  numerator: 4,
  denominator: 4,
  stepsPerQuarter: 2,
  stepsPerBar: 8,
  primaryBeatSteps: 2,
};

const twelveEight = {
  numerator: 12,
  denominator: 8,
  stepsPerQuarter: 2,
  stepsPerBar: 12,
  primaryBeatSteps: 3,
};

export const musicProfiles = deepFreeze({
  "nebula-gate": {
    key: "nebula-gate",
    kind: "stage",
    tonicHz: 164.81,
    homeRatios: HOME_RATIOS,
    loopTwoMultiplier: LOOP_TWO_MULTIPLIER,
    bpm: 96,
    meter: sixEight,
    cycleBars: 4,
    mode: "natural-minor",
    scaleSemitones: [0, 2, 3, 5, 7, 8, 10],
    progression: [
      chord("e-minor-add9", "Em(add9)", [0, 3, 7, 14], 9),
      chord("c-major7-over-e", "Cmaj7/E", [0, 3, 7, 8], 3),
      chord("a-minor-add9-over-e", "Am(add9)/E", [0, 5, 8, 14], 6),
      chord("b7-flat9", "B7(b9)", [-1, 5, 7, 8], 6),
    ],
    accompanimentVoices: {
      pedal: accompanimentVoice(-1, [0, 0, 0, 0], [3]),
      pulse: accompanimentVoice(0, [7, 3, 8, 7]),
      danger: accompanimentVoice(1, [3, 8, 5, -1]),
      loop: accompanimentVoice(1, [14, 7, 14, 8]),
    },
    percussion: {
      identity: "orbital",
      patternSteps: 12,
      tiers: [
        [
          { step: 0, instrument: "low", velocity: 0.68 },
          { step: 6, instrument: "low", velocity: 0.58 },
        ],
        [
          { step: 0, instrument: "low", velocity: 0.72 },
          { step: 3, instrument: "dust", velocity: 0.3 },
          { step: 6, instrument: "low", velocity: 0.62 },
          { step: 9, instrument: "dust", velocity: 0.34 },
        ],
        [
          { step: 0, instrument: "low", velocity: 0.76 },
          { step: 2, instrument: "dust", velocity: 0.26 },
          { step: 3, instrument: "body", velocity: 0.34 },
          { step: 5, instrument: "dust", velocity: 0.3 },
          { step: 6, instrument: "low", velocity: 0.68 },
          { step: 8, instrument: "dust", velocity: 0.28 },
          { step: 9, instrument: "body", velocity: 0.38 },
          { step: 11, instrument: "dust", velocity: 0.34 },
        ],
      ],
    },
  },

  seraph: {
    key: "seraph",
    kind: "boss",
    stageKey: "nebula-gate",
    tonicHz: 164.81,
    homeRatios: HOME_RATIOS,
    loopTwoMultiplier: LOOP_TWO_MULTIPLIER,
    bpm: 138,
    meter: fourFour,
    cycleBars: 4,
    mode: "phrygian",
    scaleSemitones: [0, 1, 3, 5, 7, 8, 10],
    progression: [
      chord("e-minor-add-flat9", "Em(add b9)", [0, 3, 7, 13], 8),
      chord("f-major7-over-e", "Fmaj7/E", [0, 1, 5, 8], 4),
      chord("b-flat-minor-over-e", "Bbm/E", [0, 1, 6, 10], 12),
      chord("b7-flat9", "B7(b9)", [-1, 5, 7, 8], 8),
    ],
    accompanimentVoices: {
      pedal: accompanimentVoice(-1, [0, 0, 0, 0], [3]),
      pulse: accompanimentVoice(0, [7, 5, 6, 7]),
      danger: accompanimentVoice(1, [3, 1, 10, -1]),
      loop: accompanimentVoice(1, [13, 8, 6, 8]),
    },
    percussion: fourOnFloorPercussion("orbital-assault", {
      low: "circular-low",
      tick: "air-tick",
      velocity: 0.84,
    }),
  },

  "crystalline-choir": {
    key: "crystalline-choir",
    kind: "stage",
    tonicHz: 196,
    homeRatios: HOME_RATIOS,
    loopTwoMultiplier: LOOP_TWO_MULTIPLIER,
    bpm: 118,
    meter: fourFour,
    cycleBars: 4,
    mode: "harmonic-minor-facets",
    scaleSemitones: [0, 2, 3, 5, 7, 8, 11],
    progression: [
      chord("g-minor-add9", "Gm(add9)", [0, 3, 7, 14], 8),
      chord("g-quartal", "G5(add2,4,b7)", [0, 2, 5, 10], 4),
      chord("g-augmented-major7", "G+(maj7)", [0, 4, 8, 11], 12),
      chord("d7-sus-flat9", "D7sus(b9)", [-1, 2, 5, 7], 8),
    ],
    accompanimentVoices: {
      pedal: accompanimentVoice(-1, [0, 0, 0, -1]),
      pulse: accompanimentVoice(0, [7, 5, 8, 7]),
      danger: accompanimentVoice(1, [3, 10, 11, 2]),
      loop: accompanimentVoice(1, [14, 2, 4, 5]),
    },
    percussion: {
      identity: "refracted",
      patternSteps: 16,
      tiers: [
        [
          { step: 0, instrument: "body", velocity: 0.48 },
          { step: 8, instrument: "body", velocity: 0.42 },
        ],
        [
          { step: 0, instrument: "body", velocity: 0.54 },
          { step: 4, instrument: "glass-tick", velocity: 0.34 },
          { step: 8, instrument: "body", velocity: 0.48 },
          { step: 12, instrument: "glass-tick", velocity: 0.38 },
          { step: 15, instrument: "dust", velocity: 0.24 },
        ],
        [
          { step: 0, instrument: "body", velocity: 0.58 },
          { step: 3, instrument: "glass-tick", velocity: 0.28 },
          { step: 4, instrument: "body", velocity: 0.38 },
          { step: 7, instrument: "glass-tick", velocity: 0.32 },
          { step: 8, instrument: "body", velocity: 0.52 },
          { step: 11, instrument: "glass-tick", velocity: 0.3 },
          { step: 12, instrument: "body", velocity: 0.42 },
          { step: 15, instrument: "glass-tick", velocity: 0.36 },
        ],
      ],
    },
  },

  prism: {
    key: "prism",
    kind: "boss",
    stageKey: "crystalline-choir",
    tonicHz: 196,
    homeRatios: HOME_RATIOS,
    loopTwoMultiplier: LOOP_TWO_MULTIPLIER,
    bpm: 152,
    meter: fourFour,
    cycleBars: 4,
    mode: "altered-diminished",
    scaleSemitones: [0, 1, 3, 4, 6, 8, 10, 11],
    progression: [
      chord("g-minor-add-flat9", "Gm(add b9)", [0, 3, 7, 13], 6),
      chord("a-flat-augmented-over-g", "Ab+/G", [0, 1, 5, 9], 6),
      chord("d-flat7-sharp11-over-g", "Db7(#11)/G", [0, 4, 6, 10], 4),
      chord("d7-flat9", "D7(b9)", [-1, 5, 7, 8], 8),
      chord("e-flat-minor-over-g", "Ebm/G", [0, 3, 8, 11], 4),
      chord("d7-sus-flat9", "D7sus(b9)", [-1, 2, 7, 8], 4),
    ],
    accompanimentVoices: {
      pedal: accompanimentVoice(-1, [0, 0, 0, -1, 0, -1]),
      pulse: accompanimentVoice(0, [7, 5, 6, 7, 8, 7]),
      danger: accompanimentVoice(1, [3, 9, 10, 8, 11, 2]),
      loop: accompanimentVoice(1, [13, 1, 4, 5, 3, 8]),
    },
    percussion: fracturedMotorPercussion(),
  },

  "abyssal-cathedral": {
    key: "abyssal-cathedral",
    kind: "stage",
    tonicHz: 146.83,
    homeRatios: HOME_RATIOS,
    loopTwoMultiplier: LOOP_TWO_MULTIPLIER,
    bpm: 82,
    meter: twelveEight,
    cycleBars: 4,
    mode: "descending-abyssal-minor",
    scaleSemitones: [0, 1, 3, 5, 6, 7, 8, 10],
    progression: [
      chord("d-minor-add9", "Dm(add9)", [0, 3, 7, 14], 12),
      chord("c-minor-add9-over-d", "Cm(add9)/D", [0, 3, 5, 10], 6),
      chord("b-flat-minor-add6-over-d", "Bbm(add6)/D", [0, 3, 6, 8], 12),
      chord("a7-flat9-over-d", "A7(b9)/D", [-1, 2, 7, 8], 18),
    ],
    accompanimentVoices: {
      pedal: accompanimentVoice(-1, [0, 0, 0, -1]),
      pulse: accompanimentVoice(0, [7, 5, 6, 7]),
      danger: accompanimentVoice(1, [3, 10, 8, 2]),
      loop: accompanimentVoice(1, [14, 3, 6, 8]),
    },
    percussion: {
      identity: "processional",
      patternSteps: 24,
      tiers: [
        [
          { step: 0, instrument: "cathedral-low", velocity: 0.72 },
          { step: 12, instrument: "cathedral-low", velocity: 0.64 },
        ],
        [
          { step: 0, instrument: "cathedral-low", velocity: 0.78 },
          { step: 6, instrument: "breath", velocity: 0.3 },
          { step: 12, instrument: "cathedral-low", velocity: 0.68 },
          { step: 18, instrument: "breath", velocity: 0.34 },
        ],
        [
          { step: 0, instrument: "cathedral-low", velocity: 0.82 },
          { step: 3, instrument: "footfall", velocity: 0.28 },
          { step: 6, instrument: "breath", velocity: 0.36 },
          { step: 9, instrument: "footfall", velocity: 0.3 },
          { step: 12, instrument: "cathedral-low", velocity: 0.74 },
          { step: 15, instrument: "footfall", velocity: 0.32 },
          { step: 18, instrument: "breath", velocity: 0.4 },
          { step: 21, instrument: "footfall", velocity: 0.34 },
        ],
      ],
    },
  },

  cathedral: {
    key: "cathedral",
    kind: "boss",
    stageKey: "abyssal-cathedral",
    tonicHz: 146.83,
    homeRatios: HOME_RATIOS,
    loopTwoMultiplier: LOOP_TWO_MULTIPLIER,
    bpm: 136,
    meter: fourFour,
    cycleBars: 4,
    mode: "phrygian-dominant",
    scaleSemitones: [0, 1, 4, 5, 7, 8, 10],
    progression: [
      chord("d-minor-add-flat9", "Dm(add b9)", [0, 3, 7, 13], 12),
      chord("e-flat-major7-over-d", "Ebmaj7/D", [0, 1, 5, 8], 4),
      chord("c-minor-over-d", "Cm/D", [0, 3, 8, 10], 8),
      chord("a7-flat9-over-d", "A7(b9)/D", [-1, 2, 7, 8], 4),
      chord("d-minor", "Dm", [0, 3, 7, 12], 4),
    ],
    accompanimentVoices: {
      pedal: accompanimentVoice(-1, [0, 0, 0, -1, 0]),
      pulse: accompanimentVoice(0, [7, 5, 8, 7, 3]),
      danger: accompanimentVoice(1, [1, 8, 10, 2, 7]),
      loop: accompanimentVoice(1, [12, 1, 3, 8, 12]),
    },
    percussion: asymmetricProcessionPercussion(),
  },
});

export const musicPhaseTransforms = deepFreeze({
  seraph: [
    {
      key: "crown-spiral",
      inversionPattern: [0, 1, 0, 1],
      openChordIndexes: [],
      contractChordIndexes: [],
      extraPercussion: [
        { step: 9, instrument: "air-tick", velocity: 0.34 },
        { step: 17, instrument: "air-tick", velocity: 0.36 },
        { step: 25, instrument: "air-tick", velocity: 0.38 },
      ],
      descendingFill: false,
    },
    {
      key: "halo-bloom",
      inversionPattern: [0, 0, 0, 0],
      openChordIndexes: [1, 2],
      contractChordIndexes: [],
      extraPercussion: [
        { step: 10, instrument: "body", velocity: 0.54 },
        { step: 18, instrument: "body", velocity: 0.58 },
        { step: 26, instrument: "body", velocity: 0.62 },
      ],
      descendingFill: false,
    },
    {
      key: "starfall-rite",
      inversionPattern: [0, 0, 1, 1],
      openChordIndexes: [],
      contractChordIndexes: [1, 2],
      extraPercussion: [
        { step: 15, instrument: "body", velocity: 0.5 },
        { step: 23, instrument: "body", velocity: 0.56 },
      ],
      descendingFill: true,
    },
  ],
  prism: [
    {
      key: "crystal-lattice",
      inversionPattern: [0, 1, 0, 1, 0, 1],
      openChordIndexes: [],
      contractChordIndexes: [],
      extraPercussion: [
        { step: 12, instrument: "glass-tick", velocity: 0.42 },
        { step: 28, instrument: "glass-tick", velocity: 0.46 },
      ],
      descendingFill: false,
    },
    {
      key: "refraction-choir",
      inversionPattern: [0, 0, 1, 0, 1, 0],
      openChordIndexes: [1, 4],
      contractChordIndexes: [],
      extraPercussion: [
        { step: 3, instrument: "body", velocity: 0.46 },
        { step: 11, instrument: "body", velocity: 0.5 },
        { step: 19, instrument: "body", velocity: 0.54 },
        { step: 27, instrument: "body", velocity: 0.58 },
      ],
      descendingFill: false,
    },
    {
      key: "prismatic-tide",
      inversionPattern: [0, 1, 1, 0, 1, 0],
      openChordIndexes: [0, 2, 4],
      contractChordIndexes: [1, 3, 5],
      extraPercussion: [
        { step: 1, instrument: "glass-tick", velocity: 0.38 },
        { step: 5, instrument: "glass-tick", velocity: 0.4 },
        { step: 9, instrument: "glass-tick", velocity: 0.42 },
        { step: 13, instrument: "glass-tick", velocity: 0.44 },
        { step: 17, instrument: "glass-tick", velocity: 0.46 },
        { step: 21, instrument: "glass-tick", velocity: 0.48 },
        { step: 25, instrument: "glass-tick", velocity: 0.5 },
        { step: 29, instrument: "glass-tick", velocity: 0.52 },
      ],
      descendingFill: false,
    },
  ],
  cathedral: [
    {
      key: "chorus-of-fangs",
      inversionPattern: [0, 0, 1, 0, 1],
      openChordIndexes: [2],
      contractChordIndexes: [],
      extraPercussion: [
        { step: 3, instrument: "breath", velocity: 0.42 },
        { step: 11, instrument: "breath", velocity: 0.46 },
        { step: 19, instrument: "breath", velocity: 0.5 },
        { step: 27, instrument: "breath", velocity: 0.54 },
      ],
      descendingFill: false,
    },
    {
      key: "spine-cathedral",
      inversionPattern: [0, 1, 0, 1, 0],
      openChordIndexes: [0, 4],
      contractChordIndexes: [],
      extraPercussion: [
        { step: 1, instrument: "metal-gate", velocity: 0.42 },
        { step: 9, instrument: "metal-gate", velocity: 0.46 },
        { step: 17, instrument: "metal-gate", velocity: 0.5 },
        { step: 25, instrument: "metal-gate", velocity: 0.54 },
      ],
      descendingFill: false,
    },
    {
      key: "maw-singularity",
      inversionPattern: [0, 0, 0, 1, 0],
      openChordIndexes: [],
      contractChordIndexes: [1, 2, 3],
      extraPercussion: [
        { step: 7, instrument: "body", velocity: 0.58 },
        { step: 15, instrument: "body", velocity: 0.62 },
        { step: 23, instrument: "body", velocity: 0.66 },
        { step: 31, instrument: "body", velocity: 0.7 },
      ],
      descendingFill: false,
    },
  ],
});

const neutralPhaseTransform = deepFreeze({
  key: null,
  inversionPattern: [],
  openChordIndexes: [],
  contractChordIndexes: [],
  extraPercussion: [],
  descendingFill: false,
});

export function getMusicProfile(sectionKey) {
  return musicProfiles[sectionKey] ?? null;
}

export function listMusicProfiles() {
  return Object.values(musicProfiles);
}

export function getMusicPhaseTransform(sectionKey, phaseIndex = 0) {
  const phases = musicPhaseTransforms[sectionKey];
  if (!phases) return neutralPhaseTransform;
  const boundedIndex = Math.max(0, Math.min(phases.length - 1, Math.trunc(phaseIndex)));
  return phases[boundedIndex];
}

export function listMusicPhaseTransforms() {
  return Object.entries(musicPhaseTransforms).flatMap(([sectionKey, phases]) =>
    phases.map((phase, phaseIndex) => ({ sectionKey, phaseIndex, ...phase }))
  );
}
