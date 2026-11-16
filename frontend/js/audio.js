// Mic recording and audio playback. Owner: voice pipeline (with frontend).

let recorder = null;
let chunks = [];

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recorder = new MediaRecorder(stream);
  chunks = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  recorder.start();
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
  });
}

let current = null;

// Play base64 MP3 from the backend. Resolves when playback ends.
export function playBase64(b64) {
  if (!b64) return Promise.resolve();
  if (current) current.pause();
  current = new Audio("data:audio/mpeg;base64," + b64);
  return new Promise((resolve) => {
    current.onended = resolve;
    current.onerror = resolve;
    current.play().catch(resolve);
  });
}
