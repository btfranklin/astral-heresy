import assert from "node:assert/strict";
import test from "node:test";

import {
  getMusicPhaseTransform,
  getMusicProfile,
  listMusicPhaseTransforms,
  listMusicProfiles,
} from "../../../src/audio/musicProfiles.js";
import { planMusicCycle } from "../../../src/audio/musicSequencer.js";

function pitchClass(semitones) {
  return ((semitones % 12) + 12) % 12;
}

const profileKeys = [
  "nebula-gate",
  "seraph",
  "crystalline-choir",
  "prism",
  "abyssal-cathedral",
  "cathedral",
];

test("all encounters define frozen, unequal, and distinct minor processions", () => {
  const profiles = listMusicProfiles();
  assert.deepEqual(profiles.map(({ key }) => key), profileKeys);
  assert.deepEqual(profiles.map(({ bpm }) => bpm), [96, 138, 118, 152, 82, 136]);
  assert.deepEqual(
    profiles.map(({ meter }) => `${meter.numerator}/${meter.denominator}`),
    ["6/8", "4/4", "4/4", "4/4", "12/8", "4/4"]
  );

  const signatures = new Set();
  for (const profile of profiles) {
    assert.equal(Object.isFrozen(profile), true);
    assert.deepEqual(profile.homeRatios, [1, 1.2, 1.5]);
    assert.equal(profile.loopTwoMultiplier, 1.06);
    assert.equal(profile.cycleBars, 4);
    assert.equal(profile.scaleSemitones.every(Number.isFinite), true);
    assert.equal(profile.progression.length >= 4, true);
    assert.equal(
      profile.progression.reduce((sum, entry) => sum + entry.durationSteps, 0),
      profile.meter.stepsPerBar * profile.cycleBars
    );
    assert.equal(
      profile.progression.every(
        ({ semitones, durationSteps }) =>
          Number.isInteger(durationSteps) &&
          durationSteps > 0 &&
          semitones.length === 4 &&
          semitones.every(Number.isFinite) &&
          [...semitones].sort((left, right) => left - right).every(
            (value, index) => value === semitones[index]
          )
      ),
      true
    );
    assert.equal(
      new Set(profile.progression.map(({ durationSteps }) => durationSteps)).size > 1,
      true
    );
    assert.deepEqual(Object.keys(profile.accompanimentVoices), [
      "pedal",
      "pulse",
      "danger",
      "loop",
    ]);
    for (const voice of Object.values(profile.accompanimentVoices)) {
      assert.equal(Number.isInteger(voice.octave), true);
      assert.equal(voice.semitones.length, profile.progression.length);
      assert.equal(voice.semitones.every(Number.isFinite), true);
      assert.equal(
        voice.deliberateTensions.every(
          (chordIndex) =>
            Number.isInteger(chordIndex) &&
            chordIndex >= 0 &&
            chordIndex < profile.progression.length
        ),
        true
      );
    }
    assert.equal(profile.percussion.patternSteps > 0, true);
    assert.equal(profile.percussion.tiers.length, 3);
    assert.equal(
      profile.percussion.tiers.every((tier) =>
        tier.every(
          ({ step, velocity }) =>
            Number.isInteger(step) &&
            step >= 0 &&
            step < profile.percussion.patternSteps &&
            velocity > 0 &&
            velocity <= 1
        )
      ),
      true
    );
    signatures.add(
      JSON.stringify(
        profile.progression.map(({ semitones, durationSteps }) => [
          semitones.map(pitchClass),
          durationSteps,
        ])
      )
    );
  }
  assert.equal(signatures.size, profiles.length);

  for (const boss of profiles.filter(({ kind }) => kind === "boss")) {
    assert.equal(boss.bpm > getMusicProfile(boss.stageKey).bpm, true);
  }
});

