export function sfxShoot(audio) {
  audio.playNoise(0.05, {
    amp: 0.05,
    filter: 2200,
    filterType: "bandpass",
    q: 1.8,
    attack: 0.004,
    release: 0.045,
  });
  audio.playTone("triangle", 430, 0.14, {
    amp: 0.08,
    slide: 1.45,
    attack: 0.004,
    release: 0.08,
    filter: 2600,
  });
  audio.playTone("sine", 860, 0.08, {
    amp: 0.035,
    slide: 0.86,
    attack: 0.004,
    release: 0.05,
    detune: -6,
  });
}

export function sfxEnemyPop(audio) {
  audio.playNoise(0.18, {
    amp: 0.14,
    filter: 1500,
    filterType: "bandpass",
    q: 0.9,
    attack: 0.01,
    release: 0.12,
  });
  audio.playTone("triangle", 180, 0.24, {
    amp: 0.09,
    slide: 1.8,
    attack: 0.01,
    release: 0.18,
  });
  audio.playTone("sine", 420, 0.16, {
    amp: 0.04,
    slide: 0.72,
    attack: 0.008,
    release: 0.11,
  });
}

export function sfxPlayerHit(audio) {
  audio.playNoise(0.34, {
    amp: 0.24,
    filter: 950,
    filterType: "highpass",
    q: 0.8,
    attack: 0.006,
    release: 0.22,
  });
  audio.playTone("sawtooth", 132, 0.28, {
    amp: 0.11,
    slide: 0.64,
    attack: 0.008,
    release: 0.18,
    filter: 1200,
  });
  audio.playTone("sine", 248, 0.22, {
    amp: 0.05,
    slide: 0.74,
    attack: 0.01,
    release: 0.16,
  });
}

export function sfxBossPhase(audio) {
  audio.playChord([156, 234, 312], 0.78, {
    type: "sine",
    amp: 0.22,
    spread: 6,
    attack: 0.03,
    release: 0.62,
    filter: 1800,
  });
  audio.playNoise(0.24, {
    amp: 0.06,
    filter: 1800,
    filterType: "bandpass",
    attack: 0.01,
    release: 0.18,
  });
}

export function sfxBossDefeat(audio) {
  audio.playNoise(0.56, {
    amp: 0.28,
    filter: 740,
    filterType: "bandpass",
    q: 0.6,
    attack: 0.02,
    release: 0.42,
  });
  audio.playChord([82, 123, 164], 0.82, {
    type: "triangle",
    amp: 0.24,
    spread: 8,
    slide: 2.6,
    attack: 0.02,
    release: 0.58,
    filter: 1200,
  });
  audio.playTone("sine", 61, 0.94, {
    amp: 0.08,
    slide: 1.6,
    attack: 0.03,
    release: 0.8,
  });
}

export function sfxStart(audio) {
  audio.playChord([260, 390, 520], 0.42, {
    type: "sine",
    amp: 0.18,
    spread: 4,
    attack: 0.02,
    release: 0.32,
    filter: 1800,
  });
  audio.playTone("triangle", 780, 0.18, {
    amp: 0.05,
    slide: 1.05,
    attack: 0.01,
    release: 0.14,
  });
}
