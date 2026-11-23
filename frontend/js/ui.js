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
