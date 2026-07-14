export function createAudioEngine() {
  let disposed = false;
  const activeVoices = new Set();
  const engine = {
    ctx: null,
    master: null,
    sfx: null,
    music: null,
    musicLayers: null,
    lastShot: 0,
  };

  function disconnect(node) {
    if (typeof node?.disconnect === "function") {
      node.disconnect();
    }
  }

  function stop(node) {
    if (typeof node?.stop !== "function") return;
    try {
      node.stop();
    } catch (error) {
      if (error?.name !== "InvalidStateError") throw error;
    }
  }

  function releaseVoice(voice) {
    if (!activeVoices.delete(voice)) return;
    for (const node of voice.nodes) {
      disconnect(node);
    }
  }

  function trackVoice(source, nodes) {
    const voice = { source, nodes };
    activeVoices.add(voice);
    source.addEventListener?.("ended", () => releaseVoice(voice), { once: true });
    return voice;
  }

  function setValue(param, value) {
    if (!param) return;
    if (typeof param.setValueAtTime === "function" && engine.ctx) {
      param.setValueAtTime(value, engine.ctx.currentTime);
    } else {
      param.value = value;
    }
  }

  function createMusicLayer(type, freq, filter, filterType = "lowpass") {
    const ctx = engine.ctx;
    const osc = ctx.createOscillator();
    const filterNode = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = type;
    setValue(osc.frequency, freq);
    filterNode.type = filterType;
    setValue(filterNode.frequency, filter);
    setValue(gain.gain, 0.0001);
    osc.connect(filterNode);
    filterNode.connect(gain);
    gain.connect(engine.music);
    osc.start(ctx.currentTime);
    return { osc, filter: filterNode, gain };
  }

  function initMusic() {
    if (!engine.ctx || engine.musicLayers) return;
    engine.music = engine.ctx.createGain();
    engine.music.gain.value = 0.7;
    engine.music.connect(engine.master);
    engine.musicLayers = {
      padRoot: createMusicLayer("triangle", 164.81, 680),
      padThird: createMusicLayer("sine", 206.01, 920),
      padFifth: createMusicLayer("triangle", 247.22, 820),
      pulse: createMusicLayer("square", 329.63, 1200, "bandpass"),
      danger: createMusicLayer("sawtooth", 523.25, 1800, "highpass"),
      loop: createMusicLayer("sine", 392, 1500),
    };
  }

  function init() {
    if (engine.ctx || disposed) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    engine.ctx = new AudioContext();
    engine.master = engine.ctx.createGain();
    engine.master.gain.value = 0.35;
    engine.master.connect(engine.ctx.destination);
    engine.sfx = engine.ctx.createGain();
    engine.sfx.gain.value = 0.9;
    engine.sfx.connect(engine.master);
    initMusic();
  }

  function resume() {
    if (!disposed && engine.ctx && engine.ctx.state === "suspended") {
      engine.ctx.resume();
    }
  }

  function playTone(type, freq, duration, opts = {}) {
    if (!engine.ctx || disposed) return;
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
    let filter = null;
    if (opts.filter) {
      filter = ctx.createBiquadFilter();
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
    trackVoice(osc, [osc, filter, gain].filter(Boolean));
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playNoise(duration, opts = {}) {
    if (!engine.ctx || disposed) return;
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
    let filter = null;
    if (opts.filter) {
      filter = ctx.createBiquadFilter();
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
    trackVoice(source, [source, filter, gain].filter(Boolean));
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

  function updateMusic(state, player) {
    if (!engine.ctx || !engine.musicLayers || disposed) return;
    const active = state.started && !state.showcase && !state.over ? 1 : 0;
    const rootTable = [164.81, 196.0, 146.83];
    const stageRoot = rootTable[Math.min(rootTable.length - 1, state.stageIndex)] || rootTable[0];
    const root = stageRoot * (state.loopIndex > 0 ? 1.06 : 1);
    const third = root * 1.25;
    const fifth = root * 1.5;
    const bossWeight = state.boss ? 1 : 0;
    const lowHpWeight = player.hp <= 2 ? 1 : player.hp === 3 ? 0.45 : 0;
    const loopWeight = state.loopIndex > 0 ? 1 : 0;
    const pulseWave = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(state.time * (state.boss ? 5.4 : 2.7)));
    const dangerWave = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * 8.2));

    setValue(engine.musicLayers.padRoot.osc.frequency, root);
    setValue(engine.musicLayers.padThird.osc.frequency, third);
    setValue(engine.musicLayers.padFifth.osc.frequency, fifth);
    setValue(engine.musicLayers.pulse.osc.frequency, root * (state.boss ? 2.4 : 1.8));
    setValue(engine.musicLayers.danger.osc.frequency, root * 3.2);
    setValue(engine.musicLayers.loop.osc.frequency, root * 2.1);

    setValue(engine.musicLayers.padRoot.gain.gain, active * 0.022);
    setValue(engine.musicLayers.padThird.gain.gain, active * 0.018);
    setValue(engine.musicLayers.padFifth.gain.gain, active * 0.014);
    setValue(engine.musicLayers.pulse.gain.gain, active * (0.012 + bossWeight * 0.055 * pulseWave));
    setValue(engine.musicLayers.danger.gain.gain, active * lowHpWeight * 0.05 * dangerWave);
    setValue(engine.musicLayers.loop.gain.gain, active * loopWeight * 0.03 * (0.4 + 0.6 * pulseWave));
    setValue(engine.music.gain, active ? 0.7 : 0.0001);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;

    for (const voice of [...activeVoices]) {
      stop(voice.source);
      releaseVoice(voice);
    }

    if (engine.musicLayers) {
      for (const layer of Object.values(engine.musicLayers)) {
        stop(layer.osc);
        disconnect(layer.osc);
        disconnect(layer.filter);
        disconnect(layer.gain);
      }
    }

    disconnect(engine.music);
    disconnect(engine.sfx);
    disconnect(engine.master);

    const ctx = engine.ctx;
    engine.musicLayers = null;
    engine.music = null;
    engine.sfx = null;
    engine.master = null;
    engine.ctx = null;

    if (ctx && ctx.state !== "closed" && typeof ctx.close === "function") {
      return ctx.close();
    }
  }

  return { engine, init, resume, playTone, playNoise, playChord, updateMusic, dispose };
}
