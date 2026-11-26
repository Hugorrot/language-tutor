import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import GlideSelect from './components/GlideSelect';

const roots = new WeakMap();
const theme = { accentColor: '#cce5d8', surfaceColor: '#183438', highlightColor: '#35575a', textColor: '#f2eee4' };
function Choice({ items, selected, onSelect, label }) {
  const [value, setValue] = useState(selected);
  useEffect(() => setValue(selected), [selected]);
  return <GlideSelect options={items.map(item => ({value:item.value, label:item.label, tag:item.badge ? `${item.badge} due` : undefined}))}
    value={value} onChange={next => { setValue(next); onSelect(next); }} ariaLabel={label}
    {...theme} size="lg" radius={12} menuWidth={260} />;
}
export function renderChoice(container, items, selected, onSelect) {
  container.dataset.reactWidget = '';
  container.classList.toggle('hidden', items.length === 0);
  if (!roots.has(container)) roots.set(container, createRoot(container));
  const label = { 'language-picker':'Conversation language', scenarios:'Conversation topic', 'review-languages':'Review language', 'progress-languages':'Progress language' }[container.id] || 'Choose an option';
  flushSync(() => roots.get(container).render(<Choice items={items} selected={selected} onSelect={onSelect} label={label} />));
}
export function mountFormChoices() {
  document.querySelectorAll('#onboarding select').forEach(select => {
    const label = [...select.parentElement.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
    const items = [...select.options].map(option => ({value:option.value,label:option.text}));
    const host = document.createElement('div');
    host.dataset.reactWidget = '';
    host.className = 'form-choice';
    select.hidden = true;
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.after(host);
    flushSync(() => createRoot(host).render(<Choice items={items} selected={select.value} onSelect={value => {select.value=value;}} label={label} />));
  });
}
