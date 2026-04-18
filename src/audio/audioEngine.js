export function createAudioEngine() {
  const engine = {
    ctx: null,
    master: null,
    sfx: null,
    lastShot: 0,
  };

  function init() {
    if (engine.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    engine.ctx = new AudioContext();
    engine.master = engine.ctx.createGain();
    engine.master.gain.value = 0.35;
    engine.master.connect(engine.ctx.destination);
    engine.sfx = engine.ctx.createGain();
    engine.sfx.gain.value = 0.9;
    engine.sfx.connect(engine.master);
  }

  function resume() {
    if (engine.ctx && engine.ctx.state === "suspended") {
      engine.ctx.resume();
    }
  }

  function playTone(type, freq, duration, opts = {}) {
    if (!engine.ctx) return;
    const ctx = engine.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const amp = opts.amp || 0.2;
    const attack = opts.attack || 0.01;
    const release = opts.release || duration;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (opts.detune) {
      osc.detune.setValueAtTime(opts.detune, now);
    }
    if (opts.slide) {
      const target = Math.max(40, freq * opts.slide);
      osc.frequency.exponentialRampToValueAtTime(target, now + duration);
    }
    let node = osc;
    if (opts.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filterType || "lowpass";
      filter.frequency.setValueAtTime(opts.filter, now);
      if (opts.q) {
        filter.Q.setValueAtTime(opts.q, now);
      }
      osc.connect(filter);
      node = filter;
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(amp, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + release);
    node.connect(gain);
    gain.connect(engine.sfx);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playNoise(duration, opts = {}) {
    if (!engine.ctx) return;
    const ctx = engine.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const amp = opts.amp || 0.2;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(amp, now + (opts.attack || 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (opts.release || duration));
    let node = source;
    if (opts.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filterType || "lowpass";
      filter.frequency.setValueAtTime(opts.filter, now);
      if (opts.q) {
        filter.Q.setValueAtTime(opts.q, now);
      }
      source.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(engine.sfx);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  function playChord(freqs, duration, opts = {}) {
    for (const [index, freq] of freqs.entries()) {
      playTone(opts.type || "sine", freq, duration, {
        amp: (opts.amp || 0.16) / Math.max(1, freqs.length * 0.8),
        slide: opts.slide,
        attack: opts.attack,
        release: opts.release,
        filter: opts.filter,
        filterType: opts.filterType,
        q: opts.q,
        detune: (opts.spread || 0) * (index - (freqs.length - 1) / 2),
      });
    }
  }

  return { engine, init, resume, playTone, playNoise, playChord };
}
