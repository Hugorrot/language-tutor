// Mic recording, audio playback, and live audio levels for the orb. Owner: voice pipeline (with frontend).

let ctx = null;          // one shared AudioContext, created on the first user gesture
let analyser = null;     // what the orb is listening to right now (mic or tutor voice)
let freq = null;
let wave = null;
let recorder = null;
let micSource = null;
let chunks = [];
const BANDS = 24;

// Browsers only allow audio after a click/tap/key: call this from event handlers.
export async function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") {
    try { await ctx.resume(); } catch { /* stays suspended: we fall back to plain playback */ }
  }
  return ctx;
}

function watch(node) {
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;
  node.connect(analyser);
  freq = new Uint8Array(analyser.frequencyBinCount);
  wave = new Uint8Array(analyser.fftSize);
  return analyser;
}

// Current loudness (0..1) and BANDS frequency bands (0..1) for the voice range, or null.
export function readLevels() {
  if (!analyser) return null;
  analyser.getByteFrequencyData(freq);
  analyser.getByteTimeDomainData(wave);
  let sum = 0;
  for (let i = 0; i < wave.length; i++) {
    const v = (wave[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / wave.length);
  // Speech lives mostly in the lower ~45% of the bins at 256 FFT
  const usable = Math.floor(freq.length * 0.45);
  const bands = new Array(BANDS);
  for (let b = 0; b < BANDS; b++) {
    const from = Math.floor((b / BANDS) * usable);
    const to = Math.max(from + 1, Math.floor(((b + 1) / BANDS) * usable));
    let m = 0;
    for (let i = from; i < to; i++) m = Math.max(m, freq[i]);
    bands[b] = Math.pow(m / 255, 1.6);
  }
  return { level: Math.min(1, rms * 5), bands };
}

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recorder = new MediaRecorder(stream);
  chunks = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  recorder.start();
  if (await unlockAudio()) {
    micSource = ctx.createMediaStreamSource(stream);
    watch(micSource);          // analysed only, not played back (no echo)
  }
}

// Resolves with the recorded audio as a Blob.
export function stopRecording() {
  return new Promise((resolve) => {
    if (!recorder) return resolve(null);
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      recorder = null;
    };
    recorder.stop();
    if (micSource) { micSource.disconnect(); micSource = null; analyser = null; }
  });
}

let current = null;

// Play base64 MP3 from the backend. Resolves when playback ends.
export async function playBase64(b64) {
  if (!b64) return;
  if (current) current.pause();
  const audio = new Audio("data:audio/mpeg;base64," + b64);
  current = audio;
  const ac = await unlockAudio();
  let source = null;
  if (ac && ac.state === "running") {
    // Route through the analyser so the orb can follow the tutor's voice.
    source = ac.createMediaElementSource(audio);
    watch(source).connect(ac.destination);
  }
  await new Promise((resolve) => {
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.onpause = resolve;
    audio.play().catch(resolve);
  });
  if (source) {
    source.disconnect();
    if (current === audio) analyser = null;
  }
}

export function stopPlayback() {
  if (current) current.pause();
}
