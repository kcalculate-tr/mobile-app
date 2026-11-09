// G21-S1 md.8 (akış denetimi) — kodda SABİT metinle çağrılan her çeviri anahtarı
// TR ve EN sözlüğünde çözülmeli (yoksa ekranda ham anahtar görünür: "profil.xyz").
// Kapsam: `t('a.b')`, `tr('a.b')`, `tt('a.b')`, `i18n.t('a.b')` biçimindeki DÜZ
// dizgeler; şablonlu (`${}`) ve değişkenli çağrılar atlanır. Kendi sözlüğü olan
// modüller (onboarding/v2/i18n) ve __DEV__ vitrini kapsam dışı.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { translations } from '../dictionaries';

const SRC = path.resolve(__dirname, '../../..');
const SKIP = /__tests__|__component_tests__|[\\/]src[\\/]dev[\\/]|onboarding[\\/]v2[\\/]|node_modules/;
const CALL = /(?:^|[^A-Za-z0-9_.])(?:t|tr|tt|tPush|i18n\.t)\(\s*'([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)'/g;

function files(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (SKIP.test(p)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

function resolves(dict: unknown, key: string): boolean {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (!cur || typeof cur !== 'object' || !(part in (cur as object))) return false;
    cur = (cur as Record<string, unknown>)[part];
  }
  // yaprak dizge ya da çoğul nesnesi ({ one, other })
  return typeof cur === 'string' || (!!cur && typeof cur === 'object' && 'other' in (cur as object));
}

// Sözlüğün kök ad alanları — başka bir t() (ör. yerel değişken) çağrısını ayırmak için.
const ROOTS = new Set(Object.keys(translations.tr));

test('usedKeysExist: koddaki sabit çeviri anahtarları TR ve EN sözlükte var', () => {
  const missing: string[] = [];
  for (const f of files(SRC)) {
    const text = fs.readFileSync(f, 'utf8');
    let m: RegExpExecArray | null;
    CALL.lastIndex = 0;
    while ((m = CALL.exec(text))) {
      const key = m[1];
      if (!ROOTS.has(key.split('.')[0])) continue;
      const okTr = resolves(translations.tr, key);
      const okEn = resolves(translations.en, key);
      if (!okTr || !okEn) missing.push(`${path.relative(SRC, f)} → ${key}${okTr ? '' : ' [TR]'}${okEn ? '' : ' [EN]'}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});
