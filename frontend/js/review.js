// Review tab: due cards one by one, per language.
// The learner types the answer (or skips), sees the solution, then rates how well they knew it:
// Again / Hard / Good / Easy. The rating goes to py-fsrs in the backend, which decides when the
// card comes back (Again = in a few minutes, Easy = in days).
import { api } from "./api.js";
import { playBase64 } from "./audio.js";
import { getLanguage, getLearnerId, refreshDueBadge } from "./app.js";
import { renderChips } from "./ui.js";
import { langName, onUiLanguageChange, t } from "./i18n.js";

const $ = (id) => document.getElementById(id);
let queue = [];
let current = null;
let language = null;


// ---- answer checking ----
const clean = (s) => (s || "").toLowerCase().replace(/[’`´]/g, "'")
  .replace(/[.,!?¿¡;:"«»()]/g, " ").replace(/\s+/g, " ").trim();
const noAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function check(answer, expected) {
  const a = clean(answer), e = clean(expected);
  if (!a) return "skipped";
  if (a === e) return "correct";
  if (noAccents(a) === noAccents(e)) return "accent";
  return "wrong";
}

// result -> [text key, colour class, suggested rating]
const FEEDBACK = {
  correct: ["fb_correct", "good", 3],
  accent: ["fb_accent", "hard", 2],
  wrong: ["fb_wrong", "again", 1],
  skipped: ["fb_skipped", "", 0],
  selfcheck: ["fb_selfcheck", "", 0],
};

// Show the gap as a visible blank line inside the sentence.
function renderFront(text) {
  const el = $("card-front");
  el.innerHTML = "";
  const parts = text.split("___");
  parts.forEach((part, i) => {
    el.append(document.createTextNode(part));
    if (i < parts.length - 1) {
      const blank = document.createElement("span");
      blank.className = "blank";
      el.append(blank);
    }
  });
}

// "You said: …" under the question, with the wrong words highlighted.
function renderContext(card) {
  const el = $("card-context");
  el.innerHTML = "";
  if (!card.you_said) return;
  const label = document.createElement("span");
  label.className = "context-label";
  label.textContent = t("you_said");
  const quote = document.createElement("span");
  quote.className = "context-quote";
  const text = card.you_said;
  const i = card.mistake ? text.toLowerCase().indexOf(card.mistake.toLowerCase()) : -1;
  if (i >= 0) {
    const mark = document.createElement("mark");
    mark.textContent = text.slice(i, i + card.mistake.length);
    quote.append(`“${text.slice(0, i)}`, mark, `${text.slice(i + card.mistake.length)}”`);
  } else {
    quote.textContent = `“${text}”`;
  }
  el.append(label, quote);
}

// Texts around the card that depend on the interface language
function renderLabels(card) {
  $("card-kind").textContent = `${langName(card.language)} · ${t(`kind_${card.kind}`)}`;
  $("answer-input").placeholder = t(`ph_${card.kind}`, { lang: langName(card.language, { inSentence: true }) });
  renderContext(card);
}

function showCard() {
  current = queue.shift() || null;
  $("review-empty").classList.toggle("hidden", !!current);
  $("review-card").classList.toggle("hidden", !current);
  if (!current) return;

  renderFront(current.front);
  renderLabels(current);
  $("card-back").textContent = current.back;
  $("card-explanation").textContent = current.explanation || "";
  $("card-sentence").textContent = current.kind === "cloze" ? current.front.replace("___", current.back) : "";
  $("answer-input").value = "";
  $("flashcard").classList.remove("flipped");
  $("ratings").classList.add("hidden");
  $("rating-help").classList.add("hidden");
  $("show-answer").classList.remove("hidden");
  document.querySelectorAll("#ratings button").forEach((b) => b.classList.remove("suggested"));
  setTimeout(() => $("answer-input").focus({ preventScroll: true }), 350);
}

function reveal(answer) {
  // Vocabulary answers are meanings in the learner's language: many are right, so the learner judges.
  let result = check(answer, current.back);
  if (current.kind === "vocab" && result === "wrong") result = "selfcheck";
  const [key, cls, rating] = FEEDBACK[result];
  const text = t(key);
  const fb = $("answer-feedback");
  fb.textContent = answer && result !== "correct" ? `${t("you_wrote", { answer })} ${text}` : text;
  fb.className = "feedback " + cls;
  document.querySelectorAll("#ratings button").forEach((b) =>
    b.classList.toggle("suggested", Number(b.dataset.rating) === rating));

  $("flashcard").classList.add("flipped");
  $("ratings").classList.remove("hidden");
  $("rating-help").classList.remove("hidden");
  $("show-answer").classList.add("hidden");
  $("answer-input").blur();
}

async function rate(rating) {
  if (!current || !$("flashcard").classList.contains("flipped")) return;
  const card = current;
  current = null;
  await api.answerCard(card.card_id, rating);
  refreshDueBadge();
  showCard();
}

// Opening the tab starts on the language being practised (if it has cards due); chips switch.
export async function loadReview(choice = null) {
  try {
    const all = await api.dueCards(getLearnerId());
    const langs = Object.keys(all.due_by_language || {});
    language = choice || (langs.includes(getLanguage()) || !langs.length ? getLanguage() : langs[0]);
    // One chip per language that has cards due, with how many.
    const items = langs.map((l) => ({ value: l, label: langName(l), badge: all.due_by_language[l] }));
    renderChips($("review-languages"), langs.length > 1 ? items : [], language, (v) => loadReview(v));
    queue = langs.length > 1 ? (await api.dueCards(getLearnerId(), language)).cards : all.cards;
  } catch (e) {
    console.error(e);
    queue = [];
  }
  showCard();
}

async function playCurrent() {
  if (!current) return;
  if (current.audio_b64 === undefined) {
    const { audio_b64 } = await api.cardAudio(current.card_id);
    current.audio_b64 = audio_b64;
  }
  playBase64(current.audio_b64);
}

export function initReview() {
  $("answer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    reveal($("answer-input").value.trim());
  });
  $("show-answer").onclick = () => reveal("");
  $("play-audio").onclick = playCurrent;
  document.querySelectorAll("#ratings button").forEach((b) => { b.onclick = () => rate(Number(b.dataset.rating)); });

  onUiLanguageChange(() => {
    if (current) renderLabels(current);
    if (!$("tab-review").classList.contains("hidden")) loadReview(language);
  });

  // Keys 1-4 rate the card once the answer is shown
  window.addEventListener("keydown", (e) => {
    if ($("tab-review").classList.contains("hidden") || e.target.tagName === "INPUT") return;
    if (["1", "2", "3", "4"].includes(e.key)) rate(Number(e.key));
  });
}
