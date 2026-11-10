// G20-S2 md.1 — mağaza yapılandırması: derin bağlantı yolları üç yerde aynı
// (iOS AASA içerik dosyası, Android intentFilters, uygulamanın işlediği yollar),
// izin metinleri TR/EN eşit, arka plan konum anahtarı yok, sürüm 1.1.0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(__dirname, '../../..');

type IntentData = { scheme: string; host: string; pathPrefix?: string; path?: string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../../../app.config.js') as {
  expo: {
    version: string;
    plugins: unknown[];
    ios: { associatedDomains: string[]; infoPlist: Record<string, string> };
    android: { intentFilters: { autoVerify?: boolean; data: IntentData[] }[] };
  };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tr = require('../../../locales/tr.json') as { ios: Record<string, string> };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const en = require('../../../locales/en.json') as { ios: Record<string, string> };

const aasa = JSON.parse(readFileSync(join(ROOT, 'docs/store/well-known/apple-app-site-association'), 'utf8')) as {
  applinks: { details: { appIDs: string[]; components: { '/': string }[] }[] };
};

// Uygulamanın tanıdığı yollar: linking.ts (p, u, kesfet) + attribution.ts (k, s).
const EXPECTED = ['/p/*', '/u/*', '/k/*', '/s/*', '/kesfet'];

test('sürüm 1.1.0 (build numarası EAS remote)', () => {
  assert.equal(appConfig.expo.version, '1.1.0');
});

test('AASA içerik dosyası: doğru appID ve beklenen yollar', () => {
  const d = aasa.applinks.details[0];
  assert.deepEqual(d.appIDs, ['A63MT69ASR.com.kcalmobile.app']);
  assert.deepEqual(d.components.map((c) => c['/']).sort(), [...EXPECTED].sort());
  assert.deepEqual(appConfig.expo.ios.associatedDomains, ['applinks:l.eatkcal.com']);
});

test('Android intentFilters AASA ile aynı yollar; önekler "/" ile biter (/privacy yakalanmaz)', () => {
  const f = appConfig.expo.android.intentFilters[0];
  assert.equal(f.autoVerify, true);
  const paths = f.data.map((d) => {
    assert.equal(d.scheme, 'https');
    assert.equal(d.host, 'l.eatkcal.com');
    if (d.pathPrefix) {
      assert.ok(d.pathPrefix.endsWith('/'), `önek "/" ile bitmeli: ${d.pathPrefix}`);
      return `${d.pathPrefix}*`;
    }
    return d.path!;
  });
  assert.deepEqual(paths.sort(), [...EXPECTED].sort());
  for (const page of ['/privacy', '/terms', '/account-deletion', '/']) {
    const hit = f.data.some((d) => (d.pathPrefix ? page.startsWith(d.pathPrefix) : page === d.path));
    assert.equal(hit, false, `${page} uygulamayı açmamalı`);
  }
});

test('linking.ts ve attribution.ts aynı yolları işler', () => {
  const linking = readFileSync(join(ROOT, 'src/navigation/linking.ts'), 'utf8');
  assert.match(linking, /SharedPost: 'p\/:postId'/);
  assert.match(linking, /PublicProfile: 'u\/:handle'/);
  assert.match(linking, /Kesfet: 'kesfet'/);
  const attr = readFileSync(join(ROOT, 'src/lib/metrics/attribution.ts'), 'utf8');
  assert.match(attr, /first === 's'/);
  assert.match(attr, /first === 'k'/);
});

test('konum: yalnız "kullanılırken"; Always anahtarları silinir (false)', () => {
  const loc = appConfig.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location') as
    | [string, Record<string, unknown>]
    | undefined;
  assert.ok(loc, 'expo-location eklentisi');
  assert.equal(loc[1].locationAlwaysAndWhenInUsePermission, false);
  assert.equal(loc[1].locationAlwaysPermission, false);
  assert.equal(loc[1].locationWhenInUsePermission, tr.ios.NSLocationWhenInUseUsageDescription);
  assert.equal(appConfig.expo.ios.infoPlist.NSLocationWhenInUseUsageDescription, tr.ios.NSLocationWhenInUseUsageDescription);
  assert.equal('NSLocationAlwaysUsageDescription' in appConfig.expo.ios.infoPlist, false);
});

test('izin metinleri: TR ve EN aynı anahtarlar, boş yok, EN gerçekten İngilizce', () => {
  assert.deepEqual(Object.keys(en.ios).sort(), Object.keys(tr.ios).sort());
  for (const k of [
    'NSCameraUsageDescription',
    'NSPhotoLibraryUsageDescription',
    'NSPhotoLibraryAddUsageDescription',
    'NSLocationWhenInUseUsageDescription',
  ]) {
    assert.ok(tr.ios[k]?.length > 20, `TR ${k}`);
    assert.ok(en.ios[k]?.length > 20, `EN ${k}`);
    assert.notEqual(en.ios[k], tr.ios[k], `EN ${k} çevrilmemiş`);
    assert.doesNotMatch(en.ios[k], /[ğışĞİŞ]/, `EN ${k} Türkçe karakter içeriyor`);
  }
  // infoPlist (varsayılan TR) locales/tr.json ile birebir.
  for (const [k, v] of Object.entries(tr.ios)) {
    if (k in appConfig.expo.ios.infoPlist) assert.equal(appConfig.expo.ios.infoPlist[k], v, k);
  }
});

test('expo-image-manipulator: bağımlılık var, plugins dizisinde YOK (config plugin yok)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require('../../../package.json') as { dependencies: Record<string, string> };
  assert.ok(pkg.dependencies['expo-image-manipulator']);
  const listed = appConfig.expo.plugins.some(
    (p) => p === 'expo-image-manipulator' || (Array.isArray(p) && p[0] === 'expo-image-manipulator'),
  );
  assert.equal(listed, false);
});

