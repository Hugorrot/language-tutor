// Every call to the backend lives here. Matches API.md.
// USE_MOCK = true -> fake responses, so the UI works without the backend.

export const USE_MOCK = false;

// Served by FastAPI on :8000 -> same origin. Opened from another dev server -> call :8000.
const API_BASE = location.port === "8000" ? "/api" : "http://localhost:8000/api";

async function request(method, path, body, isForm = false) {
  if (USE_MOCK) return mock(method, path, body);
  const options = { method };
  if (body !== undefined) {
    options.body = isForm ? body : JSON.stringify(body);
    if (!isForm) options.headers = { "Content-Type": "application/json" };
  }
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export const api = {
  createLearner: (data) => request("POST", "/learner", data),
  getLearner: (id) => request("GET", `/learner/${id}`),

  startSession: (learnerId, scenario) =>
    request("POST", "/session/start", { learner_id: learnerId, scenario }),

  // Pass either an audio Blob or a text string.
  sendTurn: (sessionId, { audioBlob, text }) => {
    const form = new FormData();
    form.append("session_id", sessionId);
    if (audioBlob) form.append("audio", audioBlob, "speech.webm");
    if (text) form.append("text", text);
    return request("POST", "/session/turn", form, true);
  },

  endSession: (sessionId) => request("POST", "/session/end", { session_id: sessionId }),
  deleteCard: (cardId) => request("DELETE", `/cards/${cardId}`),

  dueCards: (learnerId) => request("GET", `/review/due?learner_id=${learnerId}`),
  cardAudio: (cardId) => request("GET", `/cards/${cardId}/audio`),
  answerCard: (cardId, rating) => request("POST", "/review/answer", { card_id: cardId, rating }),

  progress: (learnerId) => request("GET", `/progress?learner_id=${learnerId}`),
};

// ---------------- Mock responses ----------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mock(method, path) {
  await sleep(400);
  if (path === "/learner") return { learner_id: 1 };
  if (path.startsWith("/learner/"))
    return { learner_id: 1, name: "Test", target_language: "Italian", explanation_language: "English", goal: "", level: "A2" };
  if (path === "/session/start")
    return { session_id: 1, tutor_text: "Ciao! Benvenuto al ristorante. Cosa vuoi ordinare?", audio_b64: null, targets: ["prenotare"] };
  if (path === "/session/turn")
    return { user_text: "Io voglio una pizza margherita", tutor_text: "Ottimo, vuoi una pizza margherita! E da bere?",
             audio_b64: null, timings_ms: { asr: 300, llm: 500, tts: 300, total: 1100 } };
  if (path === "/session/end")
    return {
      summary: "You ordered food confidently. Next time, focus on possessives with articles.",
      errors: [{ type: "grammar", original: "con mia amica", correction: "con la mia amica",
                 rule: "Possessives take an article in Italian", target_word: "amica" }],
      cards: [{ card_id: 1, kind: "cloze", front: "Sono andato al cinema con ___ mia amica.", back: "la",
                explanation: "Possessives take an article in Italian." }],
    };
  if (path.startsWith("/cards/") && path.endsWith("/audio")) return { audio_b64: null };
  if (path.startsWith("/cards/")) return { ok: true };
  if (path.startsWith("/review/due"))
    return { cards: [{ card_id: 1, kind: "cloze", front: "Sono andato al cinema con ___ mia amica.", back: "la",
                       explanation: "Possessives take an article in Italian." }], due_count: 1 };
  if (path === "/review/answer") return { next_due: new Date(Date.now() + 864e5).toISOString() };
  if (path.startsWith("/progress"))
    return { sessions: 3, minutes_spoken: 24, level: "A2", cards_total: 18, cards_due: 4, review_accuracy: 0.75,
             top_errors: [{ rule: "Possessives take an article in Italian", count: 4, fixed: false }] };
  throw new Error("No mock for " + path);
}
