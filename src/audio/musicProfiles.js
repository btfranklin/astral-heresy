const HOME_RATIOS = [1, 6 / 5, 3 / 2];
const LOOP_TWO_MULTIPLIER = 1.06;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function chord(
  key,
  label,
  romanNumeral,
  harmonicFunction,
  semitones,
  durationSteps
) {
  return {
    key,
    label,
    romanNumeral,
    harmonicFunction,
    semitones,
    durationSteps,
  };
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
      chord("e-minor", "Em", "i", "tonic", [0, 3, 7, 12], 6),
      chord("c-major", "C", "VI", "predominant", [0, 3, 8, 12], 6),
      chord("g-major", "G", "III", "tonic-substitute", [-2, 3, 7, 10], 6),
      chord("d-major", "D", "VII", "dominant", [-2, 2, 5, 10], 6),
    ],
    accompanimentVoices: {
      bass: accompanimentVoice(-1, [0, 8, 3, -2]),
      pulse: accompanimentVoice(0, [7, 3, 7, 5]),
      danger: accompanimentVoice(1, [3, 8, 10, 2]),
      loop: accompanimentVoice(1, [12, 12, 10, 10]),
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
    mode: "minor-with-raised-leading-tone",
    scaleSemitones: [0, 2, 3, 5, 7, 8, 10, 11],
    progression: [
      chord("e-minor", "Em", "i", "tonic", [0, 3, 7, 12], 8),
      chord("d-major", "D", "VII", "dominant", [-2, 2, 5, 10], 8),
      chord("c-major", "C", "VI", "predominant", [0, 3, 8, 12], 8),
      chord("a-minor", "Am", "iv", "predominant", [0, 5, 8, 12], 4),
      chord("b-dominant-seven", "B7", "V7", "dominant", [2, 5, 7, 11], 4),
    ],
    accompanimentVoices: {
      bass: accompanimentVoice(-1, [0, -2, -4, -7, -5]),
      pulse: accompanimentVoice(0, [7, 5, 3, 0, 2]),
      danger: accompanimentVoice(1, [3, 2, 8, 8, -1]),
      loop: accompanimentVoice(1, [12, 10, 12, 12, 5]),
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
    mode: "natural-minor",
    scaleSemitones: [0, 2, 3, 5, 7, 8, 10],
    progression: [
      chord("g-minor", "Gm", "i", "tonic", [0, 3, 7, 12], 8),
      chord("c-minor", "Cm", "iv", "predominant", [0, 5, 8, 12], 8),
      chord("f-major", "F", "VII", "dominant", [-2, 2, 5, 10], 8),
      chord("b-flat-major", "B♭", "III", "tonic-substitute", [-2, 3, 7, 10], 8),
    ],
    accompanimentVoices: {
      bass: accompanimentVoice(-1, [0, 5, -2, 3]),
      pulse: accompanimentVoice(0, [7, 8, 5, 7]),
      danger: accompanimentVoice(1, [3, 5, 2, 3]),
      loop: accompanimentVoice(1, [12, 12, 10, 10]),
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
    mode: "minor-with-raised-leading-tone",
    scaleSemitones: [0, 2, 3, 5, 7, 8, 10, 11],
    progression: [
      chord("g-minor", "Gm", "i", "tonic", [0, 3, 7, 12], 8),
      chord("c-minor", "Cm", "iv", "predominant", [0, 5, 8, 12], 8),
      chord("f-major", "F", "VII", "dominant", [-2, 2, 5, 10], 4),
      chord("b-flat-major", "B♭", "III", "tonic-substitute", [-2, 3, 7, 10], 4),
      chord("e-flat-major", "E♭", "VI", "predominant", [0, 3, 8, 12], 4),
      chord("d-dominant-seven", "D7", "V7", "dominant", [2, 5, 7, 11], 4),
    ],
    accompanimentVoices: {
      bass: accompanimentVoice(-1, [0, 5, -2, 3, -4, -5]),
      pulse: accompanimentVoice(0, [7, 8, 5, 7, 3, 2]),
      danger: accompanimentVoice(1, [3, 5, 2, 3, 8, -1]),
      loop: accompanimentVoice(1, [12, 12, 10, 10, 12, 5]),
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
    mode: "minor-with-raised-leading-tone",
    scaleSemitones: [0, 2, 3, 5, 7, 8, 10, 11],
    progression: [
      chord("d-minor", "Dm", "i", "tonic", [0, 3, 7, 12], 12),
      chord("c-major", "C", "VII", "dominant", [-2, 2, 5, 10], 12),
      chord("b-flat-major", "B♭", "VI", "predominant", [0, 3, 8, 12], 12),
      chord("a-dominant-seven", "A7", "V7", "dominant", [2, 5, 7, 11], 12),
    ],
    accompanimentVoices: {
      bass: accompanimentVoice(-1, [0, -2, -4, -5]),
      pulse: accompanimentVoice(0, [7, 5, 3, 2]),
      danger: accompanimentVoice(1, [3, 2, 8, -1]),
      loop: accompanimentVoice(1, [12, 10, 12, 5]),
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
    mode: "minor-with-raised-leading-tone",
    scaleSemitones: [0, 2, 3, 5, 7, 8, 10, 11],
    progression: [
      chord("d-minor", "Dm", "i", "tonic", [0, 3, 7, 12], 8),
      chord("b-flat-major", "B♭", "VI", "predominant", [0, 3, 8, 12], 8),
      chord("f-major", "F", "III", "tonic-substitute", [-2, 3, 7, 10], 4),
      chord("c-major", "C", "VII", "dominant", [-2, 2, 5, 10], 4),
      chord("g-minor", "Gm", "iv", "predominant", [0, 5, 8, 12], 4),
      chord("a-dominant-seven", "A7", "V7", "dominant", [2, 5, 7, 11], 4),
    ],
    accompanimentVoices: {
      bass: accompanimentVoice(-1, [0, -4, 3, -2, 5, -5]),
      pulse: accompanimentVoice(0, [7, 3, 7, 5, 8, 2]),
      danger: accompanimentVoice(1, [3, 8, 3, 2, 5, -1]),
      loop: accompanimentVoice(1, [12, 12, 10, 10, 12, 5]),
    },
    percussion: asymmetricProcessionPercussion(),
  },
});

export const musicPhaseTransforms = deepFreeze({
  seraph: [
    {
      key: "crown-spiral",
      inversionPattern: [0, 1, 0, 1, 0],
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
      inversionPattern: [0, 0, 0, 0, 0],
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
      inversionPattern: [0, 0, 1, 1, 0],
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
      inversionPattern: [0, 0, 1, 0, 1, 0],
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
      inversionPattern: [0, 1, 0, 1, 0, 1],
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
      inversionPattern: [0, 0, 0, 1, 0, 1],
      openChordIndexes: [],
      contractChordIndexes: [1, 2, 3, 4],
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
