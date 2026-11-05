// eatkcal v2 (G13-S2 md.8/md.11) — `yeni_siparis` kapalıyken v2 HİÇBİR YERDE görünmez.
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { EK_V2_ROUTE_NAMES, ekV2RouteNames, resolveHomeTab } from '../routeTable';
import { FLAG_DEFAULTS } from '../../../../core/flags/registry';

test('yeni_siparis yerel varsayılanı false', () => {
  assert.equal(FLAG_DEFAULTS.yeni_siparis, false);
});

test('kapalı → stack’e tek bir v2 rotası kaydolmaz', () => {
  assert.deepEqual([...ekV2RouteNames(false)], []);
  assert.deepEqual([...ekV2RouteNames(true)], [...EK_V2_ROUTE_NAMES]);
});

test('kapalı → Home sekmesi bugünkü kuralla aynı (restoran_yakinda → EatHome, değilse HomeScreen)', () => {
  assert.equal(resolveHomeTab({ yeniSiparis: false, restoranYakinda: false }), 'legacy');
  assert.equal(resolveHomeTab({ yeniSiparis: false, restoranYakinda: true }), 'eatHome');
  assert.equal(resolveHomeTab({ yeniSiparis: true, restoranYakinda: false }), 'v2');
  assert.equal(resolveHomeTab({ yeniSiparis: true, restoranYakinda: true }), 'v2');
});

test('v2 rota adları mevcut kök rotalarla çakışmaz (hepsi Ek* öneki)', () => {
  const types = fs.readFileSync(path.join(__dirname, '../../../../navigation/types.ts'), 'utf8');
  for (const name of EK_V2_ROUTE_NAMES) {
    assert.ok(name.startsWith('Ek'), name);
    assert.ok(!new RegExp(`\\b${name}\\s*:`).test(types), `${name} RootStackParamList'te zaten var`);
  }
});

test('AppNavigator: v2 kaydı yalnız ekV2Routes(yeniSiparis) ve resolveHomeTab üzerinden', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../../../navigation/AppNavigator.tsx'), 'utf8');
  assert.match(src, /ekV2Routes\(yeniSiparis\)\.map/);
  assert.match(src, /const yeniSiparis = useColdStartFeature\('yeni_siparis'\)/);
  assert.match(src, /resolveHomeTab\(\{ yeniSiparis, restoranYakinda \}\)/);
  // v2 ekranları AppNavigator'da doğrudan import edilmez (yalnız routes üzerinden).
  assert.doesNotMatch(src, /eatkcal\/v2\/screens\//);
});
