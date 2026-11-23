// Talk tab: pick a scenario, voice/text turns around the orb, end-of-session summary.
import { api } from "./api.js";
import { playBase64, readLevels, startRecording, stopPlayback, stopRecording, unlockAudio } from "./audio.js";
import { getLanguage, getLearner, getLearnerId, refreshDueBadge, setLanguage } from "./app.js";
import { createOrb } from "./orb.js";
import { renderChips } from "./ui.js";

const $ = (id) => document.getElementById(id);
let sessionId = null;
let busy = false;
let recording = false;
let scenario = "free conversation";
let language = null;          // chosen in the setup screen

const ALL_LANGUAGES = ["Italian", "Spanish", "French", "German", "Portuguese", "English"];

export function renderLanguagePicker() {
  const learner = getLearner();
  language = getLanguage();
  const langs = learner?.supported_languages || ALL_LANGUAGES;
  renderChips($("language-picker"), langs.map((l) => ({ value: l, label: l })), language, (v) => { language = v; });
}
let orb = null;

const STATE_LABEL = {
  idle: "Hold to talk",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking",
};

function setOrb(state) {
  orb?.setState(state);
  $("orb-state").textContent = STATE_LABEL[state];
  $("orb-state").dataset.state = state;
  $("record").classList.toggle("recording", state === "listening");
  $("record").disabled = state === "thinking";
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  $("chat").appendChild(div);
  $("chat").scrollTop = $("chat").scrollHeight;
}

// The latest lines appear under the orb, like subtitles.
function caption(id, text) {
  const el = $(id);
  el.classList.remove("show");
  void el.offsetWidth;              // restart the fade-in animation
  el.textContent = text || "";
  if (text) el.classList.add("show");
}

function setStatus(text) { $("talk-status").textContent = text; }

function showView(view) {
  ["talk-setup", "talk-live", "talk-summary"].forEach((v) => $(v).classList.toggle("hidden", v !== view));
}

async function speak(b64) {
  setOrb("speaking");
  await playBase64(b64);
  if (orb?.state === "speaking") setOrb("idle");
}

async function startSession() {
  $("setup-status").textContent = "";
  $("start-session").disabled = true;
  $("start-session").textContent = "Starting…";
  unlockAudio();
  try {
    const res = await api.startSession(getLearnerId(), scenario, language);
    sessionId = res.session_id;
    setLanguage(res.target_language);
    $("live-language").textContent = `${res.target_language} · ${res.level}`;
    $("chat").innerHTML = "";
    caption("caption-user", "");
    caption("caption-tutor", res.tutor_text);
    setStatus("");
    showView("talk-live");
    addMessage("tutor", res.tutor_text);
    await speak(res.audio_b64);
  } catch (e) {
    $("setup-status").textContent = "Error: " + e.message;
  } finally {
    $("start-session").disabled = false;
    $("start-session").textContent = "Start session";
  }
}

async function sendTurn(payload) {
  if (busy || !sessionId) return;
  busy = true;
  setOrb("thinking");
  setStatus("");
  if (payload.text) caption("caption-user", payload.text);
  try {
    const res = await api.sendTurn(sessionId, payload);
    addMessage("user", res.user_text);
    addMessage("tutor", res.tutor_text);
    caption("caption-user", res.user_text);
    caption("caption-tutor", res.tutor_text);
    setStatus(`${(res.timings_ms.total / 1000).toFixed(1)} s`);
    busy = false;
    await speak(res.audio_b64);
  } catch (e) {
    setStatus(e.message);
    setOrb("idle");
  } finally {
    busy = false;
  }
}

async function beginTalking() {
  if (busy || recording || !sessionId) return;
  stopPlayback();                     // talking over the tutor interrupts it
  try {
    recording = true;
    setOrb("listening");
    await startRecording();
  } catch (err) {
    recording = false;
    setOrb("idle");
    setStatus("Microphone not available: " + err.message);
  }
}

async function endTalking() {
  if (!recording) return;
  recording = false;
  const blob = await stopRecording();
  if (blob && blob.size > 1000) sendTurn({ audioBlob: blob });
  else { setOrb("idle"); setStatus("Too short: hold while you speak."); }
}

async function endSession() {
  if (busy) return;
  stopPlayback();
  busy = true;
  setOrb("thinking");
  setStatus("Analysing your session…");
  try {
    const res = await api.endSession(sessionId);
    sessionId = null;
    renderSummary(res);
    showView("talk-summary");
    toggleTranscript(false);
    refreshDueBadge();
  } catch (e) {
    setStatus("Error: " + e.message);
  } finally {
    busy = false;
    setOrb("idle");
  }
}

function renderSummary({ summary, errors, cards }) {
  $("summary-text").textContent = summary || "No learner messages in this session.";

  $("summary-errors").innerHTML = errors.length ? "" : '<li class="muted">No mistakes found. Bravo!</li>';
  for (const e of errors) {
    const li = document.createElement("li");
    li.innerHTML = `<div><span class="original"></span><span class="arrow">→</span><span class="correction"></span></div><div class="rule"></div>`;
    li.querySelector(".original").textContent = e.original;
    li.querySelector(".correction").textContent = e.correction;
    li.querySelector(".rule").textContent = e.rule;
    $("summary-errors").appendChild(li);
  }

  $("summary-cards").innerHTML = cards.length ? "" :
    '<li class="muted">No new cards: mistakes you already have cards for were moved back into review.</li>';
  for (const c of cards) {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = `${c.front}  →  ${c.back}`;
    const del = document.createElement("button");
    del.className = "btn ghost small";
    del.textContent = "Remove";
    del.onclick = async () => { await api.deleteCard(c.card_id); li.remove(); refreshDueBadge(); };
    li.append(text, del);
    $("summary-cards").appendChild(li);
  }
}

function toggleTranscript(open) {
  const panel = $("transcript");
  const show = open ?? !panel.classList.contains("open");
  panel.classList.toggle("open", show);
  panel.setAttribute("aria-hidden", String(!show));
}

export function initTalk() {
  orb = createOrb($("orb"), readLevels);
  createOrb($("orb-hero"), () => null, { particles: 520, hud: false });

  document.querySelectorAll(".scenario").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".scenario").forEach((x) => x.classList.toggle("selected", x === b));
      scenario = b.dataset.scenario;
    };
  });

  $("start-session").onclick = startSession;
  $("end-session").onclick = endSession;
  $("new-session").onclick = () => { renderLanguagePicker(); showView("talk-setup"); };
  $("toggle-transcript").onclick = () => toggleTranscript();
  $("close-transcript").onclick = () => toggleTranscript(false);

  $("text-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("text-input").value.trim();
    if (!text) return;
    $("text-input").value = "";
    unlockAudio();
    sendTurn({ text });
  });

  // Hold to talk: mouse, touch, or the space bar.
  const btn = $("record");
  btn.addEventListener("pointerdown", (e) => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); beginTalking(); });
  btn.addEventListener("pointerup", endTalking);
  btn.addEventListener("pointercancel", endTalking);
  btn.addEventListener("contextmenu", (e) => e.preventDefault());

  const typing = (e) => ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName);
  const liveVisible = () => !$("talk-live").classList.contains("hidden") && !$("tab-talk").classList.contains("hidden");
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat || typing(e) || !liveVisible()) return;
    e.preventDefault();
    beginTalking();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code !== "Space" || typing(e)) return;
    endTalking();
  });

  renderLanguagePicker();
  setOrb("idle");
}
