// Profile tab: edit your profile (name, goal, explanation language), switch to another profile
// on this computer, or create a new one. There are no passwords: the app runs locally and a profile
// only keeps one person's conversations, mistakes and cards apart from another's.
import { api } from "./api.js";
import { getExplanationLanguage, getLearner, getLearnerId, showOnboarding, switchProfile, updateProfile } from "./app.js";
import { langName, LANGUAGES, onUiLanguageChange, t } from "./i18n.js";
import { notify } from "./preferences.js";
import { renderChips } from "./ui.js";

const $ = (id) => document.getElementById(id);
let explanation = null;       // chosen in the form, saved with the Save button

function renderExplanationPicker() {
  renderChips($("profile-explanation"), LANGUAGES.map((l) => ({ value: l, label: langName(l) })),
    explanation, (v) => { explanation = v; });
}

function renderLanguages(learner) {
  const langs = learner?.languages || [];
  $("profile-languages").textContent = langs.length ? langs.map((l) => langName(l)).join(", ") : t("none_yet");
}

async function renderProfileList() {
  const list = $("profile-list");
  let learners = [];
  try {
    ({ learners } = await api.listLearners());
  } catch (e) {
    list.innerHTML = "";
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = t("err_prefix") + e.message;
    list.appendChild(li);
    return;
  }
  list.innerHTML = "";
  for (const l of learners) {
    const li = document.createElement("li");
    li.className = "profile-item";
    const who = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = l.name;
    const langs = document.createElement("span");
    langs.className = "muted";
    langs.textContent = l.languages.map((x) => langName(x)).join(", ");
    who.append(name, langs);
    li.appendChild(who);
    if (l.learner_id === getLearnerId()) {
      const tag = document.createElement("span");
      tag.className = "chip fixed";
      tag.textContent = t("current_profile");
      li.appendChild(tag);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost small";
      btn.textContent = t("switch_to");
      btn.onclick = () => switchProfile(l.learner_id);
      li.appendChild(btn);
    }
    list.appendChild(li);
  }
}

export function loadProfile() {
  const learner = getLearner();
  const form = $("profile-form");
  form.elements.name.value = learner?.name || "";
  form.elements.goal.value = learner?.goal || "";
  explanation = getExplanationLanguage();
  renderExplanationPicker();
  renderLanguages(learner);
  renderProfileList();
}

async function save(e) {
  e.preventDefault();
  const form = $("profile-form");
  const learner = getLearner();
  const changes = {};
  const name = form.elements.name.value.trim();
  const goal = form.elements.goal.value.trim();
  if (name !== learner?.name) changes.name = name;
  if (goal !== (learner?.goal || "")) changes.goal = goal;
  if (explanation !== getExplanationLanguage()) changes.explanation_language = explanation;
  if (!Object.keys(changes).length) { notify(t("t_profile_saved")); return; }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = t("saving");
  try {
    await updateProfile(changes);
    notify(t("t_profile_saved"), changes.explanation_language
      ? t("expl_changed", { lang: langName(explanation, { inSentence: true }) }) : "");
    renderProfileList();
  } catch (err) {
    notify(t("t_profile_fail"), err.message, "failed");
  } finally {
    button.disabled = false;
    button.textContent = t("save");
  }
}

export function initProfile() {
  $("profile-form").addEventListener("submit", save);
  $("new-profile").onclick = () => showOnboarding(true);
  onUiLanguageChange(() => {
    if ($("tab-profile").classList.contains("hidden")) return;
    renderExplanationPicker();
    renderLanguages(getLearner());
    renderProfileList();
  });
}
