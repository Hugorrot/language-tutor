import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import VoicePill from './components/VoicePill';
import WakeSlider from './components/WakeSlider';
import StatusMark from './components/StatusMark';
import SwipeRow from './components/SwipeRow';
import SwipeToast from './components/SwipeToast';
import SquishSwitch from './components/SquishSwitch';
import { api } from '../js/api';
import { getAudioPreferences, setAudioPreferences, notify } from '../js/preferences';
import { readLevels } from '../js/audio';

function AudioPreferences() {
  const [settings, setSettings] = useState(getAudioPreferences);
  useEffect(() => {
    const update = e => setSettings(e.detail);
    window.addEventListener('tutor:audio-preferences', update);
    return () => window.removeEventListener('tutor:audio-preferences', update);
  }, []);
  return <details className="audio-preferences">
    <summary>Make yourself comfortable <span>Audio preferences</span></summary>
    <div className="audio-preferences-body">
      <div className="autoplay-setting"><SquishSwitch label="Play tutor audio automatically" checked={settings.autoPlay}
        onChange={autoPlay => setAudioPreferences({autoPlay})} width={54} height={28} radius={14}
        trackColor="#294649" trackOnColor="#bad7cc" thumbOnColor="#123337" />
        <p>You can still play flashcard audio yourself.</p></div>
      <div className="speed-setting"><label>Tutor playback speed</label>
        <WakeSlider value={settings.playbackRate} min={0.6} max={1.25} step={0.05} bars={28}
          height={40} restHeight={8} gap={3} fillColor="#bad7cc" trackColor="#315155"
          showValue formatValue={v => `${v.toFixed(2)}×`} ariaLabel="Tutor playback speed"
          onChange={playbackRate => setAudioPreferences({playbackRate})} />
        <p>A slower pace can make new words easier to catch.</p></div>
    </div>
  </details>;
}
function Toasts() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    let next = 0;
    const add = e => setToasts(items => [...items.slice(-2), {...e.detail, id: ++next}]);
    window.addEventListener('tutor:toast', add);
    return () => window.removeEventListener('tutor:toast', add);
  }, []);
  return <div className="tutor-toast-stack">{toasts.map(t => <SwipeToast key={t.id} inline title={t.title}
    description={t.description} duration={t.tone === 'failed' ? 0 : 4500} closeButton radius={5}
    background="#24464a" color="#f5eee2" fuseColor="#d9bca9"
    icon={<StatusMark status={t.tone} size={18} doneColor="#b3c7a8" errorColor="#e8a6a6" />}
    onClose={() => setToasts(items => items.filter(item => item.id !== t.id))} />)}</div>;
}
function VoiceControl({ onStart, onStop }) {
  const [state, setState] = useState('idle');
  const [inSession, setInSession] = useState(false);
  const [onTalk, setOnTalk] = useState(true);
  useEffect(() => {
    const update = e => setState(e.detail);
    const view = e => setInSession(e.detail === 'talk-live');
    const route = e => { if (typeof e.detail === 'string' && ['talk','review','progress'].includes(e.detail)) setOnTalk(e.detail === 'talk'); };
    window.addEventListener('tutor:voice-state', update);
    window.addEventListener('tutor:conversation', view);
    window.addEventListener('tutor:view', route);
    return () => { window.removeEventListener('tutor:voice-state', update); window.removeEventListener('tutor:conversation', view); window.removeEventListener('tutor:view', route); };
  }, []);
  return <VoicePill size={44} centered pressScale={1} accentColor="#f4e5d8" iconColor="#bad7cc" background="#2c5355"
    reactive="external" getLevel={() => readLevels()?.level || 0} mode="auto" showTime waveform slideToCancel
    disabled={!inSession || !onTalk || state === 'thinking'} ariaLabel="Record your message"
    onStart={onStart} onStop={onStop} />;
}
function SessionStatus() {
  const [status, setStatus] = useState({status:'pending', label:'Ready when you are'});
  useEffect(() => {
    const voice = e => {
      const labels = {idle:'Ready when you are', listening:'Listening', thinking:'Preparing your reply', speaking:'Tutor is speaking'};
      setStatus({status:e.detail === 'idle' ? 'pending' : 'running', label:labels[e.detail]});
    };
    const explicit = e => setStatus(e.detail);
    window.addEventListener('tutor:voice-state', voice);
    window.addEventListener('tutor:session-status', explicit);
    return () => { window.removeEventListener('tutor:voice-state', voice); window.removeEventListener('tutor:session-status', explicit); };
  }, []);
  return <StatusMark {...status} size={17} fontSize={14} strike={false} color="#bfd3cc" doneColor="#b3c7a8" errorColor="#e8a6a6" />;
}
export function mountSessionWidgets(onStart, onStop) {
  flushSync(() => {
    createRoot(document.getElementById('voice-pill-root')).render(<VoiceControl onStart={onStart} onStop={onStop} />);
    createRoot(document.getElementById('voice-status-root')).render(<SessionStatus />);
  });
}
export function mountPageWidgets() {
  createRoot(document.getElementById('audio-preferences-root')).render(<AudioPreferences />);
  createRoot(document.getElementById('toast-root')).render(<Toasts />);
}
let cardsRoot;
let summarySerial = 0;
export function renderSummaryCards(cards, onChange) {
  cardsRoot ??= createRoot(document.getElementById('summary-cards'));
  // A new session resets pending removals and swipe positions.
  cardsRoot.render(<SummaryCards key={++summarySerial} initial={cards} onChange={onChange} />);
}
function SummaryCards({ initial, onChange }) {
  const [cards, setCards] = useState(initial);
  const [versions, setVersions] = useState({});
  const pending = React.useRef(new Set());
  const remove = async card => {
    if (pending.current.has(card.card_id)) return;
    pending.current.add(card.card_id);
    try {
      await api.deleteCard(card.card_id);
      setCards(items => items.filter(c => c.card_id !== card.card_id));
      onChange();
      notify('Card removed', 'It will no longer appear in your reviews.');
    } catch (err) {
      // Restore a collapsed row when saving failed; do not claim a successful removal.
      setVersions(v => ({...v, [card.card_id]: (v[card.card_id] || 0) + 1}));
      notify('Could not remove the card', err.message, 'failed');
    } finally { pending.current.delete(card.card_id); }
  };
  if (!cards.length) return <li className="muted">No new cards to keep. Your existing cards stay in Review.</li>;
  return <>{cards.map(card => <li className="summary-card-item" key={card.card_id}>
    <SwipeRow key={versions[card.card_id] || 0} label={`Practice card: ${card.front}`} height={100} radius={4}
      actions={[{id:'remove',label:'Remove'}]} rowColor="#1b3e42" drawerColor="#43645d" actionColor="#987463"
      textColor="#f2eee3" fullSwipe onCommit={() => remove(card)}>
      <div className="summary-card-copy"><span>{card.front}</span><strong>{card.back}</strong></div>
      <button type="button" className="card-remove" onClick={() => remove(card)} aria-label={`Remove card: ${card.front}`}>Remove</button>
    </SwipeRow>
  </li>)}</>;
}
