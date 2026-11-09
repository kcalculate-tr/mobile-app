// G20-S1 md.5 — bayrak kapalı parite: rıza bloğu YALNIZ yeni kabukta (FinOnbAccount +
// e-posta sheet'i + kapı sheet'i). Eski kabuk giriş/kayıt ekranları ve onay metinleri
// AYNEN; App.tsx Meta/ATT'yi doğrudan değil kapı üzerinden başlatır (kapı bayrak
// kapalıyken bugünkü gibi açılışta başlatır — bileşen testi g20Consent).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = join(dir, name);
    if (statSync(join(ROOT, p)).isDirectory()) {
      if (!name.startsWith('__')) walk(p, out);
    } else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const LEGACY_AUTH = [...walk('src/modules/onboarding/v2'), ...walk('src/screens')].map((p) => relative(ROOT, join(ROOT, p)));

test('eski kabuk giriş/kayıt ekranları rıza bloğunu / kapıyı kullanmaz', () => {
  const hits = LEGACY_AUTH.filter((p) => /consent\/(ConsentBlock|ConsentSheet|ConsentGate)|lib\/consent\//.test(read(p)));
  assert.deepEqual(hits, []);
});

test('eski kabuk onay metinleri yerinde (login/signup sözlükleri)', () => {
  const login = read('src/modules/onboarding/v2/i18n/login.ts');
  assert.match(login, /I am over 18 and accept the terms of use\./);
});

test('App.tsx: Meta/ATT yalnız ConsentGate üzerinden (doğrudan initFBSDK çağrısı yok)', () => {
  const app = read('App.tsx');
  assert.doesNotMatch(app, /initFBSDK\(/);
  assert.match(app, /<ConsentGate suppressed=\{forceUpdate\} \/>/);
  const gate = read('src/modules/onboarding/consent/ConsentGate.tsx');
  assert.match(gate, /if \(!flagsOn\) \{\s*void startMeta\(false\);/);
});

test('rıza bloğu yeni kabuk Hesap ekranında ve e-posta sheet’inde', () => {
  const nav = read('src/modules/onboarding/OnboardingNavigator.tsx');
  assert.match(nav, /<ConsentSheet[\s\S]*mode="details"/);
  assert.match(nav, /acceptPolicies\(\{ source: 'signup_social', adOn, ageOk: true \}\)/);
  const sheet = read('src/modules/onboarding/first/AccountEmailSheet.tsx');
  assert.match(sheet, /<ConsentBlock/);
  assert.match(sheet, /acceptPolicies\(\{ source: 'signup_email', adOn, ageOk: true \}\)/);
});

// G21-S1 md.4: tek toast artık KABUK toast'ı — Keşfet uçuşu id + kaydı silen undo taşır,
// kendi log toast'ını göstermez (ownToast sözleşmesi başka kaynaklar için duruyor).
test('Keşfet tek toast: kabuk toast\'ı (id + undo), Keşfet ownToast vermez, Geri al yalnız undo ile', () => {
  const k = read('src/modules/kesfet/ui/KesfetScreen.tsx');
  assert.doesNotMatch(k, /ownToast: true/);
  assert.match(k, /id: consumptionId,/);
  assert.match(k, /undo: async \(\) => \{/);
  const bar = read('src/modules/shell/TabBarR3.tsx');
  assert.match(bar, /if \(payload\.ownToast\) return;/);
  assert.match(bar, /onUndo=\{toast\.undo \? onToastUndo : undefined\}/);
});
