import {
  clampFeedback,
  getAudioBossTransform,
  getAudioStageProfile,
} from "./audioProfiles.js";
import { mergeAudioWorld, panForWorldX } from "./audioState.js";
import { getMusicProfile } from "./musicProfiles.js";
import { planMusicCycle } from "./musicSequencer.js";
import { getAudioEventRecipe, listAudioEventKinds } from "./sfx.js";

const MAX_TEMPORARY_VOICES = 48;
const MAX_PERCUSSION_VOICES = 12;
const STAGE_CROSSFADE = 1.2;
const PHASE_SMOOTHING = 0.6;
const RESET_FADE = 0.03;
const SCORE_LOOKAHEAD = 0.25;
const SCORE_INTRO_DELAY = 0.35;
const SCORE_TRANSITION = 0.18;
const CHORD_CROSSFADE = 0.16;
const MUSIC_DUCK_GAIN = 10 ** (-5 / 20);
const MIN_GAIN = 0.0001;
const validEventKinds = new Set(listAudioEventKinds());
const musicDuckEvents = new Set([
  "shield-absorb",
  "player-hit",
  "burst",
  "boss-arrival",
  "boss-phase",
  "boss-defeat",
]);
const validScoreSoloBuses = new Set([null, "harmony", "percussion"]);

function makeRng(initialSeed) {
  let seed = initialSeed >>> 0 || 1;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    if (!seed) seed = 1;
    return seed / 0x100000000;
  };
}

function disconnect(node, target) {
  if (typeof node?.disconnect !== "function") return;
  try {
    if (target) node.disconnect(target);
    else node.disconnect();
  } catch (error) {
    if (error?.name !== "InvalidAccessError") throw error;
  }
}

function stop(node, when) {
  if (typeof node?.stop !== "function") return;
  try {
    node.stop(when);
  } catch (error) {
    if (error?.name !== "InvalidStateError") throw error;
  }
}

function setValue(param, value, now) {
  if (!param) return;
  if (typeof param.setValueAtTime === "function") param.setValueAtTime(value, now);
  else param.value = value;
}

function hold(param, now) {
  if (!param) return;
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(now);
    return;
  }
  param.cancelScheduledValues?.(now);
  setValue(param, Number.isFinite(param.value) ? param.value : MIN_GAIN, now);
}

function target(param, value, now, seconds = 0.08) {
  if (!param) return;
  hold(param, now);
  if (typeof param.setTargetAtTime === "function") {
    param.setTargetAtTime(value, now, Math.max(0.005, seconds / 3));
  } else {
    setValue(param, value, now);
  }
}

function ramp(param, value, now, duration, exponential = false) {
  if (!param) return;
  hold(param, now);
  const end = now + Math.max(0.001, duration);
  if (exponential && value > 0 && typeof param.exponentialRampToValueAtTime === "function") {
    param.exponentialRampToValueAtTime(value, end);
  } else if (typeof param.linearRampToValueAtTime === "function") {
    param.linearRampToValueAtTime(value, end);
  } else {
    setValue(param, value, now);
  }
}

function delayedRamp(param, value, currentTime, delay, duration, exponential = false) {
  if (!param) return;
  hold(param, currentTime);
  const start = currentTime + Math.max(0, delay);
  const heldValue = Number.isFinite(param.value) ? param.value : MIN_GAIN;
  if (start > currentTime) setValue(param, heldValue, start);
  const end = start + Math.max(0.001, duration);
  if (exponential && value > 0 && typeof param.exponentialRampToValueAtTime === "function") {
    param.exponentialRampToValueAtTime(value, end);
  } else if (typeof param.linearRampToValueAtTime === "function") {
    param.linearRampToValueAtTime(value, end);
  } else {
    setValue(param, value, start);
  }
}

function createPanner(ctx) {
  if (typeof ctx.createStereoPanner === "function") return ctx.createStereoPanner();
  const node = ctx.createGain();
  node.pan = null;
  return node;
}

function createWaveShaper(ctx, curve = null) {
  if (typeof ctx.createWaveShaper !== "function") return ctx.createGain();
  const node = ctx.createWaveShaper();
  node.curve = curve;
  node.oversample = "4x";
  return node;
}

function makeShaperCurve(amount, length = 2048) {
  const curve = new Float32Array(length);
  const drive = 1 + Math.max(0, amount) * 5;
  const normalizer = Math.tanh(drive);
  for (let index = 0; index < length; index += 1) {
    const input = (index / (length - 1)) * 2 - 1;
    curve[index] = (Math.tanh(input * drive) / normalizer) * 0.98;
  }
  return curve;
}

function createPeriodicWave(ctx, coefficients) {
  if (typeof ctx.createPeriodicWave !== "function") return null;
  const real = new Float32Array(coefficients.length);
  const imag = Float32Array.from(coefficients);
  return ctx.createPeriodicWave(real, imag);
}

