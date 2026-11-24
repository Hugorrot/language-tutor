// Every call to the backend lives here. Matches API.md.
// USE_MOCK = true -> fake responses, so the UI works without the backend.

// Preview is explicit and isolated from the real learner profile.
export const USE_MOCK = new URLSearchParams(location.search).get("preview") === "1";

// Served by FastAPI -> same origin. Opened from VS Code Live Server (:5500) -> call the backend on :8000.
const API_BASE = location.port === "5500" ? "http://localhost:8000/api" : "/api";

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
    let detail = text;
    try { detail = JSON.parse(text).detail ?? text; } catch { /* not JSON */ }
    const err = new Error(res.status === 422 ? detail : `${method} ${path} failed (${res.status}): ${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  createLearner: (data) => request("POST", "/learner", data),
  getLearner: (id) => request("GET", `/learner/${id}`),
  listLearners: () => request("GET", "/learners"),
  updateLearner: (id, changes) => request("PATCH", `/learner/${id}`, changes),

  startSession: (learnerId, scenario, targetLanguage) =>
    request("POST", "/session/start", { learner_id: learnerId, scenario, target_language: targetLanguage }),

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

  dueCards: (learnerId, language) =>
    request("GET", `/review/due?learner_id=${learnerId}${language ? `&language=${encodeURIComponent(language)}` : ""}`),
  cardAudio: (cardId) => request("GET", `/cards/${cardId}/audio`),
  answerCard: (cardId, rating) => request("POST", "/review/answer", { card_id: cardId, rating }),

  progress: (learnerId, language) =>
    request("GET", `/progress?learner_id=${learnerId}${language ? `&language=${encodeURIComponent(language)}` : ""}`),
  mistakeOccurrences: (learnerId, conceptId) => request("GET", `/mistakes/${conceptId}?learner_id=${learnerId}`),
  searchMemory: (learnerId, q, language) =>
    request("GET", `/memory/search?learner_id=${learnerId}&q=${encodeURIComponent(q)}` +
                   (language ? `&language=${encodeURIComponent(language)}` : "")),
};

// ---------------- Mock responses ----------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mock(method, path, body) {
  await sleep(400);
  if (path === "/learner") return { learner_id: 1 };
  if (path === "/learners") return { learners: [{ learner_id: 1, name: "Test", languages: ["Italian"] }] };
  if (method === "PATCH" && path.startsWith("/learner/"))
    return { learner_id: 1, name: "Test", target_language: "Italian", explanation_language: "English",
             goal: "", level: "A2", languages: ["Italian"], supported_languages: ["Italian", "Spanish", "French", "English", "German", "Portuguese"],
             ...body };
  if (path.startsWith("/learner/"))
    return { learner_id: 1, name: "Test", target_language: "Italian", explanation_language: "English", goal: "", level: "A2",
             languages: ["Italian"], supported_languages: ["Italian", "Spanish", "French", "English", "German", "Portuguese"] };
  if (path === "/session/start")
    return { session_id: 1, tutor_text: "Ciao! Benvenuto al ristorante. Cosa vuoi ordinare?", audio_b64: null, targets: ["prenotare"],
             target_language: body?.target_language || "Italian", level: "A2" };
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
                       explanation: "Possessives take an article in Italian.", language: "Italian" }], due_count: 1,
             due_by_language: { Italian: 1 } };
  if (path === "/review/answer") return { next_due: new Date(Date.now() + 864e5).toISOString() };
  if (path.startsWith("/progress"))
    return { language: "Italian", languages: ["Italian"], sessions: 3, minutes_spoken: 24, level: "A2", cards_total: 18, cards_due: 4, review_accuracy: 0.75,
             top_errors: [{ rule: "Possessives take an article in Italian", count: 4, sessions: 3, fixed: false, concept_id: 1 }] };
  if (path.startsWith("/mistakes/"))
    return { concept_id: 1, count: 2, occurrences: [
      { original: "con mia amica", correction: "con la mia amica", rule: "Possessives take an article",
        you_said: "Sabato sono andato al cinema con mia amica", date: "2026-11-23 14:15:25" },
      { original: "mio libro", correction: "il mio libro", rule: "Use the article before possessives",
        you_said: "Mio libro è sul tavolo", date: "2026-11-20 10:02:11" }] };
  if (path.startsWith("/memory/search"))
    return { query: "amica", exact_count: 3,
             similar: [{ text: "Sono andato al cinema con mia amica Giulia", similarity: 0.71, session_id: 1 },
                       { text: "Il weekend ho visto una mia amica", similarity: 0.58, session_id: 2 }] };
  throw new Error("No mock for " + path);
}
