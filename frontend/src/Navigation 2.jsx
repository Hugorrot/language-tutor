import React, { useEffect, useRef, useState } from 'react';
import Dock from './components/Dock';

function Glyph({ type }) {
  const paths = {
    talk: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 3v-7A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 10h8M8 14h5"/></>,
    review: <><rect x="6" y="5" width="14" height="16" rx="2"/><path d="M16 5V3H3v15h3M10 10h6M10 14h4"/></>,
    progress: <><path d="M4 20h17M6 16v-4M12 16V8M18 16V3"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}
export default function Navigation() {
  const [active, setActive] = useState(location.hash.slice(1) || 'talk');
  const [due, setDue] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const touchTimer = useRef(null);
  const revealTap = useRef(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ref = useRef(null);
  useEffect(() => {
    const route = () => setActive(location.hash.slice(1) || 'talk');
    const badge = e => setDue(e.detail);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    window.addEventListener('hashchange', route);
    window.addEventListener('tutor:due', badge);
    media.addEventListener('change', motion);
    return () => { window.removeEventListener('hashchange', route); window.removeEventListener('tutor:due', badge); media.removeEventListener('change', motion); };
  }, []);
  useEffect(() => () => clearTimeout(touchTimer.current), []);
  const touchReveal = event => {
    if (event.pointerType === 'mouse') { revealTap.current = false; return; }
    revealTap.current = !expanded;
    setExpanded(true);
    clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setExpanded(false), 3500);
  };
  const items = ['talk', 'review', 'progress'].map((key, i) => ({
    label: ['Talk', 'Review', 'Progress'][i], icon: <span className="nav-glyph"><Glyph type={key} /><span>{['Talk','Review','Progress'][i]}</span></span>,
    active: active === key, badge: key === 'review' && due > 0 ? due : undefined,
    className: active === key ? 'is-current' : '',
    onClick: () => { location.hash = key; },
  }));
  return <nav ref={ref} className="site-dock-slot" data-expanded={expanded || undefined}
      aria-label="Learning sections" onPointerDownCapture={touchReveal}
      onClickCapture={event => {
        if (revealTap.current) { event.preventDefault(); event.stopPropagation(); revealTap.current = false; }
      }}>
      <Dock items={items} baseItemSize={70} magnification={reduced ? 70 : 82}
        panelHeight={90} gap={8} roundness={0.32} bounce={!reduced}
        showLabels={false} accentColor="#bad7cc" badgeColor="#96715f" className="tutor-dock" />
    </nav>;
}