test("boss percussion is urgent without forcing every encounter into one beat", () => {
  const seraph = getMusicProfile("seraph").percussion.tiers[0];
  const prism = getMusicProfile("prism").percussion.tiers[0];
  const cathedral = getMusicProfile("cathedral").percussion.tiers[0];

  assert.deepEqual(seraph.map(({ step }) => step), [0, 2, 4, 6]);
  assert.equal(seraph.every(({ fourOnFloor }) => fourOnFloor), true);
  assert.deepEqual(prism.map(({ step }) => step), [0, 3, 4, 6]);
  assert.equal(prism.every(({ driving }) => driving), true);
  assert.deepEqual(cathedral.map(({ step }) => step), [0, 3, 6]);
  assert.equal(cathedral.every(({ driving }) => driving), true);

  assert.equal(getMusicProfile("seraph").percussion.identity, "orbital-assault");
  assert.equal(getMusicProfile("prism").percussion.identity, "fractured-motor");
  assert.equal(
    getMusicProfile("cathedral").percussion.identity,
    "asymmetric-procession"
  );
});

test("every sustained accompaniment path belongs to its chord or declares its tension", () => {
  const declaredTensions = [];
  for (const profile of listMusicProfiles()) {
    for (const [role, voice] of Object.entries(profile.accompanimentVoices)) {
      voice.semitones.forEach((semitones, chordIndex) => {
        const chordClasses = new Set(
          profile.progression[chordIndex].semitones.map(pitchClass)
        );
        const belongsToChord = chordClasses.has(pitchClass(semitones));
        const isDeclared = voice.deliberateTensions.includes(chordIndex);
        assert.equal(
          belongsToChord || isDeclared,
          true,
          `${profile.key} ${role} is unrelated to chord ${chordIndex}`
        );
        assert.equal(
          belongsToChord && isDeclared,
          false,
          `${profile.key} ${role} declares a consonant chord tone as tension`
        );
        if (isDeclared) declaredTensions.push([profile.key, role, chordIndex, semitones]);
      });
    }
  }

  assert.deepEqual(declaredTensions, [
    ["nebula-gate", "pedal", 3, 0],
    ["seraph", "pedal", 3, 0],
  ]);
});

test("planner emits cumulative unequal chord spans and meter-aware percussion", () => {
  const expectations = {
    "nebula-gate": { steps: [0, 9, 12, 18], durations: [9, 3, 6, 6], cycle: 24 },
    seraph: { steps: [0, 8, 12, 24], durations: [8, 4, 12, 8], cycle: 32 },
    "crystalline-choir": {
      steps: [0, 8, 12, 24],
      durations: [8, 4, 12, 8],
      cycle: 32,
    },
    prism: {
      steps: [0, 6, 12, 16, 24, 28],
      durations: [6, 6, 4, 8, 4, 4],
      cycle: 32,
    },
    "abyssal-cathedral": {
      steps: [0, 12, 18, 30],
      durations: [12, 6, 12, 18],
      cycle: 48,
    },
    cathedral: {
      steps: [0, 12, 16, 24, 28],
      durations: [12, 4, 8, 4, 4],
      cycle: 32,
    },
  };

  for (const [sectionKey, expected] of Object.entries(expectations)) {
    const plan = planMusicCycle({
      sectionKey,
      arrangementTier: 2,
      percussionTier: 2,
    });
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(plan.stepsPerCycle, expected.cycle);
    assert.deepEqual(plan.chords.map(({ step }) => step), expected.steps);
    assert.deepEqual(
      plan.chords.map(({ durationSteps }) => durationSteps),
      expected.durations
    );
    assert.equal(
      [...plan.chords, ...plan.percussion].every(
        ({ step }) => Number.isInteger(step) && step >= 0 && step < plan.stepsPerCycle
      ),
      true
    );
  }

  const nebula = planMusicCycle({ sectionKey: "nebula-gate" });
  assert.deepEqual(
    nebula.chords[0].accompaniment.map(
      ({ role, semitones, deliberateTension }) => [
        role,
        semitones,
        deliberateTension,
      ]
    ),
    [
      ["pedal", -12, false],
      ["pulse", 7, false],
      ["danger", 15, false],
      ["loop", 26, false],
    ]
  );
});