test('gizlilik manifesti GIZLILIK_BEYANLARI.md ile hizalı (G20-S2 md.3)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cfg = require('../../../app.config.js') as {
    expo: { ios: { privacyManifests: { NSPrivacyCollectedDataTypes: Record<string, unknown>[] } } };
  };
  const rows = cfg.expo.ios.privacyManifests.NSPrivacyCollectedDataTypes;
  const by = new Map(rows.map((r) => [String(r.NSPrivacyCollectedDataType).replace('NSPrivacyCollectedDataType', ''), r]));
  for (const t of ['AudioData', 'OtherUserContent', 'CustomerSupport', 'PaymentInfo']) assert.ok(by.has(t), t);
  // Sentry setUser → bağlı
  assert.equal(by.get('CrashData')!.NSPrivacyCollectedDataTypeLinked, true);
  assert.equal(by.get('PerformanceData')!.NSPrivacyCollectedDataTypeLinked, true);
  // G26-S1: ATT kaldırıldı → hiçbir veri türü izleme için toplanmaz.
  const tracked = rows.filter((r) => r.NSPrivacyCollectedDataTypeTracking).map((r) => String(r.NSPrivacyCollectedDataType));
  assert.deepEqual(tracked, []);
  const doc = readFileSync(join(ROOT, 'docs/store/GIZLILIK_BEYANLARI.md'), 'utf8');
  for (const t of by.keys()) assert.ok(doc.includes(t), `belge ${t} türünü anmalı`);
});

test('G26-S1: ATT yok — eklenti, paket, Info.plist anahtarı ve izleme beyanı kaldırıldı', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require('../../../package.json') as { dependencies: Record<string, string> };
  assert.equal(pkg.dependencies['expo-tracking-transparency'], undefined);
  const names = appConfig.expo.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
  assert.equal(names.includes('expo-tracking-transparency'), false);
  const fb = appConfig.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'react-native-fbsdk-next') as [string, Record<string, unknown>];
  assert.equal('iosUserTrackingPermission' in fb[1], false, 'fbsdk eklentisi NSUserTrackingUsageDescription yazmamalı');
  assert.equal(fb[1].advertiserIDCollectionEnabled, false);
  assert.equal(fb[1].isAutoInitEnabled, false);
  assert.equal('NSUserTrackingUsageDescription' in appConfig.expo.ios.infoPlist, false);
  assert.equal('NSUserTrackingUsageDescription' in tr.ios, false);
  assert.equal('NSUserTrackingUsageDescription' in en.ios, false);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cfg = require('../../../app.config.js') as { expo: { ios: { privacyManifests: Record<string, unknown> } } };
  assert.equal(cfg.expo.ios.privacyManifests.NSPrivacyTracking, false);
  assert.equal('NSPrivacyTrackingDomains' in cfg.expo.ios.privacyManifests, false);
  const src = readFileSync(join(ROOT, 'src/lib/analytics.ts'), 'utf8');
  assert.doesNotMatch(src, /tracking-transparency|requestTrackingPermissions/);
});
