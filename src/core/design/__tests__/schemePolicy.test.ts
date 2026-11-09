// G21-S1 md.3 — Tema telefonu izler: app.config üç yerde 'automatic'; yeni kabuk
// sistemi izler, eski kabuk (bayrak kapalı) açık temada kalır (parite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveAppScheme } from '../schemePolicy';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../../../../app.config.js') as {
  expo: { userInterfaceStyle: string; ios: { userInterfaceStyle: string }; android: { userInterfaceStyle: string } };
};
const ROOT = join(__dirname, '../../../..');

test('app.config: kök + iOS + Android userInterfaceStyle = automatic', () => {
  assert.equal(appConfig.expo.userInterfaceStyle, 'automatic');
  assert.equal(appConfig.expo.ios.userInterfaceStyle, 'automatic');
  assert.equal(appConfig.expo.android.userInterfaceStyle, 'automatic');
});

test('yeni kabuk: sistem teması (force yok, native yok, durum çubuğu auto)', () => {
  assert.deepEqual(resolveAppScheme({ ready: true, yeniKabuk: true }), { force: undefined, native: undefined, statusBar: 'auto' });
});

test('eski kabuk: açık tema + native açık + koyu ikonlu durum çubuğu (parite)', () => {
  assert.deepEqual(resolveAppScheme({ ready: true, yeniKabuk: false }), { force: 'light', native: 'light', statusBar: 'dark' });
});

test('bayrak çözülmeden: açık tema, native dokunulmaz', () => {
  assert.deepEqual(resolveAppScheme({ ready: false, yeniKabuk: true }), { force: 'light', native: undefined, statusBar: 'dark' });
});

test('App.tsx kökü AppSchemeGate ile sarar; sabit "dark" kök durum çubuğu kalktı', () => {
  const app = readFileSync(join(ROOT, 'App.tsx'), 'utf8');
  assert.match(app, /<AppSchemeGate>/);
  assert.doesNotMatch(app, /<StatusBar style="dark" \/>/);
});
