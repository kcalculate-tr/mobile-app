import '../src/index.css';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Campaigns from '../src/pages/admin/Campaigns.jsx';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function setVal(el, v) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
function Saved() {
  const [s, setS] = useState(null);
  useEffect(() => { const h = () => setS(window.__saved); window.addEventListener('g55-saved', h); return () => window.removeEventListener('g55-saved', h); }, []);
  if (!s) return null;
  return <pre id="saved" style={{ margin: 16, padding: 12, background: '#111', color: '#9f6', fontSize: 12, borderRadius: 8 }}>
    {`Kayıt yükü (${s.table}.${s.op}):\n` + JSON.stringify(s.payload, null, 2)}
  </pre>;
}
createRoot(document.getElementById('root')).render(<><Campaigns /><Saved /></>);

(async () => {
  const mode = new URLSearchParams(location.search).get('m') || 'filled';
  await sleep(600);
  [...document.querySelectorAll('button')].find((b) => /Yeni Kampanya/.test(b.textContent))?.click();
  await sleep(400);
  if (mode === 'empty') return;
  setVal(document.querySelector('input[placeholder^="Örn: 24 Nisan"]'), 'Hafta sonu menüsü');
  setVal(document.querySelector('input[placeholder^="Örn: Sürpriz"]'), 'Hafta sonu menüsü geldi 🍲');
  setVal(document.querySelector('textarea[placeholder^="Örn: Bugüne"]'), 'Yeni tabaklar seni bekliyor. Bir göz at!');
  setVal(document.getElementById('campaign-title-en'), 'The weekend menu is here 🍲');
  if (mode !== 'partial') setVal(document.getElementById('campaign-body-en'), 'New dishes are waiting for you. Take a look!');
  await sleep(300);
  if (mode === 'filled') return;
  [...document.querySelectorAll('button')].find((b) => /Taslak Kaydet/.test(b.textContent))?.click();
})();
