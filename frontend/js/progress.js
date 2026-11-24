// Progress tab: one page per language (level, sessions, cards, mistakes, memory search).
import { api } from "./api.js";
import { getLanguage, getLearnerId } from "./app.js";
import { renderChips } from "./ui.js";

const $ = (id) => document.getElementById(id);
let language = null;      // the language shown; starts on the one being practised

// Opening the tab shows the language being practised; the chips switch to another one.
export async function loadProgress(choice = null) {
  language = choice || getLanguage();
  const p = await api.progress(getLearnerId(), language);
  language = p.language;

  renderChips($("progress-languages"),
    p.languages.length > 1 ? p.languages.map((l) => ({ value: l, label: l })) : [],
    language, (v) => { $("memory-results").innerHTML = ""; loadProgress(v); });
  $("progress-title").textContent = `${p.language} · Level ${p.level}`;

  window.dispatchEvent(new CustomEvent("tutor:progress", { detail: p }));

  $("top-errors").innerHTML = p.top_errors.length ? "" :
    `<li class="muted">No ${p.language} mistakes yet. Have a conversation first.</li>`;
  for (const e of p.top_errors) {
    const li = document.createElement("li");
    li.className = "mistake";
    const rule = document.createElement("span");
    rule.textContent = e.rule;
    li.appendChild(rule);
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
