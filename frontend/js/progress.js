// Progress tab: one page per language (level, sessions, cards, most frequent mistakes).
// Each mistake opens to show every sentence where the learner made it.
import { api } from "./api.js";
import { getLanguage, getLearnerId, setLanguage } from "./app.js";
import { renderChips } from "./ui.js";
import { getLocale, langName, onUiLanguageChange, t } from "./i18n.js";

const $ = (id) => document.getElementById(id);
let language = null;      // the language shown; starts on the one being practised
let last = null;          // last progress response, to redraw the stats in another interface language

// The stats are drawn by React (src/enhancements.jsx mountStats, with the count-up animation).
function renderStats(p) {
  window.dispatchEvent(new CustomEvent("tutor:progress", { detail: { ...p, labels: {
    sessions: t("s_sessions"), minutes: t("s_minutes"), accuracy: t("s_accuracy"),
    cards: t("s_cards"), due: t("s_due"), level: t("s_level") } } }));
}

// Opening the tab shows the language being practised; the chips switch to another one.
export async function loadProgress(choice = null) {
  language = choice || getLanguage();
  const p = await api.progress(getLearnerId(), language);
  language = p.language;

  renderChips($("progress-languages"),
    p.languages.length > 1 ? p.languages.map((l) => ({ value: l, label: langName(l) })) : [],
    language, (v) => { setLanguage(v); loadProgress(v); });     // stays chosen in every section
  $("progress-title").textContent = t("level_title", { lang: langName(p.language), level: p.level });

  last = p;
  renderStats(p);

  $("top-errors").innerHTML = "";
  if (!p.top_errors.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = t("no_lang_mistakes", { lang: langName(p.language, { inSentence: true }) });
    $("top-errors").appendChild(li);
  }
  for (const e of p.top_errors) {
    const li = document.createElement("li");
    li.className = "mistake-item";
    const head = document.createElement("button");
    head.type = "button";
    head.className = "mistake";
    head.disabled = e.concept_id == null;
    head.setAttribute("aria-expanded", "false");
    const rule = document.createElement("span");
    rule.textContent = e.rule;
    const meta = document.createElement("span");
    meta.className = "chip" + (e.fixed ? " fixed" : "");
    const where = e.sessions > 1 ? ` · ${t("in_sessions", { n: e.sessions })}` : "";
    meta.textContent = e.fixed ? t("fixed") : `${e.count}×${where}`;
    head.append(rule, meta);
    const details = document.createElement("ul");
    details.className = "occurrences hidden";
    head.onclick = () => toggleOccurrences(e.concept_id, head, details);
    li.append(head, details);
    $("top-errors").appendChild(li);
  }
}

// Every sentence where the learner made this mistake (one concept = the same mistake, even reworded).
async function toggleOccurrences(conceptId, head, list) {
  const open = list.classList.toggle("hidden") === false;
  head.setAttribute("aria-expanded", String(open));
  if (!open || list.dataset.loaded) return;
  list.innerHTML = `<li class="muted">${t("loading")}</li>`;
  try {
    const r = await api.mistakeOccurrences(getLearnerId(), conceptId);
    list.innerHTML = "";
    for (const o of r.occurrences) list.appendChild(occurrence(o));
    list.dataset.loaded = "1";
  } catch (err) {
    list.innerHTML = "";
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = t("err_prefix") + err.message;
    list.appendChild(li);
  }
}

function occurrence(o) {
  const li = document.createElement("li");
  const said = document.createElement("p");
  said.className = "occ-said";
  const text = o.you_said || o.original;
  const i = text.toLowerCase().indexOf((o.original || "").toLowerCase());
  if (i >= 0 && o.original) {
    const mark = document.createElement("mark");
    mark.textContent = text.slice(i, i + o.original.length);
    said.append(`“${text.slice(0, i)}`, mark, `${text.slice(i + o.original.length)}”`);
  } else {
    said.textContent = `“${text}”`;
  }
  const fix = document.createElement("p");
  fix.className = "occ-fix";
  fix.innerHTML = `<span class="original"></span><span class="arrow">→</span><span class="correction"></span><span class="occ-date"></span>`;
  fix.querySelector(".original").textContent = o.original;
  fix.querySelector(".correction").textContent = o.correction;
  const date = new Date(o.date.replace(" ", "T") + "Z");
  fix.querySelector(".occ-date").textContent = isNaN(date) ? "" :
    date.toLocaleDateString(getLocale(), { day: "numeric", month: "short", year: "numeric" });
  const rule = document.createElement("p");
  rule.className = "rule";
  rule.textContent = o.rule;
  li.append(said, fix, rule);
  return li;
}

onUiLanguageChange(() => {
  if (!$("tab-progress").classList.contains("hidden") && last) loadProgress(language);
});
