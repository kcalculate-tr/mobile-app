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
  assert.deepEqual([...allPanoNames()].sort(), finals);
});
