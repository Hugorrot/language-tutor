// Entry point: onboarding + tab switching. Each tab lives in its own file.
import { api } from "./api.js";
import { goHome, initTalk, renderLanguagePicker } from "./talk.js";
import { initReview, loadReview } from "./review.js";
import { loadProgress } from "./progress.js";
import { applyStatic, browserLanguage, getUiLanguage, setUiLanguage } from "./i18n.js";

const $ = (id) => document.getElementById(id);

export function getLearnerId() {
  return Number(localStorage.getItem("learner_id")) || null;
}

// The learner's profile, loaded once. target_language = the language they practise right now
// (chosen at the start of each session, remembered by the backend).
let learner = null;
export const getLearner = () => learner;
export const getLanguage = () => learner?.target_language || "Italian";
export function setLanguage(language) { if (learner) learner.target_language = language; }
export const getExplanationLanguage = () => learner?.explanation_language || "English";

// The whole interface follows the explanation language.
export async function setExplanationLanguage(language) {
  learner = { ...learner, ...(await api.updateLearner(getLearnerId(), { explanation_language: language })) };
  setUiLanguage(language);
}

export async function loadLearner() {
  const id = getLearnerId();
  if (!id) return null;
  try {
    learner = await api.getLearner(id);
  } catch (e) {
    // The database was reset: start again with onboarding.
    if (e.status === 404) localStorage.removeItem("learner_id");
    learner = null;
  }
  return learner;
}

export async function refreshDueBadge() {
  const id = getLearnerId();
  if (!id) return;
  try {
    const { due_count } = await api.dueCards(id);
    const badge = $("due-badge");
    badge.textContent = due_count;
    badge.classList.toggle("hidden", due_count === 0);
  } catch (e) { console.warn(e); }
}

const TABS = ["talk", "review", "progress"];

function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  TABS.forEach((t) => $(`tab-${t}`).classList.toggle("hidden", t !== name));
  if (name === "review") loadReview();
  if (name === "progress") loadProgress();
}

// Each tab has its own address (#talk, #review, #progress). Clicking a tab is a normal link,
// so the browser keeps the history and the back/forward buttons work.
function route() {
  const name = location.hash.slice(1);
  if (!TABS.includes(name)) {
    history.replaceState(null, "", "#talk");
    return showTab("talk");
  }
  showTab(name);
}

function initOnboarding() {
  const needsOnboarding = !getLearnerId();
  $("onboarding").classList.toggle("hidden", !needsOnboarding);
  document.querySelector("main").classList.toggle("hidden", needsOnboarding);
  document.body.classList.toggle("onboarding-mode", needsOnboarding);

  // Before a profile exists the interface uses the browser's language, and follows the
  // "Explanations in" choice as soon as it changes.
  const expl = $("onboarding-explanation");
  expl.value = getUiLanguage();
  expl.addEventListener("change", () => setUiLanguage(expl.value));

  $("onboarding-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const { learner_id } = await api.createLearner(data);
    localStorage.setItem("learner_id", learner_id);
    await loadLearner();
    renderLanguagePicker();
    $("onboarding").classList.add("hidden");
    document.querySelector("main").classList.remove("hidden");
    document.body.classList.remove("onboarding-mode");
    location.hash = "#talk";
  });
}

async function boot() {
  applyStatic();
  await loadLearner();
  setUiLanguage(learner?.explanation_language || browserLanguage());
  initOnboarding();
  initTalk();
  initReview();
  window.addEventListener("hashchange", route);
  // "Voice Tutor" (top left) always goes back to the start screen, from any tab or view
  document.querySelector(".brand").addEventListener("click", async (e) => {
    e.preventDefault();
    if (getLearnerId() && (await goHome()) && location.hash !== "#talk") location.hash = "#talk";
  });
  route();
  refreshDueBadge();
}

boot();
