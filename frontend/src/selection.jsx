import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import GlideSelect from './components/GlideSelect';
import { t, useUiLanguage } from './i18n';

const roots = new WeakMap();
const theme = { accentColor: '#cce5d8', surfaceColor: '#183438', highlightColor: '#35575a', textColor: '#f2eee4' };
function Choice({ items, selected, onSelect, label }) {
  useUiLanguage();
  const [value, setValue] = useState(selected);
  useEffect(() => setValue(selected), [selected]);
  return <GlideSelect options={items.map(item => ({value:item.value, label:item.label, tag:item.badge ? t('due_tag', { n: item.badge }) : undefined}))}
    value={value} onChange={next => { setValue(next); onSelect(next); }} ariaLabel={label}
    {...theme} size="lg" radius={12} menuWidth={260} />;
}
export function renderChoice(container, items, selected, onSelect) {
  container.dataset.reactWidget = '';
  container.classList.toggle('hidden', items.length === 0);
  if (!roots.has(container)) roots.set(container, createRoot(container));
  const label = { 'language-picker':t('language'), 'explanation-picker':t('explanations_in'), 'profile-explanation':t('explanations_in'),
    'onboarding-target':t('want_learn'), 'onboarding-explanation':t('explanations_in'), scenarios:t('topic'),
    'review-languages':t('language'), 'progress-languages':t('language') }[container.id] || '';
  flushSync(() => roots.get(container).render(<Choice items={items} selected={selected} onSelect={onSelect} label={label} />));
}