test("same musical inputs produce the same stable procession", () => {
  for (const sectionKey of profileKeys) {
    const input = {
      sectionKey,
      phaseIndex: 2,
      phraseIndex: 5,
      arrangementTier: 2,
      loopIndex: 1,
      chainActive: true,
      grazeActive: true,
    };
    assert.deepEqual(planMusicCycle(input), planMusicCycle(input));
    assert.deepEqual(
      planMusicCycle({ ...input, phraseIndex: 6 }).chords,
      planMusicCycle(input).chords
    );
  }
});

test("state changes arrangement around each progression without replacing it", () => {
  for (const sectionKey of profileKeys) {
    const base = { sectionKey, phraseIndex: 1 };
    const sparse = planMusicCycle({ ...base, arrangementTier: 0 });
    const complete = planMusicCycle({ ...base, arrangementTier: 2 });
    const danger = planMusicCycle({ ...base, arrangementTier: 2, lowHull: true });
    const charged = planMusicCycle({
      ...base,
      arrangementTier: 2,
      chainActive: true,
      grazeActive: true,
      loopIndex: 1,
    });

    assert.equal(sparse.percussion.length < complete.percussion.length, true);
    assert.equal(
      danger.percussion.filter(({ heartbeat }) => heartbeat).length,
      getMusicProfile(sectionKey).cycleBars
    );
    assert.equal(charged.percussion.some(({ ritualAccent }) => ritualAccent), true);
    assert.equal(charged.percussion.some(({ subdivision }) => subdivision), true);
    assert.equal(charged.pitchMultiplier, 1.06);
    assert.equal(
      charged.chords.every(({ pitchMultiplier }) => pitchMultiplier === 1.06),
      true
    );
    assert.deepEqual(
      charged.chords.map(({ key }) => key),
      complete.chords.map(({ key }) => key)
    );
  }
});

test("all nine boss phases retain their progression while changing ritual", () => {
  assert.deepEqual(
    listMusicPhaseTransforms().map(({ key }) => key),
    [
      "crown-spiral",
      "halo-bloom",
      "starfall-rite",
      "crystal-lattice",
      "refraction-choir",
      "prismatic-tide",
      "chorus-of-fangs",
      "spine-cathedral",
      "maw-singularity",
    ]
  );

  for (const sectionKey of ["seraph", "prism", "cathedral"]) {
    const plans = [0, 1, 2].map((phaseIndex) =>
      planMusicCycle({
        sectionKey,
        phaseIndex,
        arrangementTier: 2,
        percussionTier: 2,
      })
    );
    assert.equal(getMusicPhaseTransform(sectionKey, -5).key, plans[0].phaseKey);
    assert.equal(getMusicPhaseTransform(sectionKey, 99).key, plans[2].phaseKey);
    assert.deepEqual(
      plans[0].chords.map(({ key }) => key),
      plans[1].chords.map(({ key }) => key)
    );
    assert.deepEqual(
      plans[1].chords.map(({ key }) => key),
      plans[2].chords.map(({ key }) => key)
    );
    assert.equal(
      new Set(
        plans.map((plan) =>
          JSON.stringify({
            voicing: plan.chords.map(({ semitones }) => semitones),
            percussion: plan.percussion,
          })
        )
      ).size,
      3
    );
  }

  const starfall = planMusicCycle({
    sectionKey: "seraph",
    phaseIndex: 2,
    arrangementTier: 2,
  });
  assert.deepEqual(
    starfall.percussion.filter(({ fill }) => fill).map(({ pitchSemitones }) => pitchSemitones),
    [7, 4, 2, 0]
  );
});

test("unknown sections fail closed before planning", () => {
  assert.equal(getMusicProfile("missing"), null);
  assert.throws(
    () => planMusicCycle({ sectionKey: "unknown" }),
    /Unknown music section: unknown/
  );
});
