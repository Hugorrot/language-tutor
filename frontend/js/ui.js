// Small shared UI helpers.
// Keep the shared selection API while rendering options through GlideSelect.
import { renderChoice } from "../src/selection.jsx";
export const renderChips = renderChoice;

// In-app confirmation dialog (instead of the browser's confirm()). Resolves true if confirmed.
export function confirmDialog({ title, body = "", ok, cancel }) {
  const $ = (id) => document.getElementById(id);
  const modal = $("modal");
  $("modal-title").textContent = title;
  $("modal-body").textContent = body;
  $("modal-ok").textContent = ok;
  $("modal-cancel").textContent = cancel;
  modal.classList.remove("hidden");
  $("modal-cancel").focus();
  return new Promise((resolve) => {
    const close = (answer) => {
      modal.classList.add("hidden");
      $("modal-ok").onclick = $("modal-cancel").onclick = modal.onclick = null;
      window.removeEventListener("keydown", onKey, true);
      resolve(answer);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.code === "Space") { e.stopPropagation(); }   // don't start recording behind the dialog
    };
    $("modal-ok").onclick = () => close(true);
    $("modal-cancel").onclick = () => close(false);
    modal.onclick = (e) => { if (e.target === modal) close(false); };   // click outside = cancel
    window.addEventListener("keydown", onKey, true);
  });
}

export const dialogOpen = () => !document.getElementById("modal").classList.contains("hidden");
