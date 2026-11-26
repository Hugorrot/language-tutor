import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource-variable/dm-sans';
import GlowCursor from './components/GlowCursor';
import SplitText from './components/SplitText';
import CurvedLoop from './components/CurvedLoop';
import Navigation from './Navigation';
import Scanner from './components/Scanner';
import { t } from './i18n';
import { enhanceButtons, mountExerciseCards, mountStats } from './enhancements';
import { mountPageWidgets } from './widgets';
import { installDisclosureMotion } from './disclosureMotion';
import '../css/design.css';

function CursorEffect() {
  const query = '(min-width: 761px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';
  const [enabled, setEnabled] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setEnabled(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  if (!enabled) return null;
  return <GlowCursor color="#a4c8bf" intensity={0.35} trailWidth={1} linger={0.28}
    glow={0.25} clickBurst={false} theme="dark" style={{ width: '100%', height: '100%' }} />;
}
createRoot(document.getElementById('scanner-background')).render(<Scanner
  color1="#5eaaad" color2="#edbda7" color3="#d5eadc" speed={0.13} sweepSpeed={0.12}
  sweepWidth={2.2} trail={0.3} ripple={0.35} bandDensity={7} glow={0.25}
  brightness={0.38} opacity={0.36} scanline={false} grain={false}
  mouseInteraction={false} clickEffect="none" dpr={1.25} />);
createRoot(document.getElementById('cursor-effects')).render(<CursorEffect />);
createRoot(document.getElementById('navigation-root')).render(<Navigation />);
// Animated page headings. data-split-text holds the translation key (js/i18n.js),
// data-split-vars its values as JSON (e.g. the learner's name on Home).
const headingRoots = new Map();
function renderHeading(heading, root) {
  const text = t(heading.dataset.splitText, JSON.parse(heading.dataset.splitVars || '{}'));
  root.render(<SplitText key={text} text={text} tag="span" effect="rise" splitType="words"
    delay={85} duration={0.85} trigger="view" rootMargin="0px" textAlign="inherit" hoverEffect="none" />);
}
function mountVisibleHeadings() {
  for (const heading of document.querySelectorAll('[data-split-text]')) {
    if (headingRoots.has(heading) || !heading.getClientRects().length) continue;
    const root = createRoot(heading);
    headingRoots.set(heading, root);
    renderHeading(heading, root);
  }
}
const loopRoot = createRoot(document.getElementById('curved-loop-root'));
function renderLoop() {
  const text = t('loop_text');
  document.getElementById('curved-loop-root').setAttribute('aria-label', text);
  loopRoot.render(<CurvedLoop key={text} marqueeText={text}
    shape="wave" curveAmount={80} speed={0.45} fontSize={150} fontWeight={400}
    separator="" color="#bad7cc" edgeFade={0.22} interactive pauseOnHover />);
}
renderLoop();
// js/home.js changed a heading's key or values
window.addEventListener('tutor:heading', e => {
  const root = headingRoots.get(e.detail);
  if (root) renderHeading(e.detail, root);
});
window.addEventListener('tutor:ui-language', () => {
  headingRoots.forEach((root, heading) => renderHeading(heading, root));
  renderLoop();
});
installDisclosureMotion();
mountPageWidgets();
mountExerciseCards();
mountStats();
let enhanceFrame = 0;
const observer = new MutationObserver(records => {
  const hasControls = records.some(r => [...r.addedNodes, ...r.removedNodes].some(n =>
    n.nodeType === 1 && (n.matches?.('button, .control-mount') || n.querySelector?.('button:not([data-enhanced])'))));
  if (hasControls && !enhanceFrame) enhanceFrame = requestAnimationFrame(() => { enhanceFrame = 0; enhanceButtons(); });
});
observer.observe(document.body, { childList: true, subtree: true });
function revealPage() {
  requestAnimationFrame(() => {
    mountVisibleHeadings();
    const elements = [...document.querySelectorAll('.reveal')].filter(el => el.getClientRects().length);
    if (!elements.length) return;
    gsap.killTweensOf(elements);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(elements, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(elements, { opacity: 0, y: 18 }, {
      opacity: 1, y: 0, duration: 0.8, stagger: 0.13, ease: 'power2.out',
      clearProps: 'transform,opacity',
    });
  });
}
window.addEventListener('tutor:view', revealPage);
window.addEventListener('tutor:conversation', e => {
  document.body.classList.toggle('conversation-active', e.detail === 'talk-live');
});
import('../js/app.js').then(() => { enhanceButtons(); revealPage(); });
