const KEY = 'voice_tutor_audio_preferences';
let preferences = { autoPlay: true, playbackRate: 1 };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  if (typeof saved.autoPlay === 'boolean') preferences.autoPlay = saved.autoPlay;
  if (typeof saved.playbackRate === 'number' && Number.isFinite(saved.playbackRate)) preferences.playbackRate = Math.min(1.25, Math.max(0.6, saved.playbackRate));
} catch { /* Use defaults when storage is unavailable. */ }
export const getAudioPreferences = () => ({ ...preferences });
export function setAudioPreferences(update) {
  preferences = { ...preferences, ...update };
  try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* Keep preferences for this visit. */ }
  window.dispatchEvent(new CustomEvent('tutor:audio-preferences', { detail: getAudioPreferences() }));
}
export function notify(title, description = '', tone = 'done') {
  window.dispatchEvent(new CustomEvent('tutor:toast', { detail: { title, description, tone } }));
}
