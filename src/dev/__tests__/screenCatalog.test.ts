// G14-S1 — Ekran vitrini kataloğu: her Final panosunun kaydı var, URL/Dark çözümü doğru.
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  FINAL_FLAGS,
  SCREEN_CATALOG,
  allPanoNames,
  parseVitrinUrl,
  resolvePano,
} from '../screenCatalog';
import { FLAG_KEYS } from '../../core/flags/registry';

// Final pano listesi (design/final/png, 6 Kasım) — referans görsel adları.
const FINAL_PNG_DIR = path.resolve(__dirname, '../../../../../night/design/final/png');

test('her katalog bayrağı kayıt defterinde var', () => {
  for (const f of FINAL_FLAGS) assert.ok(FLAG_KEYS.includes(f), f);
  for (const e of Object.values(SCREEN_CATALOG)) {
    for (const f of e.flags) assert.ok(FLAG_KEYS.includes(f), `${e.pano}:${f}`);
  }
});

test('URL ayrıştırma', () => {
  assert.equal(parseVitrinUrl('kcal://dev/screen/FinFeed'), 'FinFeed');
  assert.equal(parseVitrinUrl('kcal:///dev/screen/FinEkCart-Dark?x=1'), 'FinEkCart-Dark');
  assert.equal(parseVitrinUrl('exp+kcal://dev/screen/FinTabBar-mid'), 'FinTabBar-mid');
  assert.equal(parseVitrinUrl('kcal://p/abc'), null);
  assert.equal(parseVitrinUrl(null), null);
});

test('-Dark çözümü ve bilinmeyen ad', () => {
  assert.equal(resolvePano('FinFeed')?.scheme, 'light');
  assert.equal(resolvePano('FinFeed-Dark')?.scheme, 'dark');
  assert.equal(resolvePano('FinStressDark')?.scheme, 'dark');
  assert.equal(resolvePano('FinMoRing-Dark'), null); // hareket panolarının Dark'ı yok
  assert.equal(resolvePano('FinYok'), null);
});

test('durumlar: boş / yükleniyor / EN / XL / guest', () => {
  assert.equal(resolvePano('FinEkCartEmpty')?.data, 'empty');
  assert.equal(resolvePano('FinEkHomeSkeleton')?.data, 'loading');
  assert.equal(resolvePano('FinHomeEN')?.lang, 'en');
  assert.equal(resolvePano('FinHomeXL')?.textSize, 'accessibility-extra-large');
  assert.equal(resolvePano('FinOnbWelcome')?.auth, 'guest');
  assert.equal(resolvePano('FinTabBar-min')?.collapse, 1);
});

test('katalog = Final görselleri (birebir, Light + Dark)', { skip: !fs.existsSync(FINAL_PNG_DIR) }, () => {
  const finals = fs
    .readdirSync(FINAL_PNG_DIR)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.slice(0, -'.webp'.length))
    .sort();
  // G15-S1: Final'de tek panoda 3 panel olan akışların adım çekimleri (ek kayıtlar).
  // G17-S2: FinOnbIntent Final'den çıktı (8 Kas, Tur 26) — Niyet adımı G17-S1 md.4 ile
  // akış dışı; bileşen ve vitrin kaydı korunur (silme yok).
  const EXTRA = /^Fin(LoginEmail|LoginCode|SignupAIHandle|SignupAIProfile|SignupEatAddress|SignupEatPhone|OnbIntent)(-Dark)?$/;
  // G17-S2: Tur 26 panoları (design/final/png, 8 Kas 19:37) henüz uygulanmadı → G18.
  // G18 her panoyu kataloğa ekledikçe buradan SİLER; liste boşalınca kural yine birebir.
  const PENDING_TUR26 = new Set(
    [
      'FinCelebrateProfile', 'FinEkOrderSuccess', 'FinFeedEmpty', 'FinHomeFocusB', 'FinHomeFocusC',
      'FinHomeIzmir', 'FinHomeOutside', 'FinHomeProfileCard', 'FinOnbAccountEmail', 'FinOnbAccountKeyboard',
      'FinOpen', 'FinOrient1', 'FinOrient2', 'FinOrient3', 'FinOrient4', 'FinPush', 'FinWaitlistAdd',
      'FinWaitlistSuggest',
    ].flatMap((n) => [n, `${n}-Dark`]).concat([
      'FinMoFocus', 'FinMoOpen', 'FinMoPopover', 'FinOnbWelcomeB', 'FinOnbWelcomeC', 'FinOnbWelcomeEN', 'FinTur26',
    ]),
  );
  assert.deepEqual(
    [...allPanoNames()].filter((n) => !EXTRA.test(n)).sort(),
    finals.filter((n) => !PENDING_TUR26.has(n)),
  );
});
