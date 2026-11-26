// React side of the interface translations (js/i18n.js). A component that calls useUiLanguage()
// re-renders when the learner changes the explanation language, so its t() texts follow.
import { useEffect, useState } from 'react';
import { getUiLanguage, t } from '../js/i18n.js';

export function useUiLanguage() {
  const [language, setLanguage] = useState(getUiLanguage);
  useEffect(() => {
    const update = e => setLanguage(e.detail);
    window.addEventListener('tutor:ui-language', update);
    return () => window.removeEventListener('tutor:ui-language', update);
  }, []);
  return language;
}

export { t };
