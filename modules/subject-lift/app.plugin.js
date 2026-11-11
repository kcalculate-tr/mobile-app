// G29-S1 md.1 — subject-lift config eklentisi (app.config.js `plugins`).
//
// Android: ML Kit modeli Play hizmetleriyle kurulumda insin diye
//   <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="…,subject_segment"/>
// expo-camera (ve expo-dev-launcher) aynı anahtarı `barcode_ui` ile kendi manifest'inde yazıyor;
// farklı değer manifest birleştirmede ÇAKIŞMA hatası verir. Bu yüzden değerler birleştirilir
// (virgüllü liste, ML Kit bunu destekler) ve `tools:replace="android:value"` eklenir.
//
// iOS: ek ayar yok. Dağıtım hedefi 17'nin altındaysa (Expo SDK 54 varsayılanı 15.1) özellik
// çalışma anında kapalıdır (`#available(iOS 17.0, *)`); eklenti yalnız bilgi verir.
const { AndroidConfig, withAndroidManifest, withPodfileProperties } = require('expo/config-plugins');

const MLKIT_KEY = 'com.google.mlkit.vision.DEPENDENCIES';
/** Bağımlılık kütüphanelerinin yazdığı değerler (ezilmesinler). */
const KNOWN_LIBRARY_VALUES = ['barcode_ui'];
const SUBJECT_SEGMENT = 'subject_segment';
const MIN_IOS = 17;

/** Virgüllü ML Kit listesi: mevcut + bilinen kütüphane değerleri + subject_segment (tekrarsız, sıralı). */
function mergeMlkitDependencies(existing) {
  const parts = String(existing || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const all = [...parts, ...KNOWN_LIBRARY_VALUES, SUBJECT_SEGMENT];
  return Array.from(new Set(all)).join(',');
}

/** "15.1" → 15.1; geçersizse null. */
function parseIosTarget(value) {
  const n = parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : null;
}

function withSubjectLiftAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    AndroidConfig.Manifest.ensureToolsAvailable(manifest);
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const items = Array.isArray(app['meta-data']) ? app['meta-data'] : [];
    const current = items.find((i) => i && i.$ && i.$['android:name'] === MLKIT_KEY);
    const value = mergeMlkitDependencies(current && current.$['android:value']);
    app['meta-data'] = [
      ...items.filter((i) => !(i && i.$ && i.$['android:name'] === MLKIT_KEY)),
      { $: { 'android:name': MLKIT_KEY, 'android:value': value, 'tools:replace': 'android:value' } },
    ];
    return cfg;
  });
}

function withSubjectLiftIos(config) {
  return withPodfileProperties(config, (cfg) => {
    const target = parseIosTarget(cfg.modResults['ios.deploymentTarget']) ?? 15.1;
    if (target < MIN_IOS) {
      // Derlemeyi bozmaz: modül 15.1'de derlenir, özellik iOS 17+ cihazda açılır.
      console.log(`[subject-lift] iOS dağıtım hedefi ${target} < ${MIN_IOS}: çıkartma iOS ${MIN_IOS} altı cihazlarda kapalı (çalışma anı kontrolü).`);
    }
    return cfg;
  });
}

function withSubjectLift(config) {
  return withSubjectLiftIos(withSubjectLiftAndroid(config));
}

module.exports = withSubjectLift;
module.exports.mergeMlkitDependencies = mergeMlkitDependencies;
module.exports.parseIosTarget = parseIosTarget;
module.exports.MLKIT_KEY = MLKIT_KEY;
module.exports.MIN_IOS = MIN_IOS;
