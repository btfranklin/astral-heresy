const MAX_FEEDBACK = 0.68;

function freezeProfile(profile) {
  return Object.freeze({
    ...profile,
    delays: Object.freeze([...profile.delays]),
    modes: Object.freeze(profile.modes.map((mode) => Object.freeze({ ...mode }))),
    wave: Object.freeze([...profile.wave]),
  });
}

export const audioStageProfiles = Object.freeze({
  "nebula-gate": freezeProfile({
    key: "nebula-gate",
    root: 164.81,
    delays: [0.113, 0.173, 0.271, 0.397],
    feedback: 0.32,
    impulseDuration: 1.4,
    impulseDamping: 2.8,
    filterCutoff: 5600,
    wet: 0.19,
    width: 0.64,
    orbitRate: 0.22,
    modulationRate: 19,
    memoryGain: 0.62,
    noiseGain: 0.008,
    modes: [
      { ratio: 2, q: 9, gain: 0.1 },
      { ratio: 2.5, q: 12, gain: 0.08 },
      { ratio: 3.5, q: 14, gain: 0.06 },
      { ratio: 5, q: 10, gain: 0.045 },
    ],
    wave: [0, 1, 0.18, 0.34, 0.05, 0.18, 0.02, 0.1],
  }),
  "crystalline-choir": freezeProfile({
    key: "crystalline-choir",
    root: 196,
    delays: [0.012, 0.017, 0.023, 0.031],
    feedback: 0.46,
    impulseDuration: 0.8,
    impulseDamping: 5.4,
    filterCutoff: 7200,
    wet: 0.17,
    width: 0.82,
    orbitRate: 0.34,
    modulationRate: 41,
    memoryGain: 0.45,
    noiseGain: 0.002,
    modes: [
      { ratio: 2, q: 20, gain: 0.09 },
      { ratio: 2.5, q: 26, gain: 0.075 },
      { ratio: 3, q: 30, gain: 0.06 },
      { ratio: 4.5, q: 24, gain: 0.05 },
    ],
    wave: [0, 1, 0.08, 0.44, 0.04, 0.28, 0.03, 0.2, 0.02, 0.14],
  }),
  "abyssal-cathedral": freezeProfile({
    key: "abyssal-cathedral",
    root: 146.83,
    delays: [0.149, 0.211, 0.307, 0.431],
    feedback: 0.6,
    impulseDuration: 2.8,
    impulseDamping: 1.8,
    filterCutoff: 2200,
    wet: 0.22,
    width: 0.9,
    orbitRate: 0.13,
    modulationRate: 27,
    memoryGain: 0.78,
    noiseGain: 0.005,
    modes: [
      { ratio: 0.5, q: 7, gain: 0.11 },
      { ratio: 1.9, q: 10, gain: 0.09 },
      { ratio: 3.8, q: 12, gain: 0.065 },
      { ratio: 7.4, q: 9, gain: 0.045 },
    ],
    wave: [0, 1, 0.42, 0.24, 0.18, 0.1, 0.08, 0.05],
  }),
});

const neutralTransform = Object.freeze({
  pulseRate: 1,
  pulseGain: 1,
  upperGain: 1,
  wavefold: 0,
  memory: 0.35,
  decay: 1,
  width: 1,
  descent: 0,
  formant: 0,
  modalSharpness: 1,
  sideband: 0,
  delayScale: 1,
  dispersion: 0,
});

function bossPhases(phases) {
  return Object.freeze(phases.map((phase) => Object.freeze({ ...neutralTransform, ...phase })));
}

export const audioBossProfiles = Object.freeze({
  seraph: bossPhases([
    { key: "crown-spiral", pulseRate: 1.22, pulseGain: 1.2, memory: 0.42, width: 1.08, dispersion: 0.24 },
    { key: "halo-bloom", pulseRate: 1.08, upperGain: 1.42, memory: 0.5, width: 1.18 },
    { key: "starfall-rite", pulseRate: 1.38, pulseGain: 1.35, memory: 0.62, descent: 0.7 },
  ]),
  prism: bossPhases([
    { key: "crystal-lattice", upperGain: 1.24, decay: 1.08, memory: 0.44, modalSharpness: 1.28 },
    { key: "refraction-choir", upperGain: 1.38, wavefold: 0.28, memory: 0.56, width: 1.12, sideband: 0.48 },
    { key: "prismatic-tide", pulseRate: 1.3, wavefold: 0.52, memory: 0.64, width: 1.2, sideband: 0.3, dispersion: 0.72 },
  ]),
  cathedral: bossPhases([
    { key: "chorus-of-fangs", formant: 0.38, decay: 1.08, memory: 0.48 },
    { key: "spine-cathedral", formant: 0.55, decay: 1.14, pulseGain: 1.2, memory: 0.58, delayScale: 1.16 },
    { key: "maw-singularity", formant: 0.75, decay: 1.12, memory: 0.72, width: 0.58 },
  ]),
});

export function clampFeedback(value) {
  return Math.max(0, Math.min(MAX_FEEDBACK, value));
}

export function getAudioStageProfile(key) {
  return audioStageProfiles[key] ?? audioStageProfiles["nebula-gate"];
}

export function getAudioBossTransform(bossKey, phaseIndex = 0) {
  const phases = audioBossProfiles[bossKey];
  return phases?.[Math.max(0, Math.min(phases.length - 1, phaseIndex))] ?? neutralTransform;
}

export function listAudioStageProfiles() {
  return Object.values(audioStageProfiles);
}

export function listAudioBossProfiles() {
  return Object.entries(audioBossProfiles).flatMap(([bossKey, phases]) =>
    phases.map((phase, phaseIndex) => ({ bossKey, phaseIndex, ...phase }))
  );
}
