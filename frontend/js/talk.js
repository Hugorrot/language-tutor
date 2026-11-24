// Talk tab: pick a scenario, voice/text turns around the orb, end-of-session summary.
import { api } from "./api.js";
import { playBase64, readLevels, startRecording, stopPlayback, stopRecording, unlockAudio } from "./audio.js";
import { getLanguage, getLearner, getLearnerId, refreshDueBadge, setLanguage } from "./app.js";
import { createOrb } from "../src/orbBridge.jsx";
import { mountSessionWidgets, renderSummaryCards } from "../src/widgets.jsx";
import { getAudioPreferences, notify } from "./preferences.js";
import { renderChips } from "./ui.js";

const $ = (id) => document.getElementById(id);
let sessionId = null;
let busy = false;
let recording = false;
let recordingTask = null;
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
  window.dispatchEvent(new CustomEvent("tutor:voice-state", { detail: state }));
  $("text-input").disabled = state === "thinking" || state === "listening";
  document.querySelector("#text-form button").disabled = state === "thinking" || state === "listening";
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

function setStatus(text, status) {
  $("talk-status").textContent = text;
  if (status) window.dispatchEvent(new CustomEvent("tutor:session-status", { detail: {status, label:text} }));
}

function showView(view) {
  window.scrollTo({ top: 0, behavior: "instant" });
  window.dispatchEvent(new CustomEvent("tutor:conversation", { detail: view }));
  ["talk-setup", "talk-live", "talk-summary"].forEach((v) => $(v).classList.toggle("hidden", v !== view));
  window.dispatchEvent(new CustomEvent("tutor:view"));
}

async function speak(b64) {
  if (!b64 || !getAudioPreferences().autoPlay) { setOrb("idle"); return; }
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
    $("live-language").textContent = `Speak ${res.target_language}`;
    $("chat").innerHTML = "";
    caption("caption-user", "");
    caption("caption-tutor", res.tutor_text);
    setStatus("");
    showView("talk-live");
    addMessage("tutor", res.tutor_text);
    await speak(res.audio_b64);
  } catch (e) {
    $("setup-status").textContent = "Error: " + e.message;
    notify("Could not start the session", e.message, "failed");
  } finally {
    $("start-session").disabled = false;
    $("start-session").textContent = "Start session";
  }
}

async function sendTurn(payload) {
  if (busy || recording || !sessionId) return;
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
    setOrb("idle");
    setStatus(e.message, "failed");
    notify("Message was not sent", e.message, "failed");
  } finally {
    busy = false;
  }
}

async function beginTalking() {
  if (busy || recording || !sessionId) return false;
  stopPlayback();
  recording = true;
  setStatus("");
  setOrb("listening");
  recordingTask = startRecording();
  try {
    await recordingTask;
    return recording;
  } catch (err) {
    recording = false;
    setOrb("idle");
    setStatus("Microphone not available: " + err.message, "failed");
    notify("Microphone unavailable", "Check your browser microphone permission, or type your message.", "failed");
    return false;
  }
}
async function endTalking({ reason = 'release' } = {}) {
  if (!recording) return;
  recording = false;
  const shouldSend = ['release', 'tap', 'key'].includes(reason);
  setOrb("thinking");
  try {
    await recordingTask;
    const blob = await stopRecording();
    if (shouldSend && blob && blob.size > 1000) await sendTurn({ audioBlob: blob });
    else {
      setOrb("idle");
      if (shouldSend) setStatus("Too short: hold while you speak.", "pending");
      else if (reason !== 'mic-denied') setStatus("Recording cancelled.", "cancelled");
    }
  } catch { /* beginTalking reports microphone failures. */ }
}

async function endSession() {
  if (busy) return;
  await endTalking({ reason: "cancel" });
  stopPlayback();
  busy = true;
  setOrb("thinking");
  setStatus("Analysing your session…", "running");
  try {
    const res = await api.endSession(sessionId);
    sessionId = null;
    renderSummary(res);
    notify("Session complete", `${res.cards.length} new practice card${res.cards.length === 1 ? "" : "s"} ready to review.`);
    showView("talk-summary");
    toggleTranscript(false);
    refreshDueBadge();
  } catch (e) {
    setStatus("Error: " + e.message, "failed");
    notify("Could not finish the session", e.message, "failed");
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

  renderSummaryCards(cards, refreshDueBadge);
}

function toggleTranscript(open) {
  const panel = $("transcript");
  const show = open ?? !panel.classList.contains("open");
  panel.classList.toggle("open", show);
  panel.setAttribute("aria-hidden", String(!show));
}

export function initTalk() {
  mountSessionWidgets(beginTalking, endTalking);
  orb = createOrb($("orb"), readLevels);


  renderChips($("scenarios"), [
    {value:"free conversation", label:"Free conversation"},
    {value:"ordering at a restaurant", label:"At a restaurant"},
    {value:"renting a flat", label:"Renting a flat"},
    {value:"telling a friend about your weekend", label:"Your weekend"},
    {value:"asking for directions", label:"Directions"},
  ], scenario, value => { scenario = value; });

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

  renderLanguagePicker();
  setOrb("idle");
}
