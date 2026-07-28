class ResonantMemoryProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "capture", defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "memory", defaultValue: 0.08, minValue: 0, maxValue: 0.3, automationRate: "k-rate" },
      { name: "activity", defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "descent", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }

  constructor(options) {
    super(options);
    this.length = Math.max(1, Math.floor(sampleRate * 4));
    this.left = new Float32Array(this.length);
    this.right = new Float32Array(this.length);
    this.writeIndex = 0;
    this.framesSeen = 0;
    this.seed = 0x51f15e;
    this.grainCountdown = Math.floor(sampleRate * 0.2);
    this.freezeFrames = 0;
    this.requiemFrames = 0;
    this.requiemTotal = 1;
    this.grains = Array.from({ length: 8 }, () => ({
      active: false,
      read: 0,
      rate: 1,
      age: 0,
      duration: 1,
      pan: 0,
    }));

    this.port.onmessage = (event) => {
      const message = event.data || {};
      if (message.type === "clear") {
        this.left.fill(0);
        this.right.fill(0);
        this.writeIndex = 0;
        this.framesSeen = 0;
        this.freezeFrames = 0;
        this.requiemFrames = 0;
        for (const grain of this.grains) grain.active = false;
      } else if (message.type === "seed" && Number.isFinite(message.value)) {
        this.seed = message.value >>> 0 || 1;
      } else if (message.type === "requiem") {
        this.freezeFrames = Math.floor(sampleRate * 0.25);
        this.requiemFrames = Math.floor(sampleRate * 3.2);
        this.requiemTotal = this.requiemFrames;
        this.grainCountdown = 0;
      }
    };
  }

  random() {
    let value = this.seed;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.seed = value >>> 0 || 1;
    return this.seed / 0x100000000;
  }

  spawnGrain(activity, requiemWeight, descent) {
    let grain = null;
    for (let index = 0; index < this.grains.length; index += 1) {
      if (!this.grains[index].active) {
        grain = this.grains[index];
        break;
      }
    }
    if (!grain || this.framesSeen < sampleRate * 0.12) return;

    const history = Math.min(this.framesSeen, this.length - 1);
    const offset = Math.floor((0.08 + this.random() * 2.4) * sampleRate);
    grain.active = true;
    grain.read = (this.writeIndex - Math.min(history, offset) + this.length) % this.length;
    grain.rate = requiemWeight > 0
      ? 0.42 + this.random() * 0.38
      : 0.72 + this.random() * (0.56 + activity * 0.22) - descent * 0.24;
    grain.age = 0;
    grain.duration = Math.floor(sampleRate * (0.055 + this.random() * (0.12 + activity * 0.08)));
    grain.pan = this.random() * 2 - 1;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const outLeft = output?.[0];
    const outRight = output?.[1] || outLeft;
    if (!outLeft || !outRight) return true;

    const inLeft = input?.[0];
    const inRight = input?.[1] || inLeft;
    const capture = parameters.capture[0] || 0;
    const memory = parameters.memory[0] || 0;
    const activity = parameters.activity[0] || 0;
    const descent = parameters.descent[0] || 0;

    for (let frame = 0; frame < outLeft.length; frame += 1) {
      const sourceLeft = inLeft?.[frame] || 0;
      const sourceRight = inRight?.[frame] || sourceLeft;
      if (this.freezeFrames <= 0) {
        this.left[this.writeIndex] = sourceLeft * capture;
        this.right[this.writeIndex] = sourceRight * capture;
        this.writeIndex = (this.writeIndex + 1) % this.length;
        this.framesSeen = Math.min(this.length, this.framesSeen + 1);
      } else {
        this.freezeFrames -= 1;
      }

      const requiemWeight = this.requiemFrames > 0
        ? this.requiemFrames / this.requiemTotal
        : 0;
      this.grainCountdown -= 1;
      if (this.grainCountdown <= 0) {
        this.spawnGrain(activity, requiemWeight, descent);
        const rate = requiemWeight > 0 ? 8 + requiemWeight * 12 : 1.5 + activity * 6;
        this.grainCountdown = Math.max(1, Math.floor(sampleRate / rate));
      }

      let wetLeft = 0;
      let wetRight = 0;
      for (let index = 0; index < this.grains.length; index += 1) {
        const grain = this.grains[index];
        if (!grain.active) continue;
        const phase = grain.age / grain.duration;
        if (phase >= 1) {
          grain.active = false;
          continue;
        }
        const readIndex = Math.floor(grain.read) % this.length;
        const envelope = Math.sin(Math.PI * phase) ** 2;
        const leftGain = Math.sqrt((1 - grain.pan) * 0.5);
        const rightGain = Math.sqrt((1 + grain.pan) * 0.5);
        wetLeft += this.left[readIndex] * envelope * leftGain;
        wetRight += this.right[readIndex] * envelope * rightGain;
        grain.read = (grain.read + grain.rate) % this.length;
        grain.age += 1;
      }

      const requiemGain = requiemWeight > 0 ? 0.35 + requiemWeight * 0.65 : 1;
      outLeft[frame] = wetLeft * memory * requiemGain;
      outRight[frame] = wetRight * memory * requiemGain;
      if (this.requiemFrames > 0) this.requiemFrames -= 1;
    }

    return true;
  }
}

registerProcessor("resonant-memory", ResonantMemoryProcessor);
