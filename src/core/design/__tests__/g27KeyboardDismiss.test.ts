// G27-S1 md.1 — klavye "Kapat" barı her yerde kalktı; dışarı dokununca / kaydırınca kapanır.
// Saf karar mantığı + kaynak bekçisi (yeni bir kaydırma kabı ortak klavye
// özelliklerini taşımazsa ya da bar geri gelirse bu test düşer).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { consumeKeepKeyboard, keepKeyboardOnTouch, shouldDismissOnTap, TAP_SLOP } from '../keyboardDismiss';

const ROOT = path.resolve(__dirname, '../../../..');
const input = { id: 'input' };
const other = { id: 'other' };
const base = { focused: input, target: other, targetIsTextInput: false, movedPx: 0, keep: false };

test('kökte (alan dışı) dokunma klavyeyi kapatır', () => {
  assert.equal(shouldDismissOnTap(base), true);
});

test('odaklı alan yoksa hiçbir şey yapmaz', () => {
  assert.equal(shouldDismissOnTap({ ...base, focused: null }), false);
});

test('odaklı alanın kendisine dokunma (imleç) kapatmaz', () => {
  assert.equal(shouldDismissOnTap({ ...base, target: input }), false);
});

test('başka bir giriş alanına dokunma (alan değiştirme) kapatmaz', () => {
  assert.equal(shouldDismissOnTap({ ...base, targetIsTextInput: true }), false);
});

test('sürükleme dokunma sayılmaz (kaydırma kabının keyboardDismissMode kararı)', () => {
  assert.equal(shouldDismissOnTap({ ...base, movedPx: TAP_SLOP }), true);
  assert.equal(shouldDismissOnTap({ ...base, movedPx: TAP_SLOP + 1 }), false);
  assert.equal(shouldDismissOnTap({ ...base, movedPx: Number.NaN }), false);
});

test('keepKeyboardOnTouch işaretli öğe (sohbet Gönder) kapatmaz; bayrak tek dokunmalık', () => {
  assert.equal(shouldDismissOnTap({ ...base, keep: true }), false);
  assert.equal(consumeKeepKeyboard(), false);
  keepKeyboardOnTouch();
  assert.equal(consumeKeepKeyboard(), true);
  assert.equal(consumeKeepKeyboard(), false);
});

function tracked(): string[] {
  const out = execFileSync('git', ['ls-files', 'src', 'App.tsx'], { cwd: ROOT }).toString('utf8');
  return out
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !/__tests__|__component_tests__/.test(f))
    .filter((f) => fs.existsSync(path.join(ROOT, f)));
}

test('bar ve aksesuar kodu kalmadı (KeyboardToolbar / KeyboardAccessory / InputAccessoryView)', () => {
  const bad: string[] = [];
  for (const f of tracked()) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (/KeyboardToolbar\b|KeyboardAccessory\b|<InputAccessoryView\b|inputAccessoryViewID\s*=/.test(s.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ''))) {
      bad.push(f);
    }
  }
  assert.deepEqual(bad, []);
  assert.equal(fs.existsSync(path.join(ROOT, 'src/components/KeyboardToolbar.tsx')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'src/components/KeyboardAccessory.tsx')), false);
});

test('App kökü KeyboardDismissRoot ile sarılı', () => {
  const app = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
  assert.match(app, /<KeyboardDismissRoot>/);
  assert.match(app, /<\/KeyboardDismissRoot>/);
});

test('her ScrollView / FlatList / SectionList ortak klavye özelliklerini yayar', () => {
  const tag = /(?<![A-Za-z0-9_])<((?:Animated\.|Reanimated\.)?(?:ScrollView|FlatList|SectionList))(?=[\s/>])/g;
  const missing: string[] = [];
  for (const f of tracked()) {
    if (!f.endsWith('.tsx')) continue;
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    let m: RegExpExecArray | null;
    while ((m = tag.exec(s))) {
      // Açılış etiketinin ilk ~400 karakteri yeter (özellik listesi başı).
      const head = s.slice(m.index, m.index + 400);
      if (!/\{\.\.\.(FIN_)?SCROLL_KEYBOARD\}/.test(head)) {
        missing.push(`${f}:${s.slice(0, m.index).split('\n').length}`);
      }
      // Eski tekil özellikler aynı etikette kalmamalı (çakışma).
      const end = head.indexOf('SCROLL_KEYBOARD');
      if (end > 0 && /keyboardShouldPersistTaps=|keyboardDismissMode=/.test(head.slice(0, end))) {
        missing.push(`${f}:${s.slice(0, m.index).split('\n').length} (eski özellik)`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('SCROLL_KEYBOARD: handled + iOS interactive / Android on-drag', () => {
  const s = fs.readFileSync(path.join(ROOT, 'src/core/design/keyboard.ts'), 'utf8');
  assert.match(s, /KEYBOARD_DISMISS_MODE[^=]*=\s*Platform\.OS === 'ios' \? 'interactive' : 'on-drag'/);
  assert.match(s, /keyboardShouldPersistTaps: 'handled'/);
  const fin = fs.readFileSync(path.join(ROOT, 'src/modules/profil/ui/finUi.tsx'), 'utf8');
  assert.match(fin, /FIN_SCROLL_KEYBOARD = \{\s*\.\.\.SCROLL_KEYBOARD,/);
});
