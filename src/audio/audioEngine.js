import {
  clampFeedback,
  getAudioBossTransform,
  getAudioStageProfile,
} from "./audioProfiles.js";
import { mergeAudioWorld, panForWorldX } from "./audioState.js";
import { getAudioEventRecipe, listAudioEventKinds } from "./sfx.js";

const MAX_TEMPORARY_VOICES = 48;
const STAGE_CROSSFADE = 1.2;
const PHASE_SMOOTHING = 0.6;
const RESET_FADE = 0.03;
const MIN_GAIN = 0.0001;
const validEventKinds = new Set(listAudioEventKinds());

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
  let noiseBuffer = null;

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

  function createFieldVoice(graph, role, type, ratio, filterType, filterFrequency) {
    const oscillator = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panner = createPanner(ctx);
    oscillator.type = type;
    filter.type = filterType;
    setValue(filter.frequency, filterFrequency, now());
    setValue(gain.gain, MIN_GAIN, now());
    setValue(panner.pan, 0, now());
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(graph.fieldInput);
    oscillator.start(now());
    const voice = { role, ratio, oscillator, filter, gain, panner };
    graph.persistentNodes.push(oscillator, filter, gain, panner);
    graph.fieldVoices.push(voice);
    return voice;
  }

  function createRunGraph() {
    const graph = {
      output: ctx.createGain(),
      ending: ctx.createGain(),
      dry: ctx.createGain(),
      field: ctx.createGain(),
      fieldInput: ctx.createGain(),
      fieldShaper: createWaveShaper(ctx, getFoldCurve(0)),
      wet: ctx.createGain(),
      excitation: ctx.createGain(),
      fieldVoices: [],
      modulation: null,
      noiseVoice: null,
      persistentNodes: [],
      voices: new Set(),
      lastEventAt: new Map(),
      activeBody: null,
      fadingBody: null,
      profileKey: null,
      releaseAt: 0,
      released: false,
    };
    setValue(graph.output.gain, MIN_GAIN, now());
    setValue(graph.ending.gain, 1, now());
    setValue(graph.dry.gain, 0.9, now());
    setValue(graph.field.gain, 0.7, now());
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
    createFieldVoice(graph, "root", "triangle", 1, "lowpass", 680);
    createFieldVoice(graph, "third", "sine", 1.25, "lowpass", 920);
    createFieldVoice(graph, "fifth", "triangle", 1.5, "lowpass", 820);
    createFieldVoice(graph, "air", "sine", 3.7, "bandpass", 3200);
    createFieldVoice(graph, "pulse", "square", 1.8, "bandpass", 1200);
    createFieldVoice(graph, "danger", "sawtooth", 3.2, "highpass", 1800);
    createFieldVoice(graph, "loop", "sine", 2.1, "lowpass", 1500);
    const modulationSource = ctx.createOscillator();
    const modulationDepth = ctx.createGain();
    setValue(modulationSource.frequency, 19, now());
    setValue(modulationDepth.gain, MIN_GAIN, now());
    modulationSource.connect(modulationDepth);
    modulationDepth.connect(graph.fieldVoices.find(({ role }) => role === "air").oscillator.frequency);
    modulationDepth.connect(graph.fieldVoices.find(({ role }) => role === "pulse").oscillator.frequency);
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
    if (played) graph.lastEventAt.set(kind, now());
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
    const root = profile.root * (world.loopIndex > 0 ? 1.06 : 1);
    const lowHullWeight = world.hull <= 2 ? 1 : world.hull === 3 ? 0.45 : 0;
    const bossWeight = world.bossKey ? 1 : 0;
    const pulseWave = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(world.time * 2.7 * transform.pulseRate));
    const dangerWave = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(world.time * 8.2));
    const baseGains = {
      root: 0.022,
      third: 0.018,
      fifth: 0.014,
      air: 0.003 + world.grazeRatio * 0.016 + world.chainRatio * 0.006,
      pulse: 0.012 + bossWeight * 0.055 * transform.pulseGain * pulseWave,
      danger: lowHullWeight * 0.05 * dangerWave,
      loop: (world.loopIndex > 0 ? 1 : 0) * 0.03 * (0.4 + 0.6 * pulseWave),
    };
    const periodicWave = getPeriodicWave(profile);
    for (let index = 0; index < graph.fieldVoices.length; index += 1) {
      const voice = graph.fieldVoices[index];
      if (periodicWave && typeof voice.oscillator.setPeriodicWave === "function") {
        voice.oscillator.setPeriodicWave(periodicWave);
      }
      let ratio = voice.ratio;
      if (voice.role === "pulse") ratio = world.bossKey ? 2.4 : 1.8;
      if (voice.role === "air") ratio *= 1 - transform.descent * 0.08;
      target(
        voice.oscillator.frequency,
        Math.min(ctx.sampleRate * 0.45, root * ratio),
        currentTime,
        0.22
      );
      const upperScale = ["air", "pulse"].includes(voice.role) ? transform.upperGain : 1;
      target(voice.gain.gain, baseGains[voice.role] * upperScale, currentTime, 0.16);
      const orbit = Math.sin(world.time * profile.orbitRate * (index + 1) + index * 1.7);
      const roleWidth = ["air", "pulse", "loop"].includes(voice.role) ? 0.42 : 0.14;
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
    target(graph.field.gain, world.active ? 0.7 : MIN_GAIN, currentTime, 0.18);
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
  }

  function releaseGraph(graph) {
    if (!graph || graph.released) return;
    graph.released = true;
    if (workletGraph === graph) detachWorkletGraph();
    for (const voice of [...graph.voices]) stopVoice(graph, voice, 0);
    releaseBody(graph, graph.activeBody);
    releaseBody(graph, graph.fadingBody);
    for (const voice of graph.fieldVoices) stop(voice.oscillator, now());
    stop(graph.modulation?.source, now());
    stop(graph.noiseVoice?.source, now());
    for (const node of graph.persistentNodes) disconnect(node);
    graph.fieldVoices.length = 0;
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
    currentGraph = createRunGraph();
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

  function scheduleFieldEnding(outcome, root) {
    if (!currentGraph) return;
    const duration = outcome === "death" ? 3.2 : 3;
    const currentTime = now();
    currentGraph.fieldVoices.forEach((voice, index) => {
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
    delayedRamp(currentGraph.wet.gain, MIN_GAIN, currentTime, 0.35, duration - 0.25);
    delayedRamp(currentGraph.output.gain, MIN_GAIN, currentTime, duration - 0.35, 0.35);
  }

  function endRun(outcome, payload = {}) {
    if (!ctx || disposed || mode !== "active" || !["death", "victory"].includes(outcome)) return false;
    const world = mergeAudioWorld(lastWorld, debugWorld);
    const profile = getAudioStageProfile(world?.stageKey);
    const root = profile.root * (world?.loopIndex > 0 ? 1.06 : 1);
    playEvent(outcome === "death" ? "player-death" : "victory", payload);
    mode = outcome === "death" ? "ending-death" : "ending-victory";
    endingAt = now() + (outcome === "death" ? 3.2 : 3);
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
      return total + graph.persistentNodes.length + bodyNodes + voiceNodes;
    }, 0);
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
    noiseBuffer = null;
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
    playDebugEvent,
    dispose,
    get ready() {
      return workletReady;
    },
  };
}
