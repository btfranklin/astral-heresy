export function createAudioParam(value = 0) {
  return {
    value,
    automation: [],
    setValueAtTime(next, at) {
      this.value = next;
      this.automation.push({ method: "set", value: next, at });
    },
    setTargetAtTime(next, at, constant) {
      this.value = next;
      this.automation.push({ method: "target", value: next, at, constant });
    },
    linearRampToValueAtTime(next, at) {
      this.value = next;
      this.automation.push({ method: "linear", value: next, at });
    },
    exponentialRampToValueAtTime(next, at) {
      this.value = next;
      this.automation.push({ method: "exponential", value: next, at });
    },
    cancelAndHoldAtTime(at) {
      this.automation.push({ method: "hold", at });
    },
    cancelScheduledValues(at) {
      this.automation.push({ method: "cancel", at });
    },
  };
}

export function createAudioNode(extra = {}) {
  return {
    connections: new Set(),
    disconnectCalls: 0,
    connect(target) {
      this.connections.add(target);
      return target;
    },
    disconnect(target) {
      this.disconnectCalls += 1;
      if (target) this.connections.delete(target);
      else this.connections.clear();
    },
    ...extra,
  };
}

export class RecordingAudioContext {
  constructor({ worklet = null } = {}) {
    this.destination = createAudioNode();
    this.sampleRate = 12_000;
    this.currentTime = 0;
    this.state = "running";
    this.closeCalls = 0;
    this.nodes = [];
    this.oscillators = [];
    this.sources = [];
    this.audioWorklet = worklet;
  }

  record(node) {
    this.nodes.push(node);
    return node;
  }

  advance(seconds) {
    this.currentTime += seconds;
  }

  createGain() {
    return this.record(createAudioNode({ gain: createAudioParam(1) }));
  }

  createOscillator() {
    const listeners = new Map();
    const node = this.record(createAudioNode({
      frequency: createAudioParam(440),
      detune: createAudioParam(0),
      startCalls: [],
      stopCalls: [],
      start(at = 0) {
        this.startCalls.push(at);
      },
      stop(at = 0) {
        this.stopCalls.push(at);
      },
      addEventListener(kind, listener) {
        listeners.set(kind, listener);
      },
      setPeriodicWave(wave) {
        this.periodicWave = wave;
      },
      finish() {
        listeners.get("ended")?.();
      },
    }));
    this.oscillators.push(node);
    return node;
  }

  createBiquadFilter() {
    return this.record(createAudioNode({
      frequency: createAudioParam(350),
      Q: createAudioParam(1),
      gain: createAudioParam(0),
    }));
  }

  createBuffer(channels, length, sampleRate = this.sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      duration: length / sampleRate,
      getChannelData(channel) {
        return data[channel];
      },
    };
  }

  createBufferSource() {
    const listeners = new Map();
    const node = this.record(createAudioNode({
      buffer: null,
      startCalls: [],
      stopCalls: [],
      start(...args) {
        this.startCalls.push(args);
      },
      stop(at = 0) {
        this.stopCalls.push(at);
      },
      addEventListener(kind, listener) {
        listeners.set(kind, listener);
      },
      finish() {
        listeners.get("ended")?.();
      },
    }));
    this.sources.push(node);
    return node;
  }

  createDelay() {
    return this.record(createAudioNode({ delayTime: createAudioParam(0) }));
  }

  createConvolver() {
    return this.record(createAudioNode({ buffer: null, normalize: false }));
  }

  createStereoPanner() {
    return this.record(createAudioNode({ pan: createAudioParam(0) }));
  }

  createWaveShaper() {
    return this.record(createAudioNode({ curve: null, oversample: "none" }));
  }

  createDynamicsCompressor() {
    return this.record(createAudioNode({
      threshold: createAudioParam(-24),
      knee: createAudioParam(30),
      ratio: createAudioParam(12),
      attack: createAudioParam(0.003),
      release: createAudioParam(0.25),
    }));
  }

  createAnalyser() {
    return this.record(createAudioNode({
      fftSize: 512,
      getFloatTimeDomainData(array) {
        array.fill(0);
      },
    }));
  }

  createPeriodicWave(real, imag) {
    return { real, imag };
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  close() {
    this.closeCalls += 1;
    this.state = "closed";
    return Promise.resolve();
  }
}

export function makeAudioWorld(overrides = {}) {
  return {
    active: true,
    time: 0,
    stageKey: "nebula-gate",
    stageIndex: 0,
    loopIndex: 0,
    hull: 5,
    hullRatio: 1,
    bossKey: null,
    bossPhaseIndex: -1,
    bossProgress: 0,
    chainRatio: 0,
    grazeRatio: 0,
    densityRatio: 0,
    playerX: 640,
    playfieldMinX: 0,
    playfieldMaxX: 1280,
    ...overrides,
  };
}
