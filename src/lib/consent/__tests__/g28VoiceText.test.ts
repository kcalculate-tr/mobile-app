// G28-S1 md.6 — ses izin metni tutarlı: "telefonun konuşma tanımasıyla yazıya çevrilir" (TR) /
// "converted to text by your phone's speech recognition" (EN) — izin açıklaması (iOS + uygulama
// içi izin ön sayfası) ve AI onay metni aynı ifadeyi kullanır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const TR = 'telefonun konuşma tanımasıyla yazıya çevrilir';
const EN = 'converted to text by your phone’s speech recognition';

test('AI onay metni (sheet + Ayarlar) TR/EN', () => {
  const s = read('src/lib/consent/i18n.ts');
  assert.equal(s.split(TR).length - 1, 2, 'ai_photo_lead + ai_photo_desc');
  assert.equal(s.split(EN).length - 1, 2);
});

test('uygulama içi izin ön sayfası (konuşma tanıma satırı) TR/EN', () => {
  const s = read('src/modules/ai/scan/voice/i18n.ts');
  assert.ok(s.includes(TR));
  assert.ok(s.toLowerCase().includes(EN.toLowerCase()));
});

test('iOS NSSpeechRecognitionUsageDescription (app.config + locales) TR/EN', () => {
  const cfg = read('app.config.js');
  assert.equal(cfg.split(TR).length - 1, 2, 'infoPlist + expo-speech-recognition eklentisi');
  assert.ok(JSON.parse(read('locales/tr.json')).ios.NSSpeechRecognitionUsageDescription.includes(TR));
  assert.ok(JSON.parse(read('locales/en.json')).ios.NSSpeechRecognitionUsageDescription.includes(EN));
});
