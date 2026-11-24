// Entry point: onboarding + tab switching. Each tab lives in its own file.
import { api, USE_MOCK } from "./api.js";
import { initTalk, renderLanguagePicker } from "./talk.js";
import { initReview, loadReview } from "./review.js";
import { loadProgress } from "./progress.js";

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

export async function loadLearner() {
  const id = getLearnerId();
  if (!id) return null;
  try {
    learner = await api.getLearner(id);
  } catch (e) {
    // The database was reset: start again with onboarding.
    if (String(e.message).includes("(404)")) storage.removeItem(learnerKey);
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
    window.dispatchEvent(new CustomEvent("tutor:due", { detail: due_count }));
    badge.classList.toggle("hidden", due_count === 0);
  } catch (e) { console.warn(e); }
}

const TABS = ["talk", "review", "progress"];

function showTab(name) {
  window.scrollTo({ top: 0, behavior: "instant" });
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  TABS.forEach((t) => $(`tab-${t}`).classList.toggle("hidden", t !== name));
  window.dispatchEvent(new CustomEvent("tutor:view", { detail: name }));
  if (!getLearnerId()) return;
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

  $("onboarding-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const { learner_id } = await api.createLearner(data);
    storage.setItem(learnerKey, learner_id);
    await loadLearner();
    renderLanguagePicker();
    $("onboarding").classList.add("hidden");
    document.querySelector("main").classList.remove("hidden");
    document.body.classList.remove("onboarding-mode");
    location.hash = "#talk";
    route();
    refreshDueBadge();
  });
}

async function boot() {
  await loadLearner();
  initOnboarding();
  initTalk();
  initReview();
  window.addEventListener("hashchange", route);
  route();
  refreshDueBadge();
}

boot();
