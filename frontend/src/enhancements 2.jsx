import React, { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Magnet from './components/Magnet';
import SpotlightCard from './components/SpotlightCard';
import StarBorder from './components/StarBorder';
import CountUp from './components/CountUp';

// A leaf owned by React adopts the existing DOM node, preserving native handlers and form semantics.
function ExistingNode({ node, className = 'adopted-node' }) {
  const ref = React.useRef(null);
  useLayoutEffect(() => { ref.current.appendChild(node); }, [node]);
  return <div ref={ref} className={className} />;
}
const mounts = new Map();
const mainActions = '#onboarding-form button[type="submit"], #start-session, #new-session, #show-answer, #memory-form button[type="submit"]';
function MagneticControl({ node, star }) {
  const query = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';
  const [enabled, setEnabled] = React.useState(() => matchMedia(query).matches);
  React.useEffect(() => {
    const media = matchMedia(query);
    const update = () => setEnabled(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const content = <ExistingNode node={node} />;
  return <Magnet padding={30} magnetStrength={5} maxOffset={node.id === 'record' ? 2 : 5}
    tilt={0} disabled={!enabled} wrapperClassName="magnetic-control">
    {star ? <StarBorder as="div" color="#f3d4b8" trailColor="#9fcbbb" duration={6}
      radius={3} glow={0.2} trailLength={0.16} hover="lap" sparkle={false}
      backgroundColor="#24484a" className="star-action">{content}</StarBorder> : content}
  </Magnet>;
}
export function enhanceButtons() {
  for (const [host, root] of mounts) {
    if (!host.isConnected) { root.unmount(); mounts.delete(host); }
  }
  document.querySelectorAll('main button, #onboarding button, .sm-toggle').forEach(node => {
    if (node.dataset.enhanced || node.closest('.site-dock-slot, [data-react-widget]')) return;
    // Menu toggle transforms are managed by StaggeredMenu itself.
    if (node.matches('.sm-toggle')) return;
    node.dataset.enhanced = 'true';
    const host = document.createElement('div');
    host.className = 'control-mount';
    if (node.matches('.scenario')) host.classList.add('scenario-mount');
    if (node.matches('.chip-btn')) host.classList.add('chip-mount');
    if (node.matches(mainActions)) host.classList.add('primary-mount');
    node.parentNode.insertBefore(host, node);
    const root = createRoot(host);
    mounts.set(host, root);
    flushSync(() => root.render(<MagneticControl node={node} star={node.matches(mainActions)} />));
  });
}
export function mountExerciseCards() {
  document.querySelectorAll('#flashcard .face').forEach(face => {
    const content = document.createElement('div');
    content.className = 'exercise-content';
    while (face.firstChild) content.appendChild(face.firstChild);
    const root = createRoot(face);
    flushSync(() => root.render(<SpotlightCard className="exercise-surface" spotlightColor="#bad7cc"
      intensity={0.14} spotlightSize={260} softness={0.8} borderGlow={0.4} smoothing={0.2}
      grain={0} ambient={false} style={{ '--spotlight-card-surface': '#18383b', '--spotlight-card-border': '#cde4d82e' }}>
      <ExistingNode node={content} />
    </SpotlightCard>));
  });
}
export function mountStats() {
  const root = createRoot(document.getElementById('stats'));
  window.addEventListener('tutor:progress', ({ detail: p }) => {
    const values = [
      ['Conversations', p.sessions], ['Minutes spoken', p.minutes_spoken],
      ['Review accuracy', p.review_accuracy == null ? null : Math.round(p.review_accuracy * 100), '%'],
      ['Cards collected', p.cards_total], ['Ready to review', p.cards_due], ['Your level', p.level],
    ];
    root.render(<>{values.map(([label, value, suffix = ''], index) => <div className="stat" key={`${p.language}-${label}`}>
      <div className="value" aria-label={`${value ?? 'No data'}${suffix}`}>
        {typeof value === 'number' ? <span aria-hidden="true"><CountUp to={value} from={0} duration={1.2} delay={index * 0.09} suffix={suffix} trigger="view" /></span> : value ?? '—'}
      </div><div className="label">{label}</div>
    </div>)}</>);
  });
}
