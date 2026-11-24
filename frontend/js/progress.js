// Progress tab: one page per language (level, sessions, cards, mistakes, memory search).
import { api } from "./api.js";
import { getLanguage, getLearnerId } from "./app.js";
import { renderChips } from "./ui.js";
import { getLocale, langName, onUiLanguageChange, t } from "./i18n.js";

const $ = (id) => document.getElementById(id);
let language = null;      // the language shown; starts on the one being practised

function stat(label, value) {
  return `<div class="stat"><div class="value">${value}</div><div class="label">${label}</div></div>`;
}

// Opening the tab shows the language being practised; the chips switch to another one.
export async function loadProgress(choice = null) {
  language = choice || getLanguage();
  const p = await api.progress(getLearnerId(), language);
  language = p.language;

  renderChips($("progress-languages"),
    p.languages.length > 1 ? p.languages.map((l) => ({ value: l, label: langName(l) })) : [],
    language, (v) => { loadProgress(v); });
  $("progress-title").textContent = t("level_title", { lang: langName(p.language), level: p.level });

  const acc = p.review_accuracy === null ? "–" : Math.round(p.review_accuracy * 100) + "%";
  $("stats").innerHTML =
    stat(t("s_sessions"), p.sessions) +
    stat(t("s_minutes"), p.minutes_spoken) +
    stat(t("s_accuracy"), acc) +
    stat(t("s_cards"), p.cards_total) +
    stat(t("s_due"), p.cards_due) +
    stat(t("s_level"), p.level);

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
  if (!$("tab-progress").classList.contains("hidden")) loadProgress(language);
});
