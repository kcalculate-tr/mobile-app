// i18n çekirdeği birim testleri — SAF modül (core/dictionaries). expo-localization
// ve AsyncStorage import EDİLMEZ (tsx --test Node'da koşar). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { translate, formatNumber, getI18n } from '../core';
import { SUPPORTED_LANGS, DEFAULT_LANG, translations } from '../dictionaries';

// ── 1) Temel çeviri + dil geçişi ────────────────────────────────────────────
test('translate: dil geçişi — aynı anahtar TR/EN farklı değer', () => {
  assert.equal(translate('tr', 'kesfet.title'), 'Keşfet');
  assert.equal(translate('en', 'kesfet.title'), 'Discover');
});

test('translate: değişken enterpolasyonu (%{meal})', () => {
  assert.equal(translate('tr', 'kesfet.added_toast', { meal: 'Öğle' }), 'Öğle’ye loglandı');
  assert.equal(translate('en', 'kesfet.added_toast', { meal: 'Lunch' }), 'Logged to Lunch');
});

// ── 2) Geri dönüş (fallback): EN eksikse TR (defaultLocale) ──────────────────
test('i18n: EN eksik anahtar TR’ye geri döner (enableFallback)', () => {
  // Sözlükler simetrik; fallback'i kanıtlamak için yalnız TR'ye bir sonda ekle.
  getI18n().store({ tr: { __probe: { only_tr: 'TR değeri' } } });
  assert.equal(translate('en', '__probe.only_tr'), 'TR değeri');
  assert.equal(translate('tr', '__probe.only_tr'), 'TR değeri');
});

test('i18n: hiç olmayan anahtar patlamaz (guess)', () => {
  const out = translate('tr', 'kesfet.bu_anahtar_yok');
  assert.equal(typeof out, 'string');
  assert.ok(out.length > 0);
});

// ── 3) Çoğul ({one, other}) ─────────────────────────────────────────────────
test('plural: count ile one/other seçilir (EN)', () => {
  assert.equal(translate('en', 'kesfet.stats.likes', { count: 1 }), '1 like');
  assert.equal(translate('en', 'kesfet.stats.likes', { count: 5 }), '5 likes');
});

test('plural: TR count enterpolasyonu', () => {
  assert.equal(translate('tr', 'gun.streak', { count: 7 }), '7 günlük seri');
});

// ── 4) Sayı biçimi (yerele göre ayraç) ──────────────────────────────────────
test('formatNumber: TR binlik "." ondalık ","', () => {
  assert.equal(formatNumber('tr', 1234), '1.234');
  assert.equal(formatNumber('tr', 1234.5, { precision: 1 }), '1.234,5');
});

test('formatNumber: EN binlik "," ondalık "."', () => {
  assert.equal(formatNumber('en', 1234), '1,234');
  assert.equal(formatNumber('en', 1234.5, { precision: 1 }), '1,234.5');
});

// ── 5) Sözlük bütünlüğü: her iki dil de aynı üst namespace'lere sahip ────────
test('dictionaries: TR ve EN aynı üst seviye namespace’leri taşır', () => {
  const trKeys = Object.keys(translations.tr).sort();
  const enKeys = Object.keys(translations.en).sort();
  assert.deepEqual(trKeys, enKeys);
  assert.ok((SUPPORTED_LANGS as readonly string[]).includes(DEFAULT_LANG));
});
