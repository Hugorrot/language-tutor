// Entry point: profiles, onboarding, interface language and tab switching. Each tab lives in its own file.
import { api, USE_MOCK } from "./api.js";
import { goHome, initTalk, renderLanguagePicker } from "./talk.js";
import { initReview, loadReview } from "./review.js";
import { loadProgress } from "./progress.js";
import { initProfile, loadProfile } from "./profile.js";
import { browserLanguage, getUiLanguage, langName, LANGUAGES, onUiLanguageChange, setUiLanguage, t } from "./i18n.js";
import { renderChips } from "./ui.js";
import { notify } from "./preferences.js";

const storage = USE_MOCK ? sessionStorage : localStorage;
const learnerKey = USE_MOCK ? "preview_learner_id" : "learner_id";
if (USE_MOCK) document.getElementById("preview-notice").classList.remove("hidden");
const $ = (id) => document.getElementById(id);

export function getLearnerId() {
  return Number(storage.getItem(learnerKey)) || null;
}

// The learner's profile, loaded once. target_language = the language they practise right now
// (chosen at the start of each session, remembered by the backend).
let learner = null;
export const getLearner = () => learner;
export const getLanguage = () => learner?.target_language || "Italian";
export function setLanguage(language) { if (learner) learner.target_language = language; }
export const getExplanationLanguage = () => learner?.explanation_language || "English";

// Change profile fields (name, goal, explanation_language). The whole interface follows the explanation language.
export async function updateProfile(changes) {
  learner = { ...learner, ...(await api.updateLearner(getLearnerId(), changes)) };
  if (changes.explanation_language) setUiLanguage(learner.explanation_language);
  return learner;
}
export const setExplanationLanguage = (language) => updateProfile({ explanation_language: language });

export async function loadLearner() {
  const id = getLearnerId();
  if (!id) return null;
  try {
    learner = await api.getLearner(id);
  } catch (e) {
    // The database was reset: start again with onboarding.
    if (e.status === 404) storage.removeItem(learnerKey);
    learner = null;
  }
  return learner;
}

// Use another profile: everything (cards, progress, interface language) follows it.
export async function switchProfile(learnerId) {
  if (!(await goHome())) return false;          // a conversation is open and the learner chose to stay
  storage.setItem(learnerKey, learnerId);
  await loadLearner();
  setUiLanguage(getExplanationLanguage());
  renderLanguagePicker();
  refreshDueBadge();
  notify(t("t_switched"), t("t_switched_d", { name: learner?.name || "" }));
  location.hash = "#talk";
  return true;
}

export async function refreshDueBadge() {
  const id = getLearnerId();
  if (!id) return;
  try {
    const { due_count } = await api.dueCards(id);
    const badge = $("due-badge");
    badge.textContent = due_count;
    window.dispatchEvent(new CustomEvent("tutor:due", { detail: due_count }));
    badge.classList.toggle("hidden", due_count === 0);
  } catch (e) { console.warn(e); }
}

const TABS = ["talk", "review", "progress", "profile"];

function showTab(name) {
  window.scrollTo({ top: 0, behavior: "instant" });
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  TABS.forEach((t) => $(`tab-${t}`).classList.toggle("hidden", t !== name));
  window.dispatchEvent(new CustomEvent("tutor:view", { detail: name }));
  if (!getLearnerId()) return;
  if (name === "review") loadReview();
  if (name === "progress") loadProgress();
  if (name === "profile") loadProfile();
}

// Each tab has its own address (#talk, #review, #progress, #profile). Clicking a tab is a normal link,
// so the browser keeps the history and the back/forward buttons work.
function route() {
  const name = location.hash.slice(1);
  if (!TABS.includes(name)) {
    history.replaceState(null, "", "#talk");
    return showTab("talk");
  }
  showTab(name);
}

// ---------------- Onboarding (first profile, or a new one) ----------------

let onboardingChoices = { target_language: "Italian", explanation_language: "English" };

function renderOnboardingChoices() {
  const form = $("onboarding-form");
  const items = LANGUAGES.map((l) => ({ value: l, label: langName(l) }));
  renderChips($("onboarding-target"), items, onboardingChoices.target_language, (v) => {
    onboardingChoices.target_language = v;
    form.elements.target_language.value = v;
  });
  renderChips($("onboarding-explanation"), items, onboardingChoices.explanation_language, (v) => {
    onboardingChoices.explanation_language = v;
    form.elements.explanation_language.value = v;
    setUiLanguage(v);            // the interface follows the choice right away
  });
  form.elements.target_language.value = onboardingChoices.target_language;
  form.elements.explanation_language.value = onboardingChoices.explanation_language;
}

// asNewProfile: opened from the Profile tab while another profile exists (can be cancelled).
export function showOnboarding(asNewProfile = false) {
  onboardingChoices = { target_language: "Italian", explanation_language: getUiLanguage() };
  $("onboarding-form").reset();
  renderOnboardingChoices();
  $("onboarding-eyebrow").classList.toggle("hidden", !asNewProfile);
  $("onboarding-cancel").classList.toggle("hidden", !asNewProfile);
  $("onboarding").classList.remove("hidden");
  document.querySelector("main").classList.add("hidden");
  document.body.classList.add("onboarding-mode");
  window.dispatchEvent(new CustomEvent("tutor:view", { detail: "onboarding" }));
}

function hideOnboarding() {
  $("onboarding").classList.add("hidden");
  document.querySelector("main").classList.remove("hidden");
  document.body.classList.remove("onboarding-mode");
}

function initOnboarding() {
  if (!getLearnerId()) showOnboarding(false);
  else hideOnboarding();

  $("onboarding-cancel").onclick = () => {
    hideOnboarding();
    setUiLanguage(getExplanationLanguage());     // undo a language picked in the form
    route();
  };

  $("onboarding-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const switching = !!getLearnerId();
    if (switching && !(await goHome())) return;
    const { learner_id } = await api.createLearner(data);
    storage.setItem(learnerKey, learner_id);
    await loadLearner();
    setUiLanguage(getExplanationLanguage());
    renderLanguagePicker();
    hideOnboarding();
    if (location.hash === "#talk") route(); else location.hash = "#talk";
    refreshDueBadge();
  });

  onUiLanguageChange(() => { if (!$("onboarding").classList.contains("hidden")) renderOnboardingChoices(); });
}

async function boot() {
  await loadLearner();
  // Before a profile exists the interface uses the browser's language
  setUiLanguage(learner?.explanation_language || browserLanguage());
  initOnboarding();
  initTalk();
  initReview();
  initProfile();
  window.addEventListener("hashchange", route);
  // Home (in the dock): back to the start screen from any tab or view
  window.addEventListener("tutor:home", async () => {
    if (!getLearnerId()) return;
    if ((await goHome()) && location.hash !== "#talk") location.hash = "#talk";
  });
  route();
  refreshDueBadge();
}

boot();
