// G29-S1 md.1 — yerel modül / eklenti / migration bekçisi (native derleme burada yapılamıyor;
// EAS'ta doğrulanacak kritik noktalar kaynakta sabitlenir).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const MOD = 'modules/subject-lift';

test('autolinking: ./modules altında Expo modül yapılandırması (iOS + Android, aynı ad)', () => {
  const cfg = JSON.parse(read(`${MOD}/expo-module.config.json`));
  assert.deepEqual(cfg.platforms, ['apple', 'android']);
  assert.deepEqual(cfg.apple.modules, ['SubjectLiftModule']);
  assert.deepEqual(cfg.android.modules, ['expo.modules.subjectlift.SubjectLiftModule']);
  assert.match(read(`${MOD}/ios/SubjectLiftModule.swift`), /Name\("SubjectLift"\)/);
  assert.match(read(`${MOD}/android/src/main/java/expo/modules/subjectlift/SubjectLiftModule.kt`), /Name\("SubjectLift"\)/);
  assert.match(read('src/lib/sticker/subjectLift.ts'), /requireOptionalNativeModule\('SubjectLift'\)/);
});

test('iOS: Vision ön plan maskesi yalnız iOS 17+ (#available), dağıtım hedefi 15.1 korunur', () => {
  const swift = read(`${MOD}/ios/SubjectLiftModule.swift`);
  assert.match(swift, /VNGenerateForegroundInstanceMaskRequest/);
  assert.match(swift, /@available\(iOS 17\.0, \*\)\s*\nenum SubjectLifter/);
  assert.match(swift, /if #available\(iOS 17\.0, \*\)/);
  assert.match(swift, /guard #available\(iOS 17\.0, \*\)/);
  assert.match(swift, /canImport\(SDWebImageWebPCoder\)/, 'WebP kodlayıcı yoksa PNG yedeği');
  assert.doesNotMatch(swift, /URLSession|http/, 'ağ yok');
  const pod = read(`${MOD}/ios/SubjectLift.podspec`);
  assert.match(pod, /:ios => '15\.1'/);
  assert.match(pod, /s\.dependency 'SDWebImageWebPCoder'/);
});

test('Android: yalnız onaylı ML Kit bağımlılığı; ağ yok', () => {
  const gradle = read(`${MOD}/android/build.gradle`);
  const deps = gradle.match(/implementation\s+"[^"]+"/g) ?? [];
  assert.deepEqual(deps, ['implementation "com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1"']);
  const kt = read(`${MOD}/android/src/main/java/expo/modules/subjectlift/SubjectLiftModule.kt`);
  assert.match(kt, /SubjectSegmentation\.getClient/);
  assert.match(kt, /enableForegroundBitmap\(\)/);
  assert.match(kt, /addOnFailureListener/);
  assert.match(kt, /WEBP_LOSSY/);
  assert.doesNotMatch(kt, /HttpURLConnection|okhttp/i, 'ağ yok');
});

test('config eklentisi: app.config plugins listesinde; ML Kit meta-data barcode_ui ile birleşir', () => {
  assert.match(read('app.config.js'), /'\.\/modules\/subject-lift\/app\.plugin\.js'/);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const plugin = require(join(ROOT, MOD, 'app.plugin.js'));
  assert.equal(typeof plugin, 'function');
  assert.equal(plugin.mergeMlkitDependencies(undefined), 'barcode_ui,subject_segment');
  assert.equal(plugin.mergeMlkitDependencies('barcode_ui'), 'barcode_ui,subject_segment');
  assert.equal(plugin.mergeMlkitDependencies('ocr,subject_segment'), 'ocr,subject_segment,barcode_ui');
  assert.equal(plugin.MIN_IOS, 17);
  assert.match(read(`${MOD}/app.plugin.js`), /'tools:replace': 'android:value'/);
});

test('npm paketi eklenmedi (package.json bağımlılıklarında subject-lift / mlkit yok)', () => {
  const pkg = JSON.parse(read('package.json'));
  const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.equal(all.some((d) => /subject|mlkit|segment/i.test(d)), false);
});

test('migration DOSYASI + rollback; mevcut liste sorguları sticker_path SEÇMEZ (uygulanmamışken güvenli)', () => {
  const mig = 'supabase/migrations/20261111233100_g29_sticker_path.sql';
  const rb = 'supabase/rollbacks/20261111233100_g29_sticker_path_rollback.sql';
  assert.ok(existsSync(join(ROOT, mig)) && existsSync(join(ROOT, rb)));
  assert.match(read(mig), /add column if not exists sticker_path text/);
  assert.match(read(rb), /drop column if exists sticker_path/);
  for (const f of ['src/screens/TrackerScreen.tsx', 'src/modules/gun/todayConsumptions.ts']) {
    assert.doesNotMatch(read(f), /sticker_path/, f);
  }
});

test('ScanScreen: çıkartma analizle paralel başlar, Logla beklemez (arka planda kayıt), uçuş çıkartmadan', () => {
  const src = read('src/modules/ai/scan/screens/ScanScreen.tsx');
  assert.match(src, /startStickerLift\(uri\)/);
  assert.match(src, /void liftSticker\(uri\)/);
  assert.match(src, /void saveStickerInBackground\(/);
  assert.doesNotMatch(src, /await saveStickerInBackground|await liftSticker/);
  assert.match(src, /cutout: !!liftedSticker/);
});
