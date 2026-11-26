import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Orb from './components/Orb';

const colors = {
  idle: ['#e7bcaa', '#9cd0c0', '#14383b'],
  listening: ['#bddfce', '#86c7bc', '#194a4b'],
  thinking: ['#e8c3b1', '#afc8be', '#2a4644'],
  speaking: ['#9dd2cb', '#f0d1b8', '#1e4a4c'],
};

// Keep the conversation controller's state/levels interface independent of React.
export function createOrb(element, readLevels = () => null) {
  const root = createRoot(element);
  let update;
  const controller = {
    state: 'idle',
    setState(state) { this.state = state; update?.(state); },
    destroy() { root.unmount(); },
  };
  function VoiceOrb() {
    const [state, setState] = useState(controller.state);
    const [level, setLevel] = useState(0);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
      update = setState;
      const observer = new IntersectionObserver(entries => setVisible(entries.some(e => e.isIntersecting)));
      observer.observe(element);
      return () => { observer.disconnect(); update = null; };
    }, []);
    useEffect(() => {
      if (!visible || !['listening', 'speaking'].includes(state)) { setLevel(0); return; }
      const timer = setInterval(() => setLevel(readLevels()?.level || 0), 90);
      return () => clearInterval(timer);
    }, [state, visible]);
    return <Orb colors={colors[state] || colors.idle} backgroundColor="#000000"
      hoverIntensity={0.6} trail={0.7} rotateOnHover followCursor dpr={1.5}
      paused={!visible} forceHoverState={state === 'listening' || state === 'speaking'}
      glow={0.7 + level * 0.6} size={0.87 + level * 0.08}
      speed={state === 'thinking' ? 1.7 : 0.7 + level * 0.7} />;
  }
  root.render(<VoiceOrb />);
  return controller;
}
