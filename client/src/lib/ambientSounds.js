let audioContext = null;
const activeSounds = {};

function getContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function createNoiseBuffer(ctx, seconds = 2) {
  const bufferSize = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function startRain(ctx, gainNode) {
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 4);
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  filter.Q.value = 0.6;

  const highShelf = ctx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 3500;
  highShelf.gain.value = 4;

  noise.connect(filter);
  filter.connect(highShelf);
  highShelf.connect(gainNode);
  noise.start();

  return { stop: () => noise.stop() };
}

function startFire(ctx, gainNode) {
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 4);
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  filter.Q.value = 0.4;

  const crackleGain = ctx.createGain();
  crackleGain.gain.value = 1;

  noise.connect(filter);
  filter.connect(crackleGain);
  crackleGain.connect(gainNode);
  noise.start();

  const crackleBuffer = createNoiseBuffer(ctx, 0.3);
  let crackleTimeout;
  function scheduleCrackle() {
    const delay = 150 + Math.random() * 500;
    crackleTimeout = setTimeout(() => {
      const pop = ctx.createBufferSource();
      pop.buffer = crackleBuffer;

      const popFilter = ctx.createBiquadFilter();
      popFilter.type = 'bandpass';
      popFilter.frequency.value = 900 + Math.random() * 1800;
      popFilter.Q.value = 3 + Math.random() * 4;

      const popGain = ctx.createGain();
      const peak = 0.5 + Math.random() * 0.4;
      popGain.gain.setValueAtTime(0, ctx.currentTime);
      popGain.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.003);
      popGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04 + Math.random() * 0.03);

      pop.connect(popFilter);
      popFilter.connect(popGain);
      popGain.connect(gainNode);
      pop.start();
      pop.stop(ctx.currentTime + 0.1);
      scheduleCrackle();
    }, delay);
  }
  scheduleCrackle();

  return {
    stop: () => {
      clearTimeout(crackleTimeout);
      noise.stop();
    },
  };
}

function startTypewriter(ctx, gainNode) {
  let running = true;
  let timeout;

  function playClick() {
    if (!running) return;
    const osc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1800 + Math.random() * 400;
    clickGain.gain.setValueAtTime(0.08, ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
    osc.connect(clickGain);
    clickGain.connect(gainNode);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);

    const nextDelay = Math.random() < 0.08
      ? 500 + Math.random() * 400
      : 90 + Math.random() * 180;
    timeout = setTimeout(playClick, nextDelay);
  }
  playClick();

  return {
    stop: () => {
      running = false;
      clearTimeout(timeout);
    },
  };
}

const CHORD_PROGRESSION = [
  [261.63, 329.63, 392.00, 493.88],
  [220.00, 277.18, 329.63, 415.30],
  [174.61, 220.00, 261.63, 329.63],
  [196.00, 246.94, 293.66, 369.99],
];

function createReverbImpulse(ctx, seconds = 2.5, decay = 3) {
  const length = ctx.sampleRate * seconds;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function playChordNote(ctx, dryDestination, wetDestination, frequency, startTime, duration) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'sine';
  osc2.type = 'triangle';
  osc1.frequency.value = frequency;
  osc2.frequency.value = frequency * 2;

  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0, startTime);
  noteGain.gain.linearRampToValueAtTime(0.14, startTime + 1.2);
  noteGain.gain.linearRampToValueAtTime(0.1, startTime + duration * 0.6);
  noteGain.gain.linearRampToValueAtTime(0, startTime + duration);

  const osc2Gain = ctx.createGain();
  osc2Gain.gain.value = 0.15;

  osc1.connect(noteGain);
  osc2.connect(osc2Gain);
  osc2Gain.connect(noteGain);
  noteGain.connect(dryDestination);
  noteGain.connect(wetDestination);

  osc1.start(startTime);
  osc2.start(startTime);
  osc1.stop(startTime + duration + 0.1);
  osc2.stop(startTime + duration + 0.1);
}

function startInstrumental(ctx, gainNode) {
  const convolver = ctx.createConvolver();
  convolver.buffer = createReverbImpulse(ctx);

  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.5;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.5;

  dryGain.connect(gainNode);
  convolver.connect(wetGain);
  wetGain.connect(gainNode);

  let running = true;
  let chordIndex = 0;
  let timeoutId;

  function scheduleNextChord() {
    if (!running) return;
    const chord = CHORD_PROGRESSION[chordIndex % CHORD_PROGRESSION.length];
    const chordDuration = 7.5;
    const startTime = ctx.currentTime + 0.05;

    chord.forEach((freq, i) => {
      const humanizedStart = startTime + i * 0.06;
      playChordNote(ctx, dryGain, convolver, freq, humanizedStart, chordDuration);
    });

    chordIndex += 1;
    timeoutId = setTimeout(scheduleNextChord, chordDuration * 1000 * 0.85);
  }

  scheduleNextChord();

  return {
    stop: () => {
      running = false;
      clearTimeout(timeoutId);
    },
  };
}

const STARTERS = {
  chuva: startRain,
  lareira: startFire,
  maquina_escrever: startTypewriter,
  instrumental: startInstrumental,
};

export function toggleSound(key, on, volume = 0.5) {
  const ctx = getContext();

  if (!on) {
    if (activeSounds[key]) {
      activeSounds[key].node.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      const toStop = activeSounds[key];
      setTimeout(() => toStop.source.stop(), 500);
      delete activeSounds[key];
    }
    return;
  }

  if (activeSounds[key]) {
    activeSounds[key].node.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
    return;
  }

  const gainNode = ctx.createGain();
  gainNode.gain.value = 0;
  gainNode.connect(ctx.destination);
  gainNode.gain.setTargetAtTime(volume, ctx.currentTime, 0.4);

  const source = STARTERS[key](ctx, gainNode);
  activeSounds[key] = { node: gainNode, source };
}

export function setVolume(key, volume) {
  if (activeSounds[key]) {
    activeSounds[key].node.gain.setTargetAtTime(volume, getContext().currentTime, 0.1);
  }
}

export function stopAll() {
  Object.keys(activeSounds).forEach((key) => toggleSound(key, false));
}
