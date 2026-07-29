import { getMusicPhaseTransform, getMusicProfile } from "./musicProfiles.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function invertChord(semitones, inversions) {
  const voiced = [...semitones];
  for (let index = 0; index < inversions; index += 1) {
    voiced[0] += 12;
    voiced.sort((left, right) => left - right);
  }
  return voiced;
}

function voiceChord(entry, chordIndex, transform, chainActive) {
  const inversions = transform.inversionPattern[chordIndex] ?? 0;
  const voiced = invertChord(entry.semitones, inversions);
  if (transform.openChordIndexes.includes(chordIndex)) {
    voiced[voiced.length - 1] += 12;
  }
  if (transform.contractChordIndexes.includes(chordIndex)) {
    voiced[voiced.length - 1] -= 12;
    voiced.sort((left, right) => left - right);
  }
  if (chainActive && chordIndex % 2 === 1) {
    voiced[voiced.length - 1] += 12;
  }
  return voiced;
}

function planAccompaniment(profile, chordIndex) {
  return Object.entries(profile.accompanimentVoices).map(([role, voice]) => ({
    role,
    semitones: voice.semitones[chordIndex] + voice.octave * 12,
    deliberateTension: voice.deliberateTensions.includes(chordIndex),
  }));
}

function planPercussion({
  profile,
  transform,
  stepsPerCycle,
  percussionTier,
  loopIndex,
  grazeActive,
  lowHull,
}) {
  const pattern = profile.percussion.tiers[percussionTier];
  const percussion = [];
  for (
    let offset = 0;
    offset < stepsPerCycle;
    offset += profile.percussion.patternSteps
  ) {
    for (const event of pattern) {
      const step = event.step + offset;
      if (step < stepsPerCycle) percussion.push({ ...event, step });
    }
  }

  percussion.push(
    ...transform.extraPercussion
      .filter(({ step }) => step < stepsPerCycle)
      .map((event) => ({ ...event }))
  );

  if (loopIndex > 0) {
    for (
      let barStart = profile.meter.stepsPerBar;
      barStart < stepsPerCycle;
      barStart += profile.meter.stepsPerBar * 2
    ) {
      percussion.push({
        step: barStart - 1,
        instrument: "air-tick",
        velocity: 0.24,
        subdivision: true,
      });
    }
  }

  if (grazeActive) {
    percussion.push({
      step: stepsPerCycle - 1,
      instrument: "air-tick",
      velocity: 0.24,
      ritualAccent: true,
    });
  }

  if (lowHull) {
    for (
      let step = Math.floor(profile.meter.stepsPerBar / 2);
      step < stepsPerCycle;
      step += profile.meter.stepsPerBar
    ) {
      percussion.push({
        step,
        instrument: "low",
        velocity: 0.34,
        heartbeat: true,
      });
    }
  }

  if (transform.descendingFill) {
    [7, 4, 2, 0].forEach((pitchSemitones, index) => {
      percussion.push({
        step: stepsPerCycle - 4 + index,
        instrument: "descending-fill",
        velocity: 0.42 + index * 0.04,
        pitchSemitones,
        fill: true,
      });
    });
  }

  return percussion.sort(
    (left, right) =>
      left.step - right.step ||
      left.instrument.localeCompare(right.instrument)
  );
}

export function planMusicCycle({
  sectionKey,
  phaseIndex = 0,
  phraseIndex = 0,
  arrangementTier = 0,
  percussionTier = arrangementTier,
  loopIndex = 0,
  chainActive = false,
  grazeActive = false,
  lowHull = false,
} = {}) {
  const profile = getMusicProfile(sectionKey);
  if (!profile) throw new Error(`Unknown music section: ${sectionKey}`);

  const tier = Math.max(0, Math.min(2, Math.trunc(arrangementTier)));
  const rhythmTier = Math.max(0, Math.min(2, Math.trunc(percussionTier)));
  const normalizedPhrase = Math.max(0, Math.trunc(phraseIndex));
  const normalizedLoop = Math.max(0, Math.trunc(loopIndex));
  const transform = getMusicPhaseTransform(sectionKey, phaseIndex);
  const stepsPerCycle = profile.progression.reduce(
    (sum, entry) => sum + entry.durationSteps,
    0
  );
  const pitchMultiplier = normalizedLoop > 0 ? profile.loopTwoMultiplier : 1;

  let chordStep = 0;
  const chords = profile.progression.map((entry, chordIndex) => {
    const plannedChord = {
      step: chordStep,
      durationSteps: entry.durationSteps,
      chordIndex,
      key: entry.key,
      semitones: voiceChord(entry, chordIndex, transform, chainActive),
      accompaniment: planAccompaniment(profile, chordIndex),
      pitchMultiplier,
    };
    chordStep += entry.durationSteps;
    return plannedChord;
  });

  return deepFreeze({
    sectionKey: profile.key,
    phaseKey: transform.key,
    phraseIndex: normalizedPhrase,
    arrangementTier: tier,
    percussionTier: rhythmTier,
    bpm: profile.bpm,
    meter: { ...profile.meter },
    stepsPerCycle,
    secondsPerStep: 60 / profile.bpm / profile.meter.stepsPerQuarter,
    pitchMultiplier,
    homeRatios: [...profile.homeRatios],
    chords,
    percussion: planPercussion({
      profile,
      transform,
      stepsPerCycle,
      percussionTier: rhythmTier,
      loopIndex: normalizedLoop,
      grazeActive,
      lowHull,
    }),
  });
}
