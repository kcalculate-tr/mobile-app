// G17-S1 — bu oturumda eklenen metin anahtarları çalışma anı sözlüğünde (tr + en)
// var mı? (Akış denetiminde özet ekranında anahtar adı göründü: v2/i18n kaynağına
// eklenip dictionaries.ts'e eklenmemişti.) SAF. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { translations } from '../dictionaries';

const KEYS = [
  'eatkcal.v2.checkout.pick_method_time',
  'ai_scan.camera_open_title',
  'ai_scan.camera_open_body',
  'ai_scan.camera_open_cta',
];

function get(obj: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

for (const lang of ['tr', 'en'] as const) {
  test(`G17 metin anahtarları (${lang}) sözlükte var`, () => {
    for (const k of KEYS) assert.equal(typeof get(translations[lang], k), 'string', `${lang}: ${k} yok`);
  });
}

test('G17 md.9: Final sözlük metinlerinde dekoratif nokta ayracı (" · ") kalmadı', () => {
  const bad: string[] = [];
  const walk = (o: unknown, p: string) => {
    if (typeof o === 'string') {
      if (o.includes(' · ') || o.includes(' • ')) bad.push(p);
    } else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
  };
  walk(translations.tr, 'tr');
  walk(translations.en, 'en');
  assert.deepEqual(bad, []);
});