export function createAudioEngine({
  contextFactory,
  enableWorklet = true,
  seed = 0x0a57a1,
  scoreLookahead = SCORE_LOOKAHEAD,
} = {}) {
  let disposed = false;
  let mode = "idle";
  let ctx = null;
  let masterInput = null;
  let masterShaper = null;
  let compressor = null;
  let analyser = null;
  let analyserData = null;
  let currentGraph = null;
  let retiredGraphs = [];
  let lastWorld = null;
  let debugWorld = null;
  let endingAt = 0;
  let workletNode = null;
  let workletGain = null;
  let workletGraph = null;
  let workletStatus = "fallback";
  let workletFailure = "";
  let workletGeneration = 0;
  let workletReady = Promise.resolve(false);
  const fadingWorklets = new Set();
  const rng = makeRng(seed);
  const impulseCache = new Map();
  const periodicWaveCache = new Map();
  const foldCurveCache = new Map();
  const percussionBufferCache = new Map();
  let noiseBuffer = null;
  let debugScore = null;

  function now() {
    return ctx?.currentTime || 0;
  }

  function defaultContextFactory() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    return AudioContext ? new AudioContext({ latencyHint: "interactive" }) : null;
  }

  function makeNoiseBuffer() {
    if (noiseBuffer || !ctx) return noiseBuffer;
    const length = Math.max(1, Math.floor(ctx.sampleRate * 2));
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = rng() * 2 - 1;
      previous = previous * 0.18 + white * 0.82;
      data[index] = previous;
    }
    return noiseBuffer;
  }

  function getPercussionBuffer(kind) {
    const family = ["low", "circular-low", "boss-kick", "cathedral-low"].includes(kind)
      ? kind
      : ["body", "descending-fill"].includes(kind)
        ? "body"
        : "tick";
    const existing = percussionBufferCache.get(family);
    if (existing) return existing;
    const lowFamily = ["low", "circular-low", "boss-kick", "cathedral-low"].includes(
      family
    );
    const duration = lowFamily
      ? family === "cathedral-low" ? 0.48 : 0.38
      : family === "body" ? 0.22 : 0.1;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const percussionRng = makeRng(
      seed ^ (lowFamily ? 0x10a : family === "body" ? 0xb0d : 0x71c)
    );
    let phase = 0;
    for (let index = 0; index < length; index += 1) {
      const time = index / ctx.sampleRate;
      const progress = index / length;
      let sample;
      if (lowFamily) {
        const startFrequency = {
          low: 118,
          "circular-low": 154,
          "boss-kick": 136,
          "cathedral-low": 88,
        }[family];
        const floorFrequency = family === "cathedral-low" ? 34 : 43;
        const frequency = startFrequency * Math.exp(-time * 7.2) + floorFrequency;
        phase += (Math.PI * 2 * frequency) / ctx.sampleRate;
        const tone = Math.sin(phase) * Math.exp(
          -time * (family === "cathedral-low" ? 6.8 : 9)
        );
        const impact = (percussionRng() * 2 - 1) * Math.exp(-time * 52);
        sample = tone * 0.82 + impact * 0.18;
      } else if (family === "body") {
        const tone = Math.sin(Math.PI * 2 * 238 * time) * Math.exp(-time * 17);
        const noise = (percussionRng() * 2 - 1) * Math.exp(-time * 24);
        sample = tone * 0.45 + noise * 0.55;
      } else {
        const metal =
          Math.sin(Math.PI * 2 * 3230 * time) * 0.42 +
          Math.sin(Math.PI * 2 * 4870 * time) * 0.3 +
          Math.sin(Math.PI * 2 * 6910 * time) * 0.18;
        const noise = (percussionRng() * 2 - 1) * 0.25;
        sample = (metal + noise) * Math.exp(-progress * 10);
      }
      data[index] = Math.max(-0.92, Math.min(0.92, sample * 0.68));
    }
    percussionBufferCache.set(family, buffer);
    return buffer;
  }

  function getImpulse(profile) {
    const existing = impulseCache.get(profile.key);
    if (existing) return existing;
    const length = Math.max(1, Math.floor(ctx.sampleRate * profile.impulseDuration));
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    const profileSeed = [...profile.key].reduce((value, character) => value * 33 + character.charCodeAt(0), seed);
    const profileRng = makeRng(profileSeed);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const progress = index / length;
        const envelope = Math.exp(-profile.impulseDamping * progress);
        const scatter = 0.72 + 0.28 * Math.sin(index * (0.017 + channel * 0.006));
        data[index] = (profileRng() * 2 - 1) * envelope * scatter * 0.34;
      }
    }
    impulseCache.set(profile.key, buffer);
    return buffer;
  }

  function getPeriodicWave(profile) {
    if (!periodicWaveCache.has(profile.key)) {
      periodicWaveCache.set(profile.key, createPeriodicWave(ctx, profile.wave));
    }
    return periodicWaveCache.get(profile.key);
  }

  function getFoldCurve(amount) {
    const key = Math.round(Math.max(0, amount) * 20);
    if (!foldCurveCache.has(key)) {
      foldCurveCache.set(key, makeShaperCurve(key / 20, 1024));
    }
    return foldCurveCache.get(key);
  }

  function createMasterGraph() {
    masterInput = ctx.createGain();
    setValue(masterInput.gain, 0.35, now());
    masterShaper = createWaveShaper(ctx, makeShaperCurve(0.12));
    compressor = typeof ctx.createDynamicsCompressor === "function"
      ? ctx.createDynamicsCompressor()
      : ctx.createGain();
    if (compressor.threshold) {
      setValue(compressor.threshold, -16, now());
      setValue(compressor.knee, 12, now());
      setValue(compressor.ratio, 5, now());
      setValue(compressor.attack, 0.004, now());
      setValue(compressor.release, 0.18, now());
    }
    analyser = typeof ctx.createAnalyser === "function" ? ctx.createAnalyser() : ctx.createGain();
    if ("fftSize" in analyser) analyser.fftSize = 512;
    analyserData = new Float32Array(analyser.fftSize || 512);
    masterInput.connect(masterShaper);
    masterShaper.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(ctx.destination);
  }

  function createAccompanimentVoice(
    graph,
    role,
    type,
    initialFrequency,
    filterType,
    filterFrequency
  ) {
    const oscillator = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panner = createPanner(ctx);
    oscillator.type = type;
    filter.type = filterType;
    setValue(oscillator.frequency, initialFrequency, now());
    setValue(filter.frequency, filterFrequency, now());
    setValue(gain.gain, MIN_GAIN, now());
    setValue(panner.pan, 0, now());
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(graph.fieldInput);
    oscillator.start(now());
    const voice = { role, oscillator, filter, gain, panner };
    graph.persistentNodes.push(oscillator, filter, gain, panner);
    graph.accompanimentVoices.push(voice);
    return voice;
  }

  function createRunGraph(world) {
    const scoreProfile = getMusicProfile(scoreSectionKey(world));
    const initialAccompanimentFrequency = (role) => {
      const voice = scoreProfile?.accompanimentVoices?.[role];
      if (!voice) return 164.81;
      return scoreProfile.tonicHz * 2 ** ((voice.semitones[0] + voice.octave * 12) / 12);
    };
    const graph = {
      output: ctx.createGain(),
      ending: ctx.createGain(),
      dry: ctx.createGain(),
      field: ctx.createGain(),
      fieldInput: ctx.createGain(),
      fieldShaper: createWaveShaper(ctx, getFoldCurve(0)),
      wet: ctx.createGain(),
      excitation: ctx.createGain(),
      accompanimentVoices: [],
      modulation: null,
      noiseVoice: null,
      persistentNodes: [],
      voices: new Set(),
      lastEventAt: new Map(),
      activeBody: null,
      fadingBody: null,
      activeScore: null,
      fadingScore: null,
      scoreStarted: false,
      profileKey: null,
      releaseAt: 0,
      released: false,
    };
    setValue(graph.output.gain, MIN_GAIN, now());
    setValue(graph.ending.gain, 1, now());
    setValue(graph.dry.gain, 0.9, now());
    setValue(graph.field.gain, 0.46, now());
    setValue(graph.fieldInput.gain, 1, now());
    setValue(graph.wet.gain, 0.82, now());
    graph.dry.connect(graph.output);
    graph.fieldInput.connect(graph.fieldShaper);
    graph.fieldShaper.connect(graph.field);
    graph.field.connect(graph.output);
    graph.wet.connect(graph.output);
    graph.output.connect(masterInput);
    graph.ending.connect(masterInput);
    graph.persistentNodes.push(
      graph.output,
      graph.ending,
      graph.dry,
      graph.field,
      graph.fieldInput,
      graph.fieldShaper,
      graph.wet,
      graph.excitation
    );
    createAccompanimentVoice(
      graph,
      "bass",
      "triangle",
      initialAccompanimentFrequency("bass"),
      "lowpass",
      680
    );
    createAccompanimentVoice(
      graph,
      "pulse",
      "square",
      initialAccompanimentFrequency("pulse"),
      "bandpass",
      1200
    );
    createAccompanimentVoice(
      graph,
      "danger",
      "sawtooth",
      initialAccompanimentFrequency("danger"),
      "highpass",
      1800
    );
    createAccompanimentVoice(
      graph,
      "loop",
      "sine",
      initialAccompanimentFrequency("loop"),
      "lowpass",
      1500
    );
    const modulationSource = ctx.createOscillator();
    const modulationDepth = ctx.createGain();
    setValue(modulationSource.frequency, 19, now());
    setValue(modulationDepth.gain, MIN_GAIN, now());
    modulationSource.connect(modulationDepth);
    modulationDepth.connect(
      graph.accompanimentVoices.find(({ role }) => role === "pulse").filter.frequency
    );
    modulationDepth.connect(
      graph.accompanimentVoices.find(({ role }) => role === "danger").filter.frequency
    );
    modulationSource.start(now());
    graph.modulation = { source: modulationSource, depth: modulationDepth };
    graph.persistentNodes.push(modulationSource, modulationDepth);

    const noiseSource = ctx.createBufferSource();
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    const noisePanner = createPanner(ctx);
    noiseSource.buffer = makeNoiseBuffer();
    noiseSource.loop = true;
    noiseFilter.type = "bandpass";
    setValue(noiseFilter.frequency, 1200, now());
    setValue(noiseFilter.Q, 0.7, now());
    setValue(noiseGain.gain, MIN_GAIN, now());
    setValue(noisePanner.pan, 0, now());
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(noisePanner);
    noisePanner.connect(graph.fieldInput);
    noiseSource.start(now());
    graph.noiseVoice = {
      source: noiseSource,
      filter: noiseFilter,
      gain: noiseGain,
      panner: noisePanner,
    };
    graph.persistentNodes.push(noiseSource, noiseFilter, noiseGain, noisePanner);
    return graph;
  }

  function formalArrangementTier(world) {
    if (Number.isInteger(debugScore?.arrangementTier)) return debugScore.arrangementTier;
    if (world.bossKey) return 2;
    if (world.stageProgress >= 0.75) return 2;
    if (world.stageProgress >= 0.35) return 1;
    return 0;
  }

  function initialDensityTier(value) {
    if (value >= 0.7) return 2;
    if (value >= 0.35) return 1;
    return 0;
  }

  function nextDensityTier(current, value) {
    if (current <= 0) return value >= 0.35 ? 1 : 0;
    if (current === 1) {
      if (value >= 0.7) return 2;
      if (value < 0.27) return 0;
      return 1;
    }
    return value < 0.62 ? 1 : 2;
  }

  function desiredScoreControl(world, currentDensity = null) {
    const densityTier = currentDensity === null
      ? initialDensityTier(world.densityRatio)
      : nextDensityTier(currentDensity, world.densityRatio);
    return {
      arrangementTier: formalArrangementTier(world),
      densityTier,
      chainActive: world.chainRatio >= 0.5,
      grazeActive: world.grazeRatio >= 0.65,
      lowHull: world.hull <= 2,
    };
  }

  function nextGridStep(section, stepSize) {
    const position = Math.max(0, (now() - section.startAt) / section.plan.secondsPerStep);
    let step = Math.ceil(position / stepSize) * stepSize;
    if (section.startAt + step * section.plan.secondsPerStep <= now() + 0.005) {
      step += stepSize;
    }
    return step;
  }

  function invalidateScheduledScoreControl(section, desired) {
    if (!section.plan) return;
    const barChanged =
      desired.arrangementTier !== section.desiredControl.arrangementTier ||
      desired.chainActive !== section.desiredControl.chainActive;
    const beatChanged =
      desired.densityTier !== section.desiredControl.densityTier ||
      desired.grazeActive !== section.desiredControl.grazeActive ||
      desired.lowHull !== section.desiredControl.lowHull;
    if (!barChanged && !beatChanged) return;
    const boundaries = [];
    if (barChanged) boundaries.push(nextGridStep(section, section.plan.meter.stepsPerBar));
    if (beatChanged) boundaries.push(nextGridStep(section, section.plan.meter.primaryBeatSteps));
    const boundaryStep = Math.min(...boundaries);
    if (boundaryStep >= section.nextStep) return;
    const boundaryTime = section.startAt + boundaryStep * section.plan.secondsPerStep;
    for (const voice of [...section.percussionVoices]) {
      if (voice.startsAt >= boundaryTime) stopScoreTransient(section, voice, 0);
    }
    section.nextStep = boundaryStep;
    section.scheduledThrough = boundaryTime;
  }

  function scoreSectionKey(world) {
    if (world.bossKey && getMusicProfile(world.bossKey)) return world.bossKey;
    return getMusicProfile(world.stageKey) ? world.stageKey : null;
  }

  function scoreIdentity(world) {
    const sectionKey = scoreSectionKey(world);
    if (!sectionKey) return null;
    const phaseIndex = world.bossKey === sectionKey ? world.bossPhaseIndex : -1;
    return `${sectionKey}:${phaseIndex}:${world.loopIndex}`;
  }

  function createHarmonyBank(graph, section, audioProfile, bankIndex) {
    const bank = {
      gain: ctx.createGain(),
      voices: [],
    };
    setValue(bank.gain.gain, MIN_GAIN, now());
    bank.gain.connect(section.harmony);
    section.nodes.push(bank.gain);

    const periodicWave = getPeriodicWave(audioProfile);
    const pans = [-0.12, -0.04, 0.04, 0.12];
    for (let index = 0; index < 4; index += 1) {
      const oscillator = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const panner = createPanner(ctx);
      oscillator.type = "triangle";
      if (periodicWave && typeof oscillator.setPeriodicWave === "function") {
        oscillator.setPeriodicWave(periodicWave);
      }
      filter.type = "lowpass";
      setValue(oscillator.frequency, section.profile.tonicHz, now());
      setValue(filter.frequency, Math.min(3600, audioProfile.filterCutoff * 0.62), now());
      setValue(filter.Q, 0.7, now());
      setValue(gain.gain, [0.019, 0.016, 0.014, 0.01][index], now());
      setValue(panner.pan, pans[index] * (bankIndex ? -1 : 1), now());
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(bank.gain);
      oscillator.start(now());
      const voice = { oscillator, filter, gain, panner };
      bank.voices.push(voice);
      section.nodes.push(oscillator, filter, gain, panner);
    }
    return bank;
  }

  function applyScoreSolo(section, immediate = false) {
    const soloBus = debugScore?.soloBus ?? null;
    const at = now();
    const values = {
      harmony: soloBus && soloBus !== "harmony" ? MIN_GAIN : 0.82,
      percussion: soloBus && soloBus !== "percussion" ? MIN_GAIN : 0.84,
    };
    for (const [key, value] of Object.entries(values)) {
      if (immediate) setValue(section[key].gain, value, at);
      else target(section[key].gain, value, at, 0.05);
    }
  }

  function createScoreSection(graph, world, audioProfile, profile, delay) {
    const section = {
      identity: scoreIdentity(world),
      sectionKey: profile.key,
      phaseIndex: world.bossKey === profile.key ? world.bossPhaseIndex : -1,
      loopIndex: world.loopIndex,
      profile,
      audioProfile,
      output: ctx.createGain(),
      harmony: ctx.createGain(),
      percussion: ctx.createGain(),
      harmonySend: ctx.createGain(),
      percussionSend: ctx.createGain(),
      wetMix: ctx.createGain(),
      wetOutput: ctx.createGain(),
      banks: [],
      activeBank: -1,
      nodes: [],
      percussionVoices: new Set(),
      control: desiredScoreControl(world),
      desiredControl: null,
      plan: null,
      planPhraseIndex: -1,
      startAt: now() + delay,
      nextStep: 0,
      scheduledThrough: now() + delay,
      skippedLateSteps: 0,
      scheduledChordBanks: new Map(),
      transportActive: true,
      releaseAt: 0,
      released: false,
    };
    section.desiredControl = { ...section.control };
    setValue(section.output.gain, MIN_GAIN, now());
    setValue(section.harmonySend.gain, 0.3, now());
    setValue(section.percussionSend.gain, 0.12, now());
    setValue(section.wetMix.gain, 1, now());
    setValue(section.wetOutput.gain, MIN_GAIN, now());
    section.harmony.connect(section.output);
    section.percussion.connect(section.output);
    section.harmony.connect(section.harmonySend);
    section.percussion.connect(section.percussionSend);
    section.harmonySend.connect(section.wetMix);
    section.percussionSend.connect(section.wetMix);
    section.wetMix.connect(section.wetOutput);
    section.wetOutput.connect(graph.excitation);
    section.output.connect(graph.output);
    section.nodes.push(
      section.output,
      section.harmony,
      section.percussion,
      section.harmonySend,
      section.percussionSend,
      section.wetMix,
      section.wetOutput
    );
    applyScoreSolo(section, true);
    section.banks.push(
      createHarmonyBank(graph, section, audioProfile, 0),
      createHarmonyBank(graph, section, audioProfile, 1)
    );
    ramp(section.output.gain, 1, now(), Math.min(delay, SCORE_TRANSITION));
    ramp(section.wetOutput.gain, 1, now(), Math.min(delay, SCORE_TRANSITION));
    return section;
  }

  function releaseScoreTransient(section, voice) {
    if (!voice || voice.released) return;
    voice.released = true;
    voice.collection.delete(voice);
    for (const node of voice.nodes) disconnect(node);
  }

  function trackScoreTransient(section, collection, voice) {
    voice.collection = collection;
    collection.add(voice);
    voice.source.addEventListener?.(
      "ended",
      () => releaseScoreTransient(section, voice),
      { once: true }
    );
  }

  function stopScoreTransient(section, voice, fade = 0.01) {
    if (!voice || voice.released) return;
    const at = now();
    target(voice.gain?.gain, MIN_GAIN, at, fade);
    stop(voice.source, at + fade + 0.002);
    releaseScoreTransient(section, voice);
  }

  function releaseScoreSection(graph, section) {
    if (!section || section.released) return;
    section.released = true;
    section.transportActive = false;
    for (const voice of [...section.percussionVoices]) stopScoreTransient(section, voice, 0);
    for (const bank of section.banks) {
      for (const voice of bank.voices) stop(voice.oscillator, now());
    }
    disconnect(section.output, graph.output);
    for (const node of section.nodes) disconnect(node);
    if (graph.activeScore === section) graph.activeScore = null;
    if (graph.fadingScore === section) graph.fadingScore = null;
  }

  function retireScoreSection(graph, section, fade = SCORE_TRANSITION) {
    if (!section || section.released) return;
    section.transportActive = false;
    ramp(section.output.gain, MIN_GAIN, now(), fade);
    ramp(section.wetOutput.gain, MIN_GAIN, now(), fade);
    section.releaseAt = now() + fade + 0.05;
    if (graph.fadingScore && graph.fadingScore !== section) {
      releaseScoreSection(graph, graph.fadingScore);
    }
    graph.fadingScore = section;
    if (graph.activeScore === section) graph.activeScore = null;
  }

  function selectScoreSection(graph, world, audioProfile) {
    const identity = scoreIdentity(world);
    if (graph.activeScore?.identity === identity) {
      const desired = desiredScoreControl(
        world,
        graph.activeScore.desiredControl.densityTier
      );
      invalidateScheduledScoreControl(graph.activeScore, desired);
      graph.activeScore.desiredControl = desired;
      return graph.activeScore;
    }
    const previous = graph.activeScore;
    const delay = previous?.plan
      ? Math.max(
        0.02,
        previous.startAt +
          nextGridStep(previous, previous.plan.meter.primaryBeatSteps) *
            previous.plan.secondsPerStep -
          now()
      )
      : graph.scoreStarted
        ? SCORE_TRANSITION
        : SCORE_INTRO_DELAY;
    if (previous) retireScoreSection(graph, previous);
    if (!identity) return null;
    const profile = getMusicProfile(scoreSectionKey(world));
    graph.scoreStarted = true;
    const section = createScoreSection(graph, world, audioProfile, profile, delay);
    graph.activeScore = section;
    return section;
  }

  function refreshScorePlan(section, phraseIndex) {
    section.plan = planMusicCycle({
      sectionKey: section.sectionKey,
      phaseIndex: section.phaseIndex,
      phraseIndex,
      arrangementTier: section.control.arrangementTier,
      percussionTier: Math.max(
        section.control.arrangementTier,
        section.control.densityTier
      ),
      loopIndex: section.loopIndex,
      chainActive: section.control.chainActive,
      grazeActive: section.control.grazeActive,
      lowHull: section.control.lowHull,
    });
    section.planPhraseIndex = phraseIndex;
  }

  function applyQuantizedScoreControl(section, localStep) {
    const { meter } = section.profile;
    let changed = false;
    if (localStep % meter.stepsPerBar === 0) {
      for (const key of ["arrangementTier", "chainActive"]) {
        if (section.control[key] !== section.desiredControl[key]) {
          section.control[key] = section.desiredControl[key];
          changed = true;
        }
      }
    }
    if (localStep % meter.primaryBeatSteps === 0) {
      for (const key of ["densityTier", "grazeActive", "lowHull"]) {
        if (section.control[key] !== section.desiredControl[key]) {
          section.control[key] = section.desiredControl[key];
          changed = true;
        }
      }
    }
    return changed;
  }

  function frequencyForChordVoice(section, chord, voiceIndex) {
    if (chord.chordIndex === 0 && voiceIndex < section.profile.homeRatios.length) {
      return section.profile.tonicHz *
        section.profile.homeRatios[voiceIndex] *
        chord.pitchMultiplier;
    }
    return section.profile.tonicHz *
      2 ** (chord.semitones[voiceIndex] / 12) *
      chord.pitchMultiplier;
  }

  function scheduleHarmonyChord(graph, section, chord, at, absoluteStep) {
    const scheduledBankIndex = section.scheduledChordBanks.get(absoluteStep);
    const nextBankIndex = scheduledBankIndex ??
      (section.activeBank < 0 ? 0 : 1 - section.activeBank);
    const nextBank = section.banks[nextBankIndex];
    const previousBank = section.activeBank >= 0 ? section.banks[section.activeBank] : null;
    nextBank.voices.forEach((voice, index) => {
      setValue(
        voice.oscillator.frequency,
        Math.min(ctx.sampleRate * 0.45, frequencyForChordVoice(section, chord, index)),
        at
      );
    });
    if (scheduledBankIndex === undefined) {
      setValue(nextBank.gain.gain, MIN_GAIN, at);
      nextBank.gain.gain.linearRampToValueAtTime(1, at + CHORD_CROSSFADE);
      if (previousBank) {
        setValue(previousBank.gain.gain, 1, at);
        previousBank.gain.gain.linearRampToValueAtTime(MIN_GAIN, at + CHORD_CROSSFADE);
      }
      section.activeBank = nextBankIndex;
      section.scheduledChordBanks.set(absoluteStep, nextBankIndex);
    }
    for (const plannedVoice of chord.accompaniment) {
      const voice = graph.accompanimentVoices.find(
        ({ role }) => role === plannedVoice.role
      );
      if (!voice) continue;
      target(
        voice.oscillator.frequency,
        Math.min(
          ctx.sampleRate * 0.45,
          section.profile.tonicHz *
            2 ** (plannedVoice.semitones / 12) *
            chord.pitchMultiplier
        ),
        at,
        0.08
      );
    }
  }

  function schedulePercussionVoice(graph, section, event, at) {
    const low = ["low", "circular-low", "boss-kick", "cathedral-low"].includes(
      event.instrument
    );
    const body = ["body", "descending-fill"].includes(event.instrument);
    const priority = low ? 2 : body && !event.subdivision ? 1 : 0;
    if (section.percussionVoices.size >= MAX_PERCUSSION_VOICES) {
      if (priority === 0) return false;
      const candidate = [...section.percussionVoices]
        .filter((voice) => voice.priority < priority)
        .sort(
          (left, right) =>
            left.priority - right.priority || left.startsAt - right.startsAt
        )[0];
      if (!candidate) return false;
      stopScoreTransient(section, candidate, 0.005);
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const panner = createPanner(ctx);
    const buffer = getPercussionBuffer(event.instrument);
    const amplitude = event.velocity * (low ? 0.09 : body ? 0.055 : 0.032);
    source.buffer = buffer;
    if (source.playbackRate && Number.isFinite(event.pitchSemitones)) {
      setValue(source.playbackRate, 2 ** (event.pitchSemitones / 12), at);
    }
    setValue(gain.gain, amplitude, at);
    setValue(panner.pan, low ? 0 : (event.step % 2 ? 1 : -1) * (body ? 0.08 : 0.26), at);
    source.connect(gain);
    gain.connect(panner);
    panner.connect(section.percussion);
    const duration = buffer.duration || (low ? 0.38 : body ? 0.22 : 0.1);
    const voice = {
      source,
      gain,
      nodes: [source, gain, panner],
      priority,
      startsAt: at,
      endsAt: at + duration + 0.02,
      released: false,
    };
    trackScoreTransient(section, section.percussionVoices, voice);
    source.start(at);
    source.stop(voice.endsAt);
    return true;
  }

  function scheduleScoreStep(graph, section, absoluteStep, at) {
    const phraseIndex = Math.floor(absoluteStep / section.plan.stepsPerCycle);
    const localStep = absoluteStep % section.plan.stepsPerCycle;
    const controlChanged = applyQuantizedScoreControl(section, localStep);
    if (phraseIndex !== section.planPhraseIndex || controlChanged) {
      refreshScorePlan(section, phraseIndex);
    }
    const chord = section.plan.chords.find(({ step }) => step === localStep);
    if (chord) {
      scheduleHarmonyChord(graph, section, chord, at, absoluteStep);
    }
    for (const event of section.plan.percussion) {
      if (event.step === localStep) schedulePercussionVoice(graph, section, event, at);
    }
  }

  function scheduleScore(graph, section) {
    if (!section?.transportActive || section.released || mode !== "active") return;
    if (!section.plan) refreshScorePlan(section, 0);
    const currentTime = now();
    const lateBoundary = currentTime - 0.03;
    let stepTime = section.startAt + section.nextStep * section.plan.secondsPerStep;
    if (stepTime < lateBoundary) {
      const nextValidStep = Math.max(
        section.nextStep,
        Math.ceil((currentTime - section.startAt) / section.plan.secondsPerStep)
      );
      section.skippedLateSteps += Math.max(0, nextValidStep - section.nextStep);
      const currentStep = Math.max(
        0,
        Math.floor((currentTime - section.startAt) / section.plan.secondsPerStep)
      );
      const phraseIndex = Math.floor(currentStep / section.plan.stepsPerCycle);
      if (phraseIndex !== section.planPhraseIndex) refreshScorePlan(section, phraseIndex);
      const localStep = currentStep % section.plan.stepsPerCycle;
      const chord = section.plan.chords.findLast(({ step }) => step <= localStep);
      const chordStep = phraseIndex * section.plan.stepsPerCycle + chord.step;
      if (chordStep < nextValidStep && !section.scheduledChordBanks.has(chordStep)) {
        // Restore missed harmony now. New controls still wait for their beat or bar.
        scheduleHarmonyChord(graph, section, chord, currentTime, chordStep);
      }
      section.nextStep = nextValidStep;
      stepTime = section.startAt + section.nextStep * section.plan.secondsPerStep;
    }
    while (stepTime <= currentTime + Math.max(SCORE_LOOKAHEAD, scoreLookahead)) {
      scheduleScoreStep(graph, section, section.nextStep, stepTime);
      section.scheduledThrough = stepTime;
      section.nextStep += 1;
      stepTime = section.startAt + section.nextStep * section.plan.secondsPerStep;
    }
    const oldestChordStep = section.nextStep - section.plan.stepsPerCycle * 2;
    for (const chordStep of section.scheduledChordBanks.keys()) {
      if (chordStep < oldestChordStep) section.scheduledChordBanks.delete(chordStep);
    }
  }

  function maintainScoreSection(section) {
    if (!section) return;
    for (const voice of [...section.percussionVoices]) {
      if (now() >= voice.endsAt) releaseScoreTransient(section, voice);
    }
  }

  function stopScoreTransport(section) {
    if (!section) return;
    section.transportActive = false;
    for (const voice of [...section.percussionVoices]) stopScoreTransient(section, voice);
    ramp(section.percussion.gain, MIN_GAIN, now(), 0.03);
  }

  function duckMusic(graph) {
    const section = graph.activeScore;
    if (!section || section.released) return;
    const currentTime = now();
    for (const param of [section.output.gain, section.wetOutput.gain]) {
      hold(param, currentTime);
      setValue(param, Math.max(MIN_GAIN, param.value), currentTime);
      param.exponentialRampToValueAtTime(MUSIC_DUCK_GAIN, currentTime + 0.012);
      setValue(param, MUSIC_DUCK_GAIN, currentTime + 0.072);
      param.exponentialRampToValueAtTime(1, currentTime + 0.312);
    }
  }

  function createResonantBody(graph, profile) {
    const body = {
      key: profile.key,
      profile,
      input: ctx.createGain(),
      output: ctx.createGain(),
      modes: [],
      delays: [],
      nodes: [],
      fadeUntil: now() + STAGE_CROSSFADE,
      releaseAt: 0,
      released: false,
    };
    setValue(body.input.gain, 1, now());
    setValue(body.output.gain, MIN_GAIN, now());

    for (const mode of profile.modes) {
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      filter.type = "bandpass";
      setValue(filter.frequency, Math.min(ctx.sampleRate * 0.45, profile.root * mode.ratio), now());
      setValue(filter.Q, mode.q, now());
      setValue(gain.gain, mode.gain, now());
      body.input.connect(filter);
      filter.connect(gain);
      gain.connect(body.output);
      body.modes.push({ filter, gain, mode });
      body.nodes.push(filter, gain);
    }

    profile.delays.forEach((delaySeconds, index) => {
      const delay = ctx.createDelay(Math.max(0.5, delaySeconds * 2));
      const filter = ctx.createBiquadFilter();
      const feedback = ctx.createGain();
      const level = ctx.createGain();
      const panner = createPanner(ctx);
      filter.type = "lowpass";
      setValue(delay.delayTime, delaySeconds, now());
      setValue(filter.frequency, profile.filterCutoff, now());
      setValue(feedback.gain, profile.feedback, now());
      setValue(level.gain, 0.12, now());
      setValue(panner.pan, index % 2 === 0 ? -profile.width : profile.width, now());
      body.input.connect(delay);
      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);
      filter.connect(level);
      level.connect(panner);
      panner.connect(body.output);
      body.delays.push({ delay, filter, feedback, level, panner });
      body.nodes.push(delay, filter, feedback, level, panner);
    });

    if (typeof ctx.createConvolver === "function") {
      const convolver = ctx.createConvolver();
      const convolverGain = ctx.createGain();
      convolver.buffer = getImpulse(profile);
      convolver.normalize = true;
      setValue(convolverGain.gain, 0.24, now());
      body.input.connect(convolver);
      convolver.connect(convolverGain);
      convolverGain.connect(body.output);
      body.nodes.push(convolver, convolverGain);
    }

    graph.excitation.connect(body.input);
    body.output.connect(graph.wet);
    body.nodes.push(body.input, body.output);
    return body;
  }

  function releaseBody(graph, body) {
    if (!body || body.released) return;
    body.released = true;
    disconnect(graph.excitation, body.input);
    for (const node of body.nodes) disconnect(node);
    if (graph.activeBody === body) graph.activeBody = null;
    if (graph.fadingBody === body) graph.fadingBody = null;
  }

  function selectBody(graph, profile) {
    if (graph.activeBody?.key === profile.key) return graph.activeBody;
    if (graph.fadingBody) releaseBody(graph, graph.fadingBody);
    const previous = graph.activeBody;
    const body = createResonantBody(graph, profile);
    graph.activeBody = body;
    graph.profileKey = profile.key;
    ramp(body.output.gain, profile.wet, now(), STAGE_CROSSFADE);
    if (previous) {
      graph.fadingBody = previous;
      previous.releaseAt = now() + STAGE_CROSSFADE + 0.08;
      ramp(previous.output.gain, MIN_GAIN, now(), STAGE_CROSSFADE);
    }
    return body;
  }

  function releaseVoice(graph, voice) {
    if (!voice || voice.released) return;
    voice.released = true;
    graph.voices.delete(voice);
    for (const node of voice.nodes) disconnect(node);
  }

  function stopVoice(graph, voice, fade = 0.01) {
    if (!voice || voice.released) return;
    const stopTime = now() + fade + 0.002;
    target(voice.gain?.gain, MIN_GAIN, now(), fade);
    stop(voice.source, stopTime);
    releaseVoice(graph, voice);
  }

  function reserveVoice(graph, kind, priority, maxConcurrent) {
    const matching = [...graph.voices].filter((voice) => voice.kind === kind).length;
    if (matching >= maxConcurrent && priority === 0) return false;
    if (graph.voices.size < MAX_TEMPORARY_VOICES) return true;
    const candidate = [...graph.voices]
      .filter((voice) => voice.priority < priority)
      .sort((left, right) => left.priority - right.priority || left.startedAt - right.startedAt)[0];
    if (!candidate) return false;
    stopVoice(graph, candidate);
    return true;
  }

  function trackVoice(graph, voice) {
    graph.voices.add(voice);
    voice.source.addEventListener?.("ended", () => releaseVoice(graph, voice), { once: true });
  }

  function createVoice(graph, kind, priority, maxConcurrent, instruction, eventPan, center, ampScale = 1) {
    if (!reserveVoice(graph, kind, priority, maxConcurrent)) return false;
    const currentTime = now();
    const isNoise = instruction.source === "noise";
    const source = isNoise ? ctx.createBufferSource() : ctx.createOscillator();
    if (isNoise) {
      source.buffer = makeNoiseBuffer();
    } else {
      source.type = instruction.type || "sine";
      setValue(source.frequency, Math.min(ctx.sampleRate * 0.45, instruction.freq), currentTime);
      if (instruction.detune) setValue(source.detune, instruction.detune, currentTime);
      if (instruction.slide) {
        const destination = Math.max(32, Math.min(ctx.sampleRate * 0.45, instruction.freq * instruction.slide));
        source.frequency.exponentialRampToValueAtTime(destination, currentTime + instruction.duration);
      }
    }

    let outputNode = source;
    let filter = null;
    if (instruction.filter) {
      filter = ctx.createBiquadFilter();
      filter.type = instruction.filterType || "lowpass";
      setValue(filter.frequency, instruction.filter, currentTime);
      if (instruction.q) setValue(filter.Q, instruction.q, currentTime);
      source.connect(filter);
      outputNode = filter;
    }

    const gain = ctx.createGain();
    const dryPanner = createPanner(ctx);
    const sendGain = ctx.createGain();
    const wetPanner = createPanner(ctx);
    const amp = Math.max(MIN_GAIN, (instruction.amp ?? 0.2) * ampScale);
    const attack = instruction.attack ?? 0.01;
    const release = instruction.release ?? instruction.duration;
    setValue(gain.gain, MIN_GAIN, currentTime);
    gain.gain.exponentialRampToValueAtTime(amp, currentTime + attack);
    if (instruction.decay === "linear") {
      gain.gain.linearRampToValueAtTime(MIN_GAIN, currentTime + release);
    } else {
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, currentTime + release);
    }
    setValue(dryPanner.pan, eventPan * (1 - center), currentTime);
    setValue(sendGain.gain, instruction.send ?? 0.25, currentTime);
    setValue(wetPanner.pan, eventPan * 0.9, currentTime);
    outputNode.connect(gain);
    gain.connect(dryPanner);
    dryPanner.connect(
      kind === "player-death" || kind === "victory" ? graph.ending : graph.dry
    );
    gain.connect(sendGain);
    sendGain.connect(wetPanner);
    wetPanner.connect(graph.excitation);

    const nodes = [source, filter, gain, dryPanner, sendGain, wetPanner].filter(Boolean);
    const voice = {
      source,
      gain,
      nodes,
      kind,
      priority,
      startedAt: currentTime,
      released: false,
    };
    trackVoice(graph, voice);
    const stopAfter = Math.max(instruction.duration, release) + 0.04;
    if (isNoise) {
      const bufferDuration = noiseBuffer.duration || 2;
      const available = Math.max(0, bufferDuration - instruction.duration - 0.01);
      source.start(currentTime, rng() * available, instruction.duration);
    } else {
      source.start(currentTime);
    }
    source.stop(currentTime + stopAfter);
    return true;
  }

  function renderInstruction(graph, recipe, instruction, eventPan) {
    if (instruction.source !== "chord") {
      return createVoice(
        graph,
        recipe.kind,
        recipe.priority,
        recipe.maxConcurrent,
        instruction,
        eventPan,
        recipe.center
      );
    }
    const frequencies = instruction.freqs || [];
    let played = false;
    frequencies.forEach((frequency, index) => {
      const detune = (instruction.spread || 0) * (index - (frequencies.length - 1) / 2);
      played = createVoice(
        graph,
        recipe.kind,
        recipe.priority,
        recipe.maxConcurrent,
        { ...instruction, source: "tone", freq: frequency, detune },
        eventPan,
        recipe.center,
        1 / Math.max(1, frequencies.length * 0.8)
      ) || played;
    });
    return played;
  }

  function playEvent(kind, payload = {}) {
    if (!ctx || disposed || !validEventKinds.has(kind)) return false;
    const graph = currentGraph;
    if (!graph || graph.released) return false;
    const world = mergeAudioWorld(lastWorld, debugWorld);
    const profile = getAudioStageProfile(world?.stageKey);
    const root = profile.root * (world?.loopIndex > 0 ? 1.06 : 1);
    const recipe = getAudioEventRecipe(kind, { root, payload });
    if (!recipe) return false;
    const previousTime = graph.lastEventAt.get(kind) ?? -Infinity;
    if (now() - previousTime < recipe.minInterval) return false;
    const eventPan = Number.isFinite(payload.pan)
      ? Math.max(-1, Math.min(1, payload.pan))
      : panForWorldX(world, payload.x);
    let played = false;
    for (const instruction of recipe.voices) {
      played = renderInstruction(graph, recipe, instruction, eventPan) || played;
    }
    if (played) {
      graph.lastEventAt.set(kind, now());
      if (musicDuckEvents.has(kind)) duckMusic(graph);
    }
    return played;
  }

  function updateBody(body, world, transform) {
    if (!body) return;
    const profile = body.profile;
    const loopPressure = world.loopIndex > 0 ? 1.08 : 1;
    const densityPressure = 1 + world.densityRatio * 0.08;
    const feedback = clampFeedback(profile.feedback * transform.decay * loopPressure * densityPressure);
    body.delays.forEach((delayLine, index) => {
      target(delayLine.feedback.gain, feedback, now(), PHASE_SMOOTHING);
      target(
        delayLine.delay.delayTime,
        Math.min(0.5, profile.delays[index] * transform.delayScale),
        now(),
        PHASE_SMOOTHING
      );
      target(
        delayLine.filter.frequency,
        profile.filterCutoff * (1 - world.densityRatio * 0.16),
        now(),
        PHASE_SMOOTHING
      );
      const side = index % 2 === 0 ? -1 : 1;
      const alternating = Math.sin(world.time * 5.2 + index * Math.PI * 0.5);
      target(
        delayLine.panner.pan,
        Math.max(
          -1,
          Math.min(
            1,
            side * profile.width * transform.width +
              alternating * transform.dispersion * 0.24
          )
        ),
        now(),
        PHASE_SMOOTHING
      );
    });
    body.modes.forEach(({ filter, gain, mode }, index) => {
      const formantShift = 1 + transform.formant * (index * 0.045);
      target(
        filter.frequency,
        Math.min(ctx.sampleRate * 0.45, profile.root * mode.ratio * formantShift),
        now(),
        PHASE_SMOOTHING
      );
      target(filter.Q, mode.q * transform.modalSharpness, now(), PHASE_SMOOTHING);
      target(gain.gain, mode.gain * (1 + transform.upperGain * index * 0.08), now(), PHASE_SMOOTHING);
    });
    if (now() >= body.fadeUntil) {
      target(
        body.output.gain,
        profile.wet * (1 + world.densityRatio * 0.12),
        now(),
        PHASE_SMOOTHING
      );
    }
  }

  function updateField(graph, world, profile, transform) {
    const currentTime = now();
    const accompanimentActive = Boolean(getMusicProfile(scoreSectionKey(world)));
    const lowHullWeight = world.hull <= 2 ? 1 : world.hull === 3 ? 0.45 : 0;
    const bossWeight = world.bossKey ? 1 : 0;
    const pulseWave = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(world.time * 2.7 * transform.pulseRate));
    const dangerWave = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(world.time * 8.2));
    const baseGains = {
      bass: 0.016,
      pulse: 0.012 + bossWeight * 0.055 * transform.pulseGain * pulseWave,
      danger: lowHullWeight * 0.05 * dangerWave,
      loop: (world.loopIndex > 0 ? 1 : 0) * 0.03 * (0.4 + 0.6 * pulseWave),
    };
    const periodicWave = getPeriodicWave(profile);
    for (let index = 0; index < graph.accompanimentVoices.length; index += 1) {
      const voice = graph.accompanimentVoices[index];
      if (periodicWave && typeof voice.oscillator.setPeriodicWave === "function") {
        voice.oscillator.setPeriodicWave(periodicWave);
      }
      const upperScale = ["pulse", "loop"].includes(voice.role) ? transform.upperGain : 1;
      target(
        voice.gain.gain,
        world.active && accompanimentActive
          ? baseGains[voice.role] * upperScale
          : MIN_GAIN,
        currentTime,
        0.16
      );
      const orbit = Math.sin(world.time * profile.orbitRate * (index + 1) + index * 1.7);
      const roleWidth = ["pulse", "loop"].includes(voice.role) ? 0.42 : 0.14;
      const chainAlignment = 1 - world.chainRatio * 0.45;
      target(
        voice.panner.pan,
        orbit * roleWidth * profile.width * transform.width * chainAlignment,
        currentTime,
        0.12
      );
    }
    target(
      graph.modulation.source.frequency,
      profile.modulationRate * transform.pulseRate,
      currentTime,
      PHASE_SMOOTHING
    );
    target(
      graph.modulation.depth.gain,
      1.5 + transform.sideband * 42 + world.densityRatio * 3,
      currentTime,
      PHASE_SMOOTHING
    );
    target(
      graph.noiseVoice.filter.frequency,
      profile.key === "nebula-gate"
        ? 900 + world.densityRatio * 1100
        : profile.key === "crystalline-choir"
          ? 3600
          : 620,
      currentTime,
      PHASE_SMOOTHING
    );
    target(
      graph.noiseVoice.gain.gain,
      world.active ? profile.noiseGain * (0.5 + world.densityRatio * 0.75) : MIN_GAIN,
      currentTime,
      PHASE_SMOOTHING
    );
    target(
      graph.noiseVoice.panner.pan,
      Math.sin(world.time * profile.orbitRate) * profile.width * 0.5,
      currentTime,
      0.18
    );
    if ("curve" in graph.fieldShaper) graph.fieldShaper.curve = getFoldCurve(transform.wavefold);
    target(graph.field.gain, world.active ? 0.46 : MIN_GAIN, currentTime, 0.18);
  }

  function setWorkletParam(name, value, smoothing = 0.2) {
    const param = workletNode?.parameters?.get(name);
    if (param) target(param, value, now(), smoothing);
  }

  function updateWorklet(world, profile, transform) {
    if (!workletNode) return;
    const active = mode === "active" ? 1 : 0;
    setWorkletParam("capture", active * (0.32 + world.densityRatio * 0.28), 0.3);
    setWorkletParam(
      "memory",
      active * Math.min(
        0.24,
        0.025 +
          profile.memoryGain * transform.memory * 0.09 +
          world.grazeRatio * 0.04 +
          (world.loopIndex > 0 ? 0.025 : 0)
      ),
      0.3
    );
    setWorkletParam(
      "activity",
      active * Math.min(
        1,
        0.12 +
          world.chainRatio * 0.3 +
          world.densityRatio * 0.38 +
          (world.loopIndex > 0 ? 0.12 : 0)
      ),
      0.3
    );
    setWorkletParam("descent", transform.descent, PHASE_SMOOTHING);
  }

  function applyWorld(world) {
    if (!world || !currentGraph || mode !== "active") return;
    const profile = getAudioStageProfile(world.stageKey);
    const transform = getAudioBossTransform(world.bossKey, world.bossPhaseIndex);
    const body = selectBody(currentGraph, profile);
    updateBody(body, world, transform);
    updateField(currentGraph, world, profile, transform);
    updateWorklet(world, profile, transform);
    const score = selectScoreSection(currentGraph, world, profile);
    scheduleScore(currentGraph, score);
  }

  function releaseGraph(graph) {
    if (!graph || graph.released) return;
    graph.released = true;
    if (workletGraph === graph) detachWorkletGraph();
    for (const voice of [...graph.voices]) stopVoice(graph, voice, 0);
    releaseScoreSection(graph, graph.activeScore);
    releaseScoreSection(graph, graph.fadingScore);
    releaseBody(graph, graph.activeBody);
    releaseBody(graph, graph.fadingBody);
    for (const voice of graph.accompanimentVoices) stop(voice.oscillator, now());
    stop(graph.modulation?.source, now());
    stop(graph.noiseVoice?.source, now());
    for (const node of graph.persistentNodes) disconnect(node);
    graph.accompanimentVoices.length = 0;
  }

  function retireGraph(graph, fade = RESET_FADE) {
    if (!graph || graph.released) return;
    ramp(graph.output.gain, MIN_GAIN, now(), fade);
    ramp(graph.ending.gain, MIN_GAIN, now(), fade);
    graph.releaseAt = now() + fade + 0.02;
    retiredGraphs.push(graph);
    if (currentGraph === graph) currentGraph = null;
  }

  function maintenance() {
    if (!ctx) return;
    if (currentGraph?.fadingBody && now() >= currentGraph.fadingBody.releaseAt) {
      releaseBody(currentGraph, currentGraph.fadingBody);
    }
    maintainScoreSection(currentGraph?.activeScore);
    maintainScoreSection(currentGraph?.fadingScore);
    if (currentGraph?.fadingScore && now() >= currentGraph.fadingScore.releaseAt) {
      releaseScoreSection(currentGraph, currentGraph.fadingScore);
    }
    const pending = [];
    for (const graph of retiredGraphs) {
      if (now() >= graph.releaseAt) releaseGraph(graph);
      else pending.push(graph);
    }
    retiredGraphs = pending;
    if (mode.startsWith("ending-") && now() >= endingAt) {
      mode = "idle";
      if (currentGraph) target(currentGraph.output.gain, MIN_GAIN, now(), 0.08);
    }
  }

  function attachWorkletGraph(graph) {
    if (!workletNode || !workletGain || !graph || graph.released) return;
    if (workletGraph) {
      disconnect(workletGraph.excitation, workletNode);
      disconnect(workletGain, workletGraph.wet);
    }
    graph.excitation.connect(workletNode);
    workletGain.connect(graph.wet);
    workletGraph = graph;
  }

  function detachWorkletGraph() {
    if (!workletGraph || !workletNode || !workletGain) {
      workletGraph = null;
      return;
    }
    disconnect(workletGraph.excitation, workletNode);
    disconnect(workletGain, workletGraph.wet);
    workletGraph = null;
  }

  function fallbackWorklet(reason = "") {
    workletFailure = reason;
    workletStatus = "fallback";
    const failingNode = workletNode;
    const failingGain = workletGain;
    const failingGraph = workletGraph;
    if (failingGain) target(failingGain.gain, MIN_GAIN, now(), 0.15);
    if (failingGraph && failingNode) disconnect(failingGraph.excitation, failingNode);
    workletGraph = null;
    workletNode = null;
    workletGain = null;
    if (failingNode || failingGain) {
      const resources = { node: failingNode, gain: failingGain, graph: failingGraph, timer: null };
      resources.timer = setTimeout(() => {
        if (resources.graph && resources.gain) disconnect(resources.gain, resources.graph.wet);
        disconnect(resources.node);
        disconnect(resources.gain);
        fadingWorklets.delete(resources);
      }, 180);
      fadingWorklets.add(resources);
    }
  }

  function initializeWorklet() {
    const audioWorklet = ctx?.audioWorklet;
    const AudioWorkletNodeConstructor = globalThis.AudioWorkletNode || globalThis.window?.AudioWorkletNode;
    if (!enableWorklet || !audioWorklet || !AudioWorkletNodeConstructor) {
      workletStatus = "fallback";
      return Promise.resolve(false);
    }
    const generation = ++workletGeneration;
    workletStatus = "loading";
    workletFailure = "";
    const moduleUrl = new URL("./worklets/resonantMemoryProcessor.js", import.meta.url);
    return audioWorklet.addModule(moduleUrl).then(() => {
      if (disposed || generation !== workletGeneration || !ctx) return false;
      workletNode = new AudioWorkletNodeConstructor(ctx, "resonant-memory", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      workletGain = ctx.createGain();
      setValue(workletGain.gain, MIN_GAIN, now());
      workletNode.connect(workletGain);
      workletNode.onprocessorerror = () => fallbackWorklet("processorerror");
      workletNode.port.postMessage({ type: "seed", value: seed });
      attachWorkletGraph(currentGraph);
      target(workletGain.gain, 1, now(), 0.4);
      workletStatus = "enhanced";
      return true;
    }).catch((error) => {
      if (!disposed && generation === workletGeneration) {
        fallbackWorklet(error?.message || "AudioWorklet module failed to load.");
      }
      return false;
    });
  }

  function init() {
    if (ctx || disposed) return;
    ctx = (contextFactory || defaultContextFactory)();
    if (!ctx) return;
    createMasterGraph();
    makeNoiseBuffer();
    workletReady = initializeWorklet();
  }

  function resume() {
    if (!disposed && ctx?.state === "suspended") return ctx.resume();
  }

  function beginRun(world) {
    if (!ctx || disposed) return false;
    maintenance();
    if (currentGraph) retireGraph(currentGraph);
    currentGraph = createRunGraph(world);
    attachWorkletGraph(currentGraph);
    workletNode?.port.postMessage({ type: "clear" });
    workletNode?.port.postMessage({ type: "seed", value: seed });
    mode = "active";
    endingAt = 0;
    lastWorld = world;
    ramp(currentGraph.output.gain, 1, now(), 0.05);
    applyWorld(mergeAudioWorld(world, debugWorld));
    return true;
  }

  function updateWorld(world) {
    if (!ctx || disposed) return;
    maintenance();
    lastWorld = world;
    if (mode === "active") applyWorld(mergeAudioWorld(world, debugWorld));
  }

  function scheduleScoreEnding(section, outcome, root) {
    if (!section) return;
    const currentTime = now();
    const duration = outcome === "death" ? 3.2 : 3;
    for (const param of [section.output.gain, section.wetOutput.gain]) {
      hold(param, currentTime);
      setValue(param, Math.max(MIN_GAIN, param.value), currentTime);
    }
    section.banks.forEach((bank) => {
      hold(bank.gain.gain, currentTime);
      setValue(
        bank.gain.gain,
        Math.max(MIN_GAIN, bank.gain.gain.value),
        currentTime
      );
      bank.voices.forEach((voice, index) => {
        const destination = outcome === "death"
          ? Math.max(32, voice.oscillator.frequency.value * 0.5)
          : root * (index % 2 === 0 ? 1 : 1.5);
        delayedRamp(
          voice.oscillator.frequency,
          destination,
          currentTime,
          0.08,
          outcome === "death" ? 1.8 : 1.4,
          true
        );
        delayedRamp(
          voice.gain.gain,
          MIN_GAIN,
          currentTime,
          outcome === "death" ? 0.45 + index * 0.12 : 0.8,
          duration - 0.5
        );
        delayedRamp(
          voice.panner.pan,
          0,
          currentTime,
          0,
          outcome === "death" ? 0.9 : 1.4
        );
      });
    });
    delayedRamp(
      section.harmony.gain,
      MIN_GAIN,
      currentTime,
      outcome === "death" ? 0.35 : 0.6,
      duration - 0.3
    );
  }

  function scheduleFieldEnding(outcome, root) {
    if (!currentGraph) return;
    const duration = outcome === "death" ? 3.2 : 3;
    const currentTime = now();
    currentGraph.accompanimentVoices.forEach((voice, index) => {
      const destination = outcome === "death"
        ? Math.max(32, voice.oscillator.frequency.value * 0.5)
        : root * (index % 2 === 0 ? 1 : 1.5);
      delayedRamp(
        voice.oscillator.frequency,
        destination,
        currentTime,
        0.08,
        outcome === "death" ? 1.8 : 1.4,
        true
      );
      delayedRamp(
        voice.gain.gain,
        MIN_GAIN,
        currentTime,
        outcome === "death" ? 0.12 + index * 0.08 : 0.3,
        duration - 0.3
      );
      delayedRamp(
        voice.panner.pan,
        0,
        currentTime,
        0,
        outcome === "death" ? 0.9 : 1.4
      );
    });
    delayedRamp(
      currentGraph.noiseVoice?.gain.gain,
      MIN_GAIN,
      currentTime,
      0.08,
      outcome === "death" ? 1.5 : 2
    );
    delayedRamp(
      currentGraph.field.gain,
      MIN_GAIN,
      currentTime,
      outcome === "death" ? 0.12 : 0.3,
      duration - 0.3
    );
    if (currentGraph.activeBody) {
      delayedRamp(
        currentGraph.activeBody.output.gain,
        MIN_GAIN,
        currentTime,
        0.2,
        duration - 0.25
      );
    }
    delayedRamp(
      currentGraph.wet.gain,
      MIN_GAIN,
      currentTime,
      0.35,
      duration - 0.25
    );
    delayedRamp(
      currentGraph.output.gain,
      MIN_GAIN,
      currentTime,
      outcome === "death" ? 1.4 : duration - 0.35,
      outcome === "death" ? 1.7 : 0.35
    );
  }

  function endRun(outcome, payload = {}) {
    if (!ctx || disposed || mode !== "active" || !["death", "victory"].includes(outcome)) return false;
    const world = mergeAudioWorld(lastWorld, debugWorld);
    const profile = getAudioStageProfile(world?.stageKey);
    const root = profile.root * (world?.loopIndex > 0 ? 1.06 : 1);
    stopScoreTransport(currentGraph?.activeScore);
    playEvent(outcome === "death" ? "player-death" : "victory", payload);
    mode = outcome === "death" ? "ending-death" : "ending-victory";
    endingAt = now() + (outcome === "death" ? 3.2 : 3);
    scheduleScoreEnding(currentGraph?.activeScore, outcome, root);
    scheduleFieldEnding(outcome, root);
    if (outcome === "death") workletNode?.port.postMessage({ type: "requiem" });
    else {
      setWorkletParam("capture", 0, 0.3);
      setWorkletParam("activity", 0, 0.3);
      setWorkletParam("memory", 0, 2.7);
    }
    return true;
  }

  function resetRun() {
    if (disposed) return;
    if (currentGraph) retireGraph(currentGraph, RESET_FADE);
    workletNode?.port.postMessage({ type: "clear" });
    mode = "idle";
    endingAt = 0;
    debugWorld = null;
    debugScore = null;
  }

  function setDebugWorld(override) {
    if (!override || typeof override !== "object") return false;
    debugWorld = Object.freeze({ ...override, active: true });
    if (lastWorld && mode === "active") applyWorld(mergeAudioWorld(lastWorld, debugWorld));
    return true;
  }

  function clearDebugWorld() {
    debugWorld = null;
    if (lastWorld && mode === "active") applyWorld(lastWorld);
  }

  function restartScorePhrase(section) {
    if (!section) return;
    for (const voice of [...section.percussionVoices]) stopScoreTransient(section, voice);
    for (const bank of section.banks) {
      ramp(bank.gain.gain, MIN_GAIN, now(), 0.03);
      for (const voice of bank.voices) hold(voice.oscillator.frequency, now());
    }
    section.activeBank = -1;
    section.startAt = now() + 0.05;
    section.nextStep = 0;
    section.scheduledThrough = section.startAt;
    section.plan = null;
    section.planPhraseIndex = -1;
    section.scheduledChordBanks.clear();
    section.transportActive = true;
  }

  function setDebugScore(options = {}) {
    if (!options || typeof options !== "object") return false;
    const soloBus = options.soloBus ?? null;
    const arrangementTier = options.arrangementTier ?? null;
    if (!validScoreSoloBuses.has(soloBus)) return false;
    if (
      arrangementTier !== null &&
      (!Number.isInteger(arrangementTier) || arrangementTier < 0 || arrangementTier > 2)
    ) {
      return false;
    }
    if (
      options.restartPhrase !== undefined &&
      typeof options.restartPhrase !== "boolean"
    ) {
      return false;
    }
    debugScore = Object.freeze({ soloBus, arrangementTier });
    const section = currentGraph?.activeScore;
    if (section) {
      applyScoreSolo(section);
      const world = mergeAudioWorld(lastWorld, debugWorld);
      section.desiredControl = desiredScoreControl(
        world,
        section.desiredControl.densityTier
      );
      if (options.restartPhrase) restartScorePhrase(section);
      scheduleScore(currentGraph, section);
    }
    return true;
  }

  function clearDebugScore() {
    debugScore = null;
    const section = currentGraph?.activeScore;
    if (section) {
      applyScoreSolo(section);
      const world = mergeAudioWorld(lastWorld, debugWorld);
      section.desiredControl = desiredScoreControl(
        world,
        section.desiredControl.densityTier
      );
    }
  }

  function getDiagnostics() {
    maintenance();
    let rms = 0;
    let peak = 0;
    if (analyser?.getFloatTimeDomainData && analyserData) {
      analyser.getFloatTimeDomainData(analyserData);
      let sum = 0;
      for (const sample of analyserData) {
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      rms = Math.sqrt(sum / analyserData.length);
    }
    const world = mergeAudioWorld(lastWorld, debugWorld);
    const graphs = [currentGraph, ...retiredGraphs].filter(Boolean);
    const graphNodeCount = graphs.reduce((total, graph) => {
      const bodyNodes =
        (graph.activeBody?.nodes.length ?? 0) + (graph.fadingBody?.nodes.length ?? 0);
      const voiceNodes = [...graph.voices].reduce(
        (voiceTotal, voice) => voiceTotal + voice.nodes.length,
        0
      );
      const scoreNodes = [graph.activeScore, graph.fadingScore]
        .filter(Boolean)
        .reduce(
          (scoreTotal, section) =>
            scoreTotal +
            section.nodes.length +
            [...section.percussionVoices].reduce(
              (transientTotal, voice) => transientTotal + voice.nodes.length,
              0
            ),
          0
        );
      return total + graph.persistentNodes.length + bodyNodes + voiceNodes + scoreNodes;
    }, 0);
    const score = currentGraph?.activeScore ?? null;
    const scoreStep = score?.plan
      ? Math.max(0, Math.floor((now() - score.startAt) / score.plan.secondsPerStep))
      : 0;
    const scoreLocalStep = score?.plan ? scoreStep % score.plan.stepsPerCycle : 0;
    let scoreChordIndex = -1;
    if (score?.plan) {
      for (const chord of score.plan.chords) {
        if (chord.step > scoreLocalStep) break;
        scoreChordIndex = chord.chordIndex;
      }
    }
    return {
      contextState: ctx?.state ?? "uninitialized",
      mode: disposed ? "disposed" : mode,
      stageKey: world?.stageKey ?? null,
      bossKey: world?.bossKey ?? null,
      bossPhaseIndex: world?.bossPhaseIndex ?? -1,
      loopIndex: world?.loopIndex ?? 0,
      workletStatus,
      workletFailure,
      activeVoices: currentGraph?.voices.size ?? 0,
      endingVoices:
        [...(currentGraph?.voices ?? [])].filter(
          ({ kind }) => kind === "player-death" || kind === "victory"
        ).length,
      resonantBodies: (currentGraph?.activeBody ? 1 : 0) + (currentGraph?.fadingBody ? 1 : 0),
      activeGraphs: currentGraph ? 1 : 0,
      retiredGraphs: retiredGraphs.length,
      scoreSectionKey: score?.sectionKey ?? null,
      scorePhaseKey: score?.plan?.phaseKey ?? null,
      scoreBpm: score?.plan?.bpm ?? null,
      scoreMeter: score?.plan
        ? `${score.plan.meter.numerator}/${score.plan.meter.denominator}`
        : null,
      scoreBar: score?.plan
        ? Math.floor(scoreStep / score.plan.meter.stepsPerBar) + 1
        : 0,
      scoreBeat: score?.plan
        ? Math.floor(
          (scoreStep % score.plan.meter.stepsPerBar) /
            score.plan.meter.primaryBeatSteps
        ) + 1
        : 0,
      scoreChordIndex,
      scoreArrangementTier: score?.control.arrangementTier ?? null,
      activePercussionVoices: score?.percussionVoices.size ?? 0,
      scoreStartAt: score?.startAt ?? 0,
      scoreScheduledThrough: score?.scheduledThrough ?? 0,
      skippedLateScoreSteps: score?.skippedLateSteps ?? 0,
      nodeCount: (ctx ? 4 : 0) + graphNodeCount + (workletNode ? 2 : 0),
      peak,
      rms,
    };
  }

  function playDebugEvent(kind, payload = {}) {
    if (!validEventKinds.has(kind)) return false;
    if (kind === "player-death") return endRun("death", payload);
    if (kind === "victory") return endRun("victory", payload);
    return playEvent(kind, payload);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    mode = "disposed";
    workletGeneration += 1;
    workletNode?.port.postMessage({ type: "clear" });
    detachWorkletGraph();
    disconnect(workletNode);
    disconnect(workletGain);
    workletNode = null;
    workletGain = null;
    for (const resources of fadingWorklets) {
      clearTimeout(resources.timer);
      if (resources.graph && resources.gain) disconnect(resources.gain, resources.graph.wet);
      disconnect(resources.node);
      disconnect(resources.gain);
    }
    fadingWorklets.clear();
    if (currentGraph) releaseGraph(currentGraph);
    for (const graph of retiredGraphs) releaseGraph(graph);
    currentGraph = null;
    retiredGraphs = [];
    disconnect(analyser);
    disconnect(compressor);
    disconnect(masterShaper);
    disconnect(masterInput);
    const closingContext = ctx;
    ctx = null;
    masterInput = null;
    masterShaper = null;
    compressor = null;
    analyser = null;
    analyserData = null;
    impulseCache.clear();
    periodicWaveCache.clear();
    foldCurveCache.clear();
    percussionBufferCache.clear();
    noiseBuffer = null;
    debugScore = null;
    if (closingContext?.state !== "closed" && typeof closingContext?.close === "function") {
      return closingContext.close();
    }
  }

  return {
    init,
    resume,
    beginRun,
    updateWorld,
    playEvent,
    endRun,
    resetRun,
    getDiagnostics,
    setDebugWorld,
    clearDebugWorld,
    setDebugScore,
    clearDebugScore,
    playDebugEvent,
    dispose,
    get ready() {
      return workletReady;
    },
  };
}
