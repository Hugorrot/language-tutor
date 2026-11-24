// Small shared UI helpers.

// Render a row of selectable chips. items: [{ value, label }]. Calls onSelect(value) on click.
export function renderChips(container, items, selected, onSelect) {
  container.innerHTML = "";
  container.classList.toggle("hidden", items.length === 0);
  for (const item of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip-btn" + (item.value === selected ? " selected" : "");
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(item.value === selected));
    b.textContent = item.label;
    if (item.badge) {
      const n = document.createElement("span");
      n.className = "badge";
      n.textContent = item.badge;
      b.appendChild(n);
    }
    b.onclick = () => {
      container.querySelectorAll(".chip-btn").forEach((x) => {
        x.classList.toggle("selected", x === b);
        x.setAttribute("aria-checked", String(x === b));
      });
      onSelect(item.value);
    };
    container.appendChild(b);
  }
}

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
