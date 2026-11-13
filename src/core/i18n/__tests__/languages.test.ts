// G22-S2 md.6 — dil seçici kayıt tablosu (saf).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LANGUAGES,
  SYSTEM_PREF,
  enabledLanguages,
  isLangPref,
  languageSubtitle,
  resolveLang,
  pickDeviceLang,
  DEVICE_FALLBACK_LANG,
  type LanguageEntry,
} from '../languages';
import { SUPPORTED_LANGS } from '../dictionaries';
import { translate } from '../core';

test('şimdilik yalnız TR ve EN etkin, kayıt sırasıyla', () => {
  assert.deepEqual(enabledLanguages().map((l) => l.code), ['tr', 'en']);
});

test('her satır: dilin KENDİ adı + bayrak; ad her zaman metin', () => {
  const byCode = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));
  assert.equal(byCode.tr.nativeName, 'Türkçe');
  assert.equal(byCode.en.nativeName, 'English');
  for (const l of LANGUAGES) {
    assert.ok(l.flag, `${l.code} bayrak`);
    assert.ok(l.nativeName.trim().length > 0);
  }
});

test('alt satır: o dilin İngilizce/Türkçe adı (arayüz dilinden bağımsız anlamlı)', () => {
  const tr = LANGUAGES.find((l) => l.code === 'tr')!;
  const en = LANGUAGES.find((l) => l.code === 'en')!;
  assert.equal(languageSubtitle(tr, 'tr'), 'Turkish');
  assert.equal(languageSubtitle(tr, 'en'), 'Turkish');
  assert.equal(languageSubtitle(en, 'tr'), 'İngilizce');
  assert.equal(languageSubtitle(en, 'en'), 'İngilizce');
});

test('Telefon dili (varsayılan): tercih yok/system → cihaz dili', () => {
  assert.equal(resolveLang(null, 'en'), 'en');
  assert.equal(resolveLang(SYSTEM_PREF, 'tr'), 'tr');
  assert.equal(resolveLang('en', 'tr'), 'en');
  assert.equal(resolveLang('tr', 'en'), 'tr');
});

test('tercih doğrulama: bilinmeyen kod kabul edilmez', () => {
  assert.equal(isLangPref('system'), true);
  assert.equal(isLangPref('tr'), true);
  assert.equal(isLangPref('de'), false);
  assert.equal(isLangPref(null), false);
});

test('yeni dile hazır: etkin olmayan / sözlüğü olmayan satır listede görünmez', () => {
  const future = [
    ...LANGUAGES,
    { code: 'de', nativeName: 'Deutsch', names: { tr: 'Almanca', en: 'German' }, flag: 'gb', enabled: true },
    { code: 'en', nativeName: 'English (draft)', names: { tr: 'x', en: 'y' }, flag: 'gb', enabled: false },
  ] as unknown as LanguageEntry[];
  assert.deepEqual(enabledLanguages(future).map((l) => l.code), ['tr', 'en']);
  // Etkin her dilin sözlüğü var.
  for (const l of enabledLanguages()) assert.ok((SUPPORTED_LANGS as readonly string[]).includes(l.code));
});

test('ekran metinleri TR + EN', () => {
  for (const k of ['profil.lang_section', 'profil.lang_system', 'profil.lang_note', 'profil.language']) {
    const t = translate('tr', k);
    const e = translate('en', k);
    assert.ok(t && !t.includes('missing'), `${k} tr`);
    assert.ok(e && !e.includes('missing'), `${k} en`);
    assert.notEqual(t, e, `${k} çevrilmiş`);
  }
});

// G39-S1 md.7 — İngilizce birincil yayın: Türkçe cihaz → TR, diğer her dil → EN.
test('pickDeviceLang: birincil dil Türkçe → tr, diğer her dil / boş / bilinmeyen → en', () => {
  assert.equal(pickDeviceLang([{ languageCode: 'tr' }]), 'tr');
  assert.equal(pickDeviceLang([{ languageCode: 'TR' }, { languageCode: 'en' }]), 'tr');
  assert.equal(pickDeviceLang([{ languageCode: 'en' }]), 'en');
  for (const code of ['de', 'fr', 'ar', 'ru', 'es', 'az', 'ja', '', null]) assert.equal(pickDeviceLang([{ languageCode: code }]), 'en', String(code));
  // Yalnız birincil dil: Almanca birincil, Türkçe ikincil → EN.
  assert.equal(pickDeviceLang([{ languageCode: 'de' }, { languageCode: 'tr' }]), 'en');
  assert.equal(pickDeviceLang([]), 'en');
  assert.equal(pickDeviceLang(null), 'en');
  assert.equal(DEVICE_FALLBACK_LANG, 'en');
  // Desteklenmeyen cihaz kodu (eski kayıt) → EN.
  assert.equal(resolveLang(null, 'de' as never), 'en');
});
