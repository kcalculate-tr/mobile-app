// G26-S1 — izin envanteri bekçisi: kaynakta istenmeyen sistem izni çağrısı kalmasın.
//  md.2 ATT (G41-S1: yalnız src/lib/att.ts; soru yalnız Meta kutusu / Gizlilik satırı / tek seferlik kart) · md.3 konum yalnız dokununca · md.4 galeri izni hiç istenmez ·
//  md.6 bildirim sistem penceresi yalnız tek fonksiyonda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '../../../..');
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n === '__tests__' || n === '__component_tests__' || n === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

const files = [...walk(SRC), join(ROOT, 'App.tsx')].map((p) => ({ rel: relative(ROOT, p), src: readFileSync(p, 'utf8') }));
const hits = (re: RegExp) => files.filter((f) => re.test(f.src)).map((f) => f.rel).sort();

test('G41-S1: ATT yerel çağrısı yalnız src/lib/att.ts; soru (requestAttOnce) yalnız metaConsent akışında', () => {
  assert.deepEqual(hits(/requestTrackingPermissions|getTrackingPermissions|expo-tracking-transparency/), ['src/lib/att.ts']);
  assert.deepEqual(hits(/requestAttOnce\(/), ['src/lib/att.ts', 'src/lib/consent/metaConsent.ts']);
  // Açılış yolu (App.tsx, analytics) ATT SORMAZ — yalnız okur.
  const app = files.find((f) => f.rel === 'App.tsx')!.src;
  assert.doesNotMatch(app, /requestAtt|TrackingPermissions/);
  const an = files.find((f) => f.rel === 'src/lib/analytics.ts')!.src;
  assert.doesNotMatch(an, /requestAttOnce|requestTrackingPermissions/);
});

test('galeri (okuma) izni hiç istenmez — sistem seçicisi', () => {
  assert.deepEqual(hits(/requestMediaLibraryPermissionsAsync/), []);
});

test('konum sistem penceresi yalnız tek yardımcıda (askOnce üzerinden)', () => {
  assert.deepEqual(hits(/requestForegroundPermissionsAsync\(/), ['src/modules/eatkcal/v2/model/addressGeocode.ts']);
});

test('bildirim sistem penceresi yalnız tek fonksiyonda (core/push/pushPermission)', () => {
  assert.deepEqual(hits(/Notifications\.requestPermissionsAsync\(/), ['src/core/push/pushPermission.ts']);
  // Eski doğrudan istek yolları kalktı.
  assert.deepEqual(hits(/requestPushPermissionOnly|PushPermissionPrompt'|SocialPushPrompt'/), []);
  const app = files.find((f) => f.rel === 'App.tsx')!.src;
  assert.doesNotMatch(app, /<PushPermissionPrompt/);
});

test('konum/kamera/ses: açılışta (App.tsx) sistem izni yok', () => {
  const app = files.find((f) => f.rel === 'App.tsx')!.src;
  assert.doesNotMatch(app, /request[A-Za-z]*Permission/);
});
