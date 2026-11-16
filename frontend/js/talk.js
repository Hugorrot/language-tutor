// Talk tab: start session, voice/text turns, end-of-session summary.
import { api } from "./api.js";
import { playBase64, startRecording, stopRecording } from "./audio.js";
import { getLearnerId, refreshDueBadge } from "./app.js";

const $ = (id) => document.getElementById(id);
let sessionId = null;
let busy = false;

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  $("chat").appendChild(div);
  $("chat").scrollTop = $("chat").scrollHeight;
}

function setStatus(text) { $("talk-status").textContent = text; }

function showView(view) {
  ["talk-setup", "talk-live", "talk-summary"].forEach((v) => $(v).classList.toggle("hidden", v !== view));
}

async function startSession() {
  setStatus("");
  $("start-session").disabled = true;
  try {
    const res = await api.startSession(getLearnerId(), $("scenario").value);
    sessionId = res.session_id;
    $("chat").innerHTML = "";
    showView("talk-live");
    addMessage("tutor", res.tutor_text);
    await playBase64(res.audio_b64);
  } catch (e) {
    alert(e.message);
  } finally {
    $("start-session").disabled = false;
  }
}

async function sendTurn(payload) {
  if (busy) return;
  busy = true;
  setStatus("Thinking...");
  try {
    const res = await api.sendTurn(sessionId, payload);
    addMessage("user", res.user_text);
    addMessage("tutor", res.tutor_text);
    setStatus(`Response time: ${(res.timings_ms.total / 1000).toFixed(1)} s`);
    await playBase64(res.audio_b64);
  } catch (e) {
    setStatus("Error: " + e.message);
  } finally {
    busy = false;
  }
}

async function endSession() {
  setStatus("Analysing your session...");
  $("end-session").disabled = true;
  try {
    const res = await api.endSession(sessionId);
    renderSummary(res);
    showView("talk-summary");
    refreshDueBadge();
  } catch (e) {
    setStatus("Error: " + e.message);
  } finally {
    $("end-session").disabled = false;
  }
}

function renderSummary({ summary, errors, cards }) {
  $("summary-text").textContent = summary || "No learner messages in this session.";

  $("summary-errors").innerHTML = "";
  for (const e of errors) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="original"></span> → <span class="correction"></span><div class="rule"></div>`;
    li.querySelector(".original").textContent = e.original;
    li.querySelector(".correction").textContent = e.correction;
    li.querySelector(".rule").textContent = e.rule;
    $("summary-errors").appendChild(li);
  }

  $("summary-cards").innerHTML = "";
  for (const c of cards) {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = `${c.front}  →  ${c.back}`;
    const del = document.createElement("button");
    del.textContent = "Remove";
    del.onclick = async () => { await api.deleteCard(c.card_id); li.remove(); refreshDueBadge(); };
    li.append(text, del);
    $("summary-cards").appendChild(li);
  }
}

export function initTalk() {
  $("start-session").onclick = startSession;
  $("end-session").onclick = endSession;
  $("new-session").onclick = () => showView("talk-setup");

  $("text-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("text-input").value.trim();
    if (!text) return;
    $("text-input").value = "";
    sendTurn({ text });
  });

  // Hold-to-talk (mouse and touch)
  const btn = $("record");
  const down = async (e) => {
    e.preventDefault();
    if (busy) return;
    try {
      await startRecording();
      btn.classList.add("recording");
      setStatus("Listening...");
    } catch (err) {
      setStatus("Microphone not available: " + err.message);
    }
  };
  const up = async () => {
    if (!btn.classList.contains("recording")) return;
    btn.classList.remove("recording");
    const blob = await stopRecording();
    if (blob && blob.size > 0) sendTurn({ audioBlob: blob });
  };
  btn.addEventListener("mousedown", down);
  btn.addEventListener("touchstart", down);
  window.addEventListener("mouseup", up);
  window.addEventListener("touchend", up);
}
