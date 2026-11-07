// G17-S2 md.3 — expo-camera eklentisi: iOS kamera izin metni locales/tr.json
// `ios` bloğundaki metinle birebir; Android yalnız CAMERA (RECORD_AUDIO yok).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../../../../../app.config.js') as {
  expo: { plugins: unknown[]; ios: { infoPlist: Record<string, string> }; android: { permissions: string[] } };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const trLocale = require('../../../../../locales/tr.json') as { ios: Record<string, string> };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../../../../../package.json') as { dependencies: Record<string, string> };

function cameraPlugin(): Record<string, unknown> | null {
  for (const p of appConfig.expo.plugins) {
    if (Array.isArray(p) && p[0] === 'expo-camera') return (p[1] ?? {}) as Record<string, unknown>;
    if (p === 'expo-camera') return {};
  }
  return null;
}

test('expo-camera bağımlılık + eklenti kayıtlı', () => {
  assert.ok(pkg.dependencies['expo-camera'], 'package.json dependencies');
  assert.ok(cameraPlugin(), 'app.config plugins');
});

test('cameraPermission = locales/tr.json ios.NSCameraUsageDescription (ve infoPlist aynı)', () => {
  const opts = cameraPlugin()!;
  assert.equal(opts.cameraPermission, trLocale.ios.NSCameraUsageDescription);
  assert.equal(appConfig.expo.ios.infoPlist.NSCameraUsageDescription, trLocale.ios.NSCameraUsageDescription);
  assert.equal(opts.microphonePermission, trLocale.ios.NSMicrophoneUsageDescription);
});

test('Android: CAMERA izni var, kamera eklentisi ses kaydı izni EKLEMEZ', () => {
  assert.ok(appConfig.expo.android.permissions.includes('CAMERA'));
  assert.equal(cameraPlugin()!.recordAudioAndroid, false);
});
