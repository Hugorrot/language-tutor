// Progress tab: one page per language (level, sessions, cards, mistakes, memory search).
import { api } from "./api.js";
import { getLanguage, getLearnerId } from "./app.js";
import { renderChips } from "./ui.js";

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
    p.languages.length > 1 ? p.languages.map((l) => ({ value: l, label: l })) : [],
    language, (v) => { $("memory-results").innerHTML = ""; loadProgress(v); });
  $("progress-title").textContent = `${p.language} · Level ${p.level}`;

  const acc = p.review_accuracy === null ? "–" : Math.round(p.review_accuracy * 100) + "%";
  $("stats").innerHTML =
    stat("Sessions", p.sessions) +
    stat("Minutes spoken (est.)", p.minutes_spoken) +
    stat("Review accuracy", acc) +
    stat("Cards", p.cards_total) +
    stat("Due now", p.cards_due) +
    stat("Level", p.level);

  $("top-errors").innerHTML = p.top_errors.length ? "" :
    `<li class="muted">No ${p.language} mistakes yet. Have a conversation first.</li>`;
  for (const e of p.top_errors) {
    const li = document.createElement("li");
    li.className = "mistake";
    const rule = document.createElement("span");
    rule.textContent = e.rule;
    const meta = document.createElement("span");
    meta.className = "chip" + (e.fixed ? " fixed" : "");
    const where = e.sessions > 1 ? ` · ${e.sessions} sessions` : "";
    meta.textContent = e.fixed ? "fixed" : `${e.count}×${where}`;
    li.append(rule, meta);
    $("top-errors").appendChild(li);
  }
}

// "How many times did I say ...?" Exact count + similar sentences from the vector DB, in this language.
async function searchMemory(q) {
  const out = $("memory-results");
  out.textContent = "Searching...";
  try {
    const r = await api.searchMemory(getLearnerId(), q, language);
    out.innerHTML = "";
    const head = document.createElement("p");
    head.className = "memory-count";
    head.textContent = `You said “${r.query}” ${r.exact_count} time${r.exact_count === 1 ? "" : "s"} in ${language}.`;
    out.appendChild(head);
    if (r.similar.length) {
      const sub = document.createElement("p");
      sub.className = "hint left";
      sub.textContent = "Similar things you said:";
      out.appendChild(sub);
      const ul = document.createElement("ul");
      ul.className = "list";
      for (const s of r.similar) {
        const li = document.createElement("li");
        li.textContent = `“${s.text}” (${Math.round(s.similarity * 100)}% similar)`;
        ul.appendChild(li);
      }
      out.appendChild(ul);
    }
  } catch (err) {
    out.textContent = err.message;
  }
}

$("memory-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const q = $("memory-input").value.trim();
  if (q) searchMemory(q);
});
