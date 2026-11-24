import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = new EventTarget();
const saved = new Map();
globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
let stopCount = 0;
const stream = { getTracks: () => [{ stop: () => stopCount++ }] };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => stream } } });
class Recorder {
  constructor(source) { this.stream = source; this.mimeType = 'audio/webm'; }
  start() {}
  stop() { queueMicrotask(() => { this.ondataavailable({ data: new Blob(['recorded speech']) }); this.onstop(); }); }
}
globalThis.MediaRecorder = Recorder;
class Playback {
  constructor() { Playback.last = this; }
  play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); }
  pause() { this.onpause?.(); }
}
globalThis.Audio = Playback;
const audio = await import('../js/audio.js');
const { setAudioPreferences } = await import('../js/preferences.js');

test('recording returns audio and closes every microphone track', async () => {
  await audio.startRecording();
  const clip = await audio.stopRecording();
  assert.equal(await clip.text(), 'recorded speech');
  assert.equal(clip.type, 'audio/webm');
  assert.equal(stopCount, 1);
  assert.equal(await audio.stopRecording(), null);
});
test('recorder initialization failure releases the granted microphone', async () => {
  globalThis.MediaRecorder = class { constructor() { throw new Error('unsupported format'); } };
  await assert.rejects(audio.startRecording(), /unsupported format/);
  assert.equal(stopCount, 2);
  assert.equal(await audio.stopRecording(), null);
  globalThis.MediaRecorder = Recorder;
});
test('denied microphone access leaves no recorder', async () => {
  navigator.mediaDevices.getUserMedia = async () => { throw new Error('permission denied'); };
  await assert.rejects(audio.startRecording(), /permission denied/);
  assert.equal(await audio.stopRecording(), null);
});
test('playback uses the slider rate and responds to subsequent preference changes', async () => {
  setAudioPreferences({ playbackRate: 0.8 });
  await audio.playBase64('test');
  assert.equal(Playback.last.playbackRate, 0.8);
  setAudioPreferences({ playbackRate: 1.15 });
  assert.equal(Playback.last.playbackRate, 1.15);
});
