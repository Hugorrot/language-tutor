// Entry point: onboarding + tab switching. Each tab lives in its own file.
import { api } from "./api.js";
import { initTalk } from "./talk.js";
import { initReview, loadReview } from "./review.js";
import { loadProgress } from "./progress.js";

const $ = (id) => document.getElementById(id);

export function getLearnerId() {
  return Number(localStorage.getItem("learner_id")) || null;
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

function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  ["talk", "review", "progress"].forEach((t) => $(`tab-${t}`).classList.toggle("hidden", t !== name));
  if (name === "review") loadReview();
  if (name === "progress") loadProgress();
}

function initOnboarding() {
  const needsOnboarding = !getLearnerId();
  $("onboarding").classList.toggle("hidden", !needsOnboarding);
  document.querySelector("main").classList.toggle("hidden", needsOnboarding);

  $("onboarding-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const { learner_id } = await api.createLearner(data);
    localStorage.setItem("learner_id", learner_id);
    $("onboarding").classList.add("hidden");
    document.querySelector("main").classList.remove("hidden");
  });
}

document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
initOnboarding();
initTalk();
initReview();
refreshDueBadge();
