const repeat = 0;
const standard = 1;
const important = 2;
const critical = 3;

const definitions = Object.freeze({
  fire: {
    priority: repeat,
    minInterval: 0.07,
    maxConcurrent: 8,
    center: 0.72,
    build: () => [
      { source: "noise", duration: 0.05, amp: 0.05, filter: 2200, filterType: "bandpass", q: 1.8, attack: 0.004, release: 0.045, send: 0.16 },
      { source: "tone", type: "triangle", freq: 430, duration: 0.14, amp: 0.08, slide: 1.45, attack: 0.004, release: 0.08, filter: 2600, send: 0.13 },
      { source: "tone", type: "sine", freq: 860, duration: 0.08, amp: 0.035, slide: 0.86, attack: 0.004, release: 0.05, detune: -6, send: 0.08 },
    ],
  },
  graze: {
    priority: repeat,
    minInterval: 0.025,
    maxConcurrent: 6,
    center: 0.7,
    build: () => [
      { source: "noise", duration: 0.04, amp: 0.04, filter: 3200, filterType: "bandpass", q: 1.6, attack: 0.003, release: 0.035, send: 0.28 },
      { source: "tone", type: "sine", freq: 1040, duration: 0.08, amp: 0.03, slide: 1.08, attack: 0.003, release: 0.05, send: 0.3 },
    ],
  },
  "shield-absorb": {
    priority: important,
    minInterval: 0.08,
    maxConcurrent: 8,
    center: 0.82,
    build: ({ root }) => [
      { source: "chord", type: "sine", freqs: [root * 2, root * 2.5, root * 3], duration: 0.34, amp: 0.14, spread: 5, attack: 0.006, release: 0.27, filter: 3600, send: 0.42 },
      { source: "tone", type: "triangle", freq: root * 5, duration: 0.22, amp: 0.045, slide: 0.72, attack: 0.004, release: 0.18, filter: 4200, send: 0.3 },
    ],
  },
  "enemy-defeat": {
    priority: standard,
    minInterval: 0.018,
    maxConcurrent: 14,
    center: 0.62,
    build: () => [
      { source: "noise", duration: 0.18, amp: 0.14, filter: 1500, filterType: "bandpass", q: 0.9, attack: 0.01, release: 0.12, send: 0.34 },
      { source: "tone", type: "triangle", freq: 180, duration: 0.24, amp: 0.09, slide: 1.8, attack: 0.01, release: 0.18, send: 0.32 },
      { source: "tone", type: "sine", freq: 420, duration: 0.16, amp: 0.04, slide: 0.72, attack: 0.008, release: 0.11, send: 0.2 },
    ],
  },
  "chain-milestone": {
    priority: important,
    minInterval: 0.08,
    maxConcurrent: 9,
    center: 0.84,
    build: ({ root }) => [
      { source: "chord", type: "triangle", freqs: [root * 1.9, root * 2.85, root * 3.8], duration: 0.22, amp: 0.11, spread: 8, attack: 0.01, release: 0.16, filter: 2200, send: 0.4 },
    ],
  },
  "player-hit": {
    priority: critical,
    minInterval: 0.08,
    maxConcurrent: 9,
    center: 0.92,
    build: () => [
      { source: "noise", duration: 0.34, amp: 0.24, filter: 950, filterType: "highpass", q: 0.8, attack: 0.006, release: 0.22, send: 0.46 },
      { source: "tone", type: "sawtooth", freq: 132, duration: 0.28, amp: 0.11, slide: 0.64, attack: 0.008, release: 0.18, filter: 1200, send: 0.42 },
      { source: "tone", type: "sine", freq: 248, duration: 0.22, amp: 0.05, slide: 0.74, attack: 0.01, release: 0.16, send: 0.24 },
    ],
  },
  burst: {
    priority: critical,
    minInterval: 0.12,
    maxConcurrent: 8,
    center: 0.88,
    build: () => [
      { source: "noise", duration: 0.28, amp: 0.2, filter: 1500, filterType: "bandpass", q: 1, attack: 0.004, release: 0.22, send: 0.58 },
      { source: "chord", type: "sawtooth", freqs: [120, 180, 270], duration: 0.36, amp: 0.18, spread: 10, slide: 1.9, attack: 0.008, release: 0.24, filter: 1200, send: 0.64 },
    ],
  },
  "boss-arrival": {
    priority: critical,
    minInterval: 0.4,
    maxConcurrent: 8,
    center: 0.9,
    build: ({ root }) => [
      { source: "chord", type: "sine", freqs: [root, root * 1.5, root * 2], duration: 0.92, amp: 0.24, spread: 7, attack: 0.035, release: 0.76, filter: 1900, send: 0.72 },
      { source: "noise", duration: 0.28, amp: 0.07, filter: 1700, filterType: "bandpass", attack: 0.01, release: 0.2, send: 0.48 },
    ],
  },
  "boss-phase": {
    priority: critical,
    minInterval: 0.3,
    maxConcurrent: 8,
    center: 0.9,
    build: ({ root, payload }) => {
      const phaseLift = 1 + Math.max(0, payload.phaseIndex || 0) * 0.06;
      return [
        { source: "chord", type: "sine", freqs: [root * phaseLift, root * 1.5 * phaseLift, root * 2 * phaseLift], duration: 0.78, amp: 0.22, spread: 6, attack: 0.03, release: 0.62, filter: 1800, send: 0.66 },
        { source: "noise", duration: 0.24, amp: 0.06, filter: 1800, filterType: "bandpass", attack: 0.01, release: 0.18, send: 0.42 },
      ];
    },
  },
  weakpoint: {
    priority: important,
    minInterval: 0.035,
    maxConcurrent: 10,
    center: 0.86,
    build: () => [
      { source: "tone", type: "square", freq: 680, duration: 0.12, amp: 0.05, slide: 1.3, attack: 0.004, release: 0.08, filter: 2200, filterType: "bandpass", send: 0.34 },
      { source: "tone", type: "sine", freq: 1320, duration: 0.08, amp: 0.025, slide: 0.92, attack: 0.004, release: 0.05, send: 0.28 },
    ],
  },
  "boss-defeat": {
    priority: critical,
    minInterval: 0.5,
    maxConcurrent: 12,
    center: 0.88,
    build: ({ root }) => [
      { source: "noise", duration: 0.56, amp: 0.28, filter: 740, filterType: "bandpass", q: 0.6, attack: 0.02, release: 0.42, send: 0.78 },
      { source: "chord", type: "triangle", freqs: [root * 0.5, root * 0.75, root], duration: 0.82, amp: 0.24, spread: 8, slide: 2.6, attack: 0.02, release: 0.58, filter: 1200, send: 0.82 },
      { source: "tone", type: "sine", freq: Math.max(48, root * 0.37), duration: 0.94, amp: 0.08, slide: 1.6, attack: 0.03, release: 0.8, send: 0.68 },
    ],
  },
  pickup: {
    priority: important,
    minInterval: 0.04,
    maxConcurrent: 10,
    center: 0.82,
    build: ({ payload }) => {
      const category = payload.category || "utility";
      const chord = category === "risk"
        ? [330, 440, 554]
        : category === "weapon"
          ? [392, 523, 698]
          : [392, 523, 659];
      return [
        { source: "chord", type: category === "risk" ? "triangle" : "sine", freqs: chord, duration: 0.22, amp: 0.12, spread: 4, attack: 0.01, release: 0.16, filter: category === "risk" ? 1800 : 2200, send: category === "risk" ? 0.48 : 0.38 },
        { source: "tone", type: category === "weapon" ? "triangle" : "sine", freq: category === "risk" ? 248 : 780, duration: 0.18, amp: 0.04, slide: category === "risk" ? 0.92 : 1.08, attack: 0.01, release: 0.14, filter: 2200, send: 0.3 },
      ];
    },
  },
  start: {
    priority: critical,
    minInterval: 0.2,
    maxConcurrent: 8,
    center: 0.94,
    build: ({ root }) => [
      { source: "chord", type: "sine", freqs: [root * 1.58, root * 2.37, root * 3.16], duration: 0.42, amp: 0.18, spread: 4, attack: 0.02, release: 0.32, filter: 1800, send: 0.5 },
      { source: "tone", type: "triangle", freq: root * 4.73, duration: 0.18, amp: 0.05, slide: 1.05, attack: 0.01, release: 0.14, send: 0.28 },
    ],
  },
  "player-death": {
    priority: critical,
    minInterval: 1,
    maxConcurrent: 12,
    center: 0.98,
    build: ({ root }) => [
      { source: "noise", duration: 0.72, amp: 0.32, filter: 680, filterType: "bandpass", q: 0.7, attack: 0.003, release: 0.58, send: 0.9 },
      { source: "tone", type: "sawtooth", freq: root, duration: 1.8, amp: 0.14, slide: 0.5, attack: 0.006, release: 1.35, filter: 1100, send: 0.78 },
      { source: "chord", type: "sine", freqs: [root * 0.5, root * 0.75, root], duration: 3.2, amp: 0.2, spread: 3, attack: 0.06, release: 3.05, decay: "linear", filter: 900, send: 0.86 },
    ],
  },
  victory: {
    priority: critical,
    minInterval: 1,
    maxConcurrent: 10,
    center: 0.94,
    build: ({ root }) => [
      { source: "chord", type: "sine", freqs: [root, root * 1.5, root * 2], duration: 3, amp: 0.18, spread: 5, slide: 1.015, attack: 0.08, release: 2.85, filter: 1600, send: 0.72 },
      { source: "tone", type: "triangle", freq: root * 3, duration: 1.4, amp: 0.04, slide: 1.5, attack: 0.04, release: 1.2, filter: 2600, send: 0.5 },
    ],
  },
});

