// Home tab: the start page. "Welcome back, Matteo." with three shortcuts: talk in the language being
// learned, the cards due, and the mistake to work on (the most frequent one not fixed yet).
import { api } from "./api.js";
import { getLanguage, getLearner, getLearnerId, isNewProfile } from "./app.js";
import { getLocale, langName, onUiLanguageChange, t } from "./i18n.js";

const $ = (id) => document.getElementById(id);

function renderGreeting() {
  const title = $("home-title");
  // Right after creating the profile it is a first welcome, afterwards a welcome back.
  title.dataset.splitText = isNewProfile() ? "home_welcome" : "home_welcome_back";
  title.dataset.splitVars = JSON.stringify({ name: getLearner()?.name || "" });
  window.dispatchEvent(new CustomEvent("tutor:heading", { detail: title }));   // redraws the animated heading
  $("home-date").textContent = new Date().toLocaleDateString(getLocale(),
    { weekday: "long", day: "numeric", month: "long" });
}

export async function loadHome() {
  renderGreeting();
  const language = getLanguage();
  const lang = langName(language, { inSentence: true });
  $("home-talk").textContent = t("home_talk", { lang });
  try {
    const [p, due] = await Promise.all([api.progress(getLearnerId(), language), api.dueCards(getLearnerId())]);
    $("home-sub").textContent = t("home_learning", { lang, level: p.level });
    const n = due.due_count;
    $("home-review").textContent = n ? t(n === 1 ? "home_due_one" : "home_due_other", { n }) : t("home_due_none");
    const focus = p.top_errors.find((e) => !e.fixed);
    $("home-focus").textContent = focus ? focus.rule : t("home_focus_none");
    // "3×", or "3× · 2 sessions" when it came back in more than one session (as in Progress)
    $("home-focus-meta").textContent = !focus ? "" : focus.sessions > 1
      ? t("home_times", { n: focus.count, s: t("in_sessions", { n: focus.sessions }) }) : `${focus.count}×`;
  } catch (e) {
    $("home-sub").textContent = t("err_prefix") + e.message;
  }
}

onUiLanguageChange(() => {
  if (!$("tab-home").classList.contains("hidden") && getLearnerId()) loadHome();
});
