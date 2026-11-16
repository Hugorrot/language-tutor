// Progress tab.
import { api } from "./api.js";
import { getLearnerId } from "./app.js";

const $ = (id) => document.getElementById(id);

function stat(label, value) {
  return `<div class="stat"><div class="value">${value}</div><div class="label">${label}</div></div>`;
}

export async function loadProgress() {
  const p = await api.progress(getLearnerId());
  const acc = p.review_accuracy === null ? "–" : Math.round(p.review_accuracy * 100) + "%";
  $("stats").innerHTML =
    stat("Level", p.level) +
    stat("Sessions", p.sessions) +
    stat("Minutes spoken (est.)", p.minutes_spoken) +
    stat("Cards", p.cards_total) +
    stat("Due now", p.cards_due) +
    stat("Review accuracy", acc);

  $("top-errors").innerHTML = "";
  for (const e of p.top_errors) {
    const li = document.createElement("li");
    li.textContent = `${e.rule} — ${e.count}× ${e.fixed ? "(fixed)" : ""}`;
    $("top-errors").appendChild(li);
  }
}