export function listAudioEventKinds() {
  return Object.keys(definitions);
}

export function getAudioEventRecipe(kind, { root = 164.81, payload = {} } = {}) {
  const definition = definitions[kind];
  if (!definition) return null;
  return {
    kind,
    priority: definition.priority,
    minInterval: definition.minInterval,
    maxConcurrent: definition.maxConcurrent,
    center: definition.center,
    voices: definition.build({ root, payload }),
  };
}

export function sfxShoot(audio, payload = {}) {
  return audio.playEvent("fire", payload);
}

export function sfxGraze(audio, payload = {}) {
  return audio.playEvent("graze", payload);
}

export function sfxShieldAbsorb(audio, payload = {}) {
  return audio.playEvent("shield-absorb", payload);
}

export function sfxEnemyPop(audio, payload = {}) {
  return audio.playEvent("enemy-defeat", payload);
}

export function sfxChain(audio, payload = {}) {
  return audio.playEvent("chain-milestone", payload);
}

export function sfxPlayerHit(audio, payload = {}) {
  return audio.playEvent("player-hit", payload);
}

export function sfxPlayerDeath(audio, payload = {}) {
  return audio.endRun("death", payload);
}

export function sfxBurst(audio, payload = {}) {
  return audio.playEvent("burst", payload);
}

export function sfxBossArrival(audio, payload = {}) {
  return audio.playEvent("boss-arrival", payload);
}

export function sfxBossPhase(audio, payload = {}) {
  return audio.playEvent("boss-phase", payload);
}

export function sfxWeakpoint(audio, payload = {}) {
  return audio.playEvent("weakpoint", payload);
}

export function sfxBossDefeat(audio, payload = {}) {
  return audio.playEvent("boss-defeat", payload);
}

export function sfxPickup(audio, category = "utility", payload = {}) {
  return audio.playEvent("pickup", { ...payload, category });
}

export function sfxStart(audio, payload = {}) {
  return audio.playEvent("start", payload);
}

export function sfxVictory(audio, payload = {}) {
  return audio.endRun("victory", payload);
}
