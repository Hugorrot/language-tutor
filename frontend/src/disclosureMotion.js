// Keep native details/summary semantics while animating layout in both directions.
export function installDisclosureMotion() {
  const active = new WeakMap();
  document.addEventListener('click', event => {
    const summary = event.target.closest?.('summary');
    const details = summary?.parentElement;
    if (!details || details.tagName !== 'DETAILS' || event.defaultPrevented) return;
    event.preventDefault();

    const previous = active.get(details);
    const opening = !(previous?.opening ?? details.open);
    const startHeight = details.getBoundingClientRect().height;
    previous?.animation.cancel();
    active.delete(details);
    summary.focus({ preventScroll: true });

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      details.open = opening;
      details.style.removeProperty('height');
      details.style.removeProperty('overflow');
      summary.removeAttribute('aria-expanded');
      return;
    }

    // Measure intrinsic endpoints synchronously, before the browser paints.
    details.style.height = 'auto';
    details.open = false;
    const closedHeight = details.getBoundingClientRect().height;
    details.open = true;
    const openHeight = details.getBoundingClientRect().height;
    details.style.overflow = 'hidden';
    summary.setAttribute('aria-expanded', String(opening));

    const animation = details.animate(
      [{ height: `${startHeight}px` }, { height: `${opening ? openHeight : closedHeight}px` }],
      { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    );
    const state = { opening, animation };
    active.set(details, state);
    animation.finished.then(() => {
      if (active.get(details) !== state) return;
      details.open = opening;
      animation.cancel();
      details.style.removeProperty('height');
      details.style.removeProperty('overflow');
      summary.removeAttribute('aria-expanded');
      active.delete(details);
    }).catch(() => { /* A second toggle reverses from the current height. */ });
  });
}
