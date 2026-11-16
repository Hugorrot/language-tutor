// Review tab: shows due cards one by one, Again / Hard / Good / Easy (py-fsrs in the backend).
import { api } from "./api.js";
import { playBase64 } from "./audio.js";
import { getLearnerId, refreshDueBadge } from "./app.js";

const $ = (id) => document.getElementById(id);
let queue = [];
let current = null;

const KIND_LABEL = { cloze: "Fill the gap", vocab: "Vocabulary", reverse: "Translate" };

function showCard() {
  current = queue.shift() || null;
  $("review-empty").classList.toggle("hidden", !!current);
  $("review-card").classList.toggle("hidden", !current);
  if (!current) return;

  $("card-kind").textContent = KIND_LABEL[current.kind] || current.kind;
  $("card-front").textContent = current.front;
  $("card-back").textContent = current.back;
  $("card-explanation").textContent = current.explanation || "";
  $("card-back-wrap").classList.add("hidden");
  $("ratings").classList.add("hidden");
  $("show-answer").classList.remove("hidden");
}

export async function loadReview() {
  try {
    const res = await api.dueCards(getLearnerId());
    queue = res.cards;
  } catch (e) {
    console.error(e);
    queue = [];
  }
  showCard();
}

async function playCurrent() {
  if (!current) return;
  if (current.audio_b64 === undefined) {
    const { audio_b64 } = await api.cardAudio(current.card_id);
    current.audio_b64 = audio_b64;
  }
  playBase64(current.audio_b64);
}

export function initReview() {
  $("show-answer").onclick = () => {
    $("card-back-wrap").classList.remove("hidden");
    $("ratings").classList.remove("hidden");
    $("show-answer").classList.add("hidden");
  };
  $("play-audio").onclick = playCurrent;
  document.querySelectorAll("#ratings button").forEach((b) => {
    b.onclick = async () => {
      await api.answerCard(current.card_id, Number(b.dataset.rating));
      refreshDueBadge();
      showCard();
    };
  });
}
