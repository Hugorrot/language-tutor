// Talk tab: pick a scenario, voice/text turns around the orb, end-of-session summary.
import { api } from "./api.js";
import { playBase64, readLevels, startRecording, stopPlayback, stopRecording, unlockAudio } from "./audio.js";
import { getExplanationLanguage, getLanguage, getLearner, getLearnerId, refreshDueBadge, setExplanationLanguage,
         setLanguage } from "./app.js";
import { createOrb } from "../src/orbBridge.jsx";
import { mountSessionWidgets, renderSummaryCards } from "../src/widgets.jsx";
import { getAudioPreferences, notify } from "./preferences.js";
import { confirmDialog, renderChips } from "./ui.js";
import { langName, onUiLanguageChange, t } from "./i18n.js";

const $ = (id) => document.getElementById(id);
let sessionId = null;
let busy = false;
let recording = false;
let recordingTask = null;
let scenario = "free conversation";
let language = null;          // chosen in the setup screen

const ALL_LANGUAGES = ["Italian", "Spanish", "French", "German", "Portuguese", "English"];

// keepSelection: redraw (e.g. after an interface language change) without resetting the chosen language
export function renderLanguagePicker(keepSelection = false) {
  const learner = getLearner();
  if (!keepSelection || !language) language = getLanguage();
  const langs = learner?.supported_languages || ALL_LANGUAGES;
  renderChips($("language-picker"), langs.map((l) => ({ value: l, label: langName(l) })), language, (v) => { language = v; });

  // Explanation language: the interface, summaries, grammar rules and card explanations use it.
  renderChips($("explanation-picker"), langs.map((l) => ({ value: l, label: langName(l) })), getExplanationLanguage(),
    changeExplanationLanguage);
}

async function changeExplanationLanguage(value) {
  try {
    await setExplanationLanguage(value);          // redraws the interface in the new language
    notify(t("t_profile_saved"), t("expl_changed", { lang: langName(value, { inSentence: true }) }));
  } catch (e) {
    notify(t("t_profile_fail"), e.message, "failed");
    renderLanguagePicker(true);         // back to the saved choice
  }
}

const SCENARIOS = [
  ["free conversation", "sc_free"],
  ["ordering at a restaurant", "sc_rest"],
  ["renting a flat", "sc_flat"],
  ["telling a friend about your weekend", "sc_weekend"],
  ["asking for directions", "sc_dir"],
];
function renderScenarios() {
  renderChips($("scenarios"), SCENARIOS.map(([value, key]) => ({ value, label: t(key) })), scenario,
    (value) => { scenario = value; });
}
let orb = null;

function setOrb(state) {
  orb?.setState(state);
  $("orb-state").textContent = t(`vs_${state}`);
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
  $("start-session").textContent = t("starting");
  unlockAudio();
  try {
    const res = await api.startSession(getLearnerId(), scenario, language);
    sessionId = res.session_id;
    setLanguage(res.target_language);
    $("live-language").dataset.lang = res.target_language;
    $("live-language").textContent = t("speak_lang", { lang: langName(res.target_language, { inSentence: true }) });
    $("chat").innerHTML = "";
    caption("caption-user", "");
    caption("caption-tutor", res.tutor_text);
    setStatus("");
    showView("talk-live");
    addMessage("tutor", res.tutor_text);
    await speak(res.audio_b64);
  } catch (e) {
    $("setup-status").textContent = t("err_prefix") + e.message;
    notify(t("t_start_fail"), e.message, "failed");
  } finally {
    $("start-session").disabled = false;
    $("start-session").textContent = t("start_session");
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
    const message = e.status === 422 ? t("cant_hear") : e.message;
    setStatus(message, "failed");
    notify(t("t_send_fail"), message, "failed");
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
    setStatus(t("mic_unavailable") + err.message, "failed");
    notify(t("t_mic_fail"), t("t_mic_fail_d"), "failed");
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
      if (shouldSend) setStatus(t("too_short"), "pending");
      else if (reason !== 'mic-denied') setStatus(t("rec_cancelled"), "cancelled");
    }
  } catch { /* beginTalking reports microphone failures. */ }
}

async function endSession() {
  if (busy) return;
  await endTalking({ reason: "cancel" });
  stopPlayback();
  busy = true;
  setOrb("thinking");
  setStatus(t("analysing"), "running");
  try {
    const res = await api.endSession(sessionId);
    sessionId = null;
    renderSummary(res);
    notify(t("session_complete"), t(res.cards.length === 1 ? "t_cards_one" : "t_cards_other", { n: res.cards.length }));
    showView("talk-summary");
    toggleTranscript(false);
    refreshDueBadge();
  } catch (e) {
    setStatus(t("err_prefix") + e.message, "failed");
    notify(t("t_end_fail"), e.message, "failed");
  } finally {
    busy = false;
    setOrb("idle");
  }
}

function renderSummary({ summary, errors, cards }) {
  $("summary-text").textContent = summary || t("no_learner_msgs");

  $("summary-errors").innerHTML = "";
  if (!errors.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = t("no_mistakes");
    $("summary-errors").appendChild(li);
  }
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

// Back to the start screen ("Your next conversation"), from the Home button in the dock.
// In the middle of a conversation, ask first: leaving drops the session without analysing it.
export async function goHome() {
  const live = !$("talk-live").classList.contains("hidden") && sessionId;
  if (live && !(await confirmDialog({ title: t("leave_title"), body: t("leave_body"),
                                      ok: t("btn_leave"), cancel: t("btn_cancel") }))) return false;
  if (live) {
    await endTalking({ reason: "cancel" });
    stopPlayback();
    sessionId = null;
    busy = false;
    setOrb("idle");
  }
  toggleTranscript(false);
  setStatus("");
  $("setup-status").textContent = "";
  renderLanguagePicker();
  showView("talk-setup");
  return true;
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


  renderScenarios();

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

  // Interface language changed: redraw the parts written by JS
  onUiLanguageChange(() => {
    renderLanguagePicker(true);
    renderScenarios();
    setOrb(orb?.state || "idle");
    const tag = $("live-language");
    if (tag.dataset.lang) tag.textContent = t("speak_lang", { lang: langName(tag.dataset.lang, { inSentence: true }) });
    if (!$("start-session").disabled) $("start-session").textContent = t("start_session");
  });
}
