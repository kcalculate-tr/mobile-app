// G18-S5 — birleştirme bağları (temas) ve uygulama geneli kurallar için kalıcı denetim.
// Bağ koparsa (ör. biri ⌄ çentiğini eski seçiciye geri bağlarsa) bu test kırılır.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) {
      if (n === 'node_modules' || n.startsWith('__')) continue;
      walk(p, out);
    } else if (/\.(tsx?|json)$/.test(n)) out.push(p);
  }
  return out;
}

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('md.8: Keşfet MealCard ve Tara sonucu "logla ⌄" çentikleri S2 FinMoPopover (MealMenuPopover)', () => {
  for (const f of ['modules/kesfet/ui/MealCard.tsx', 'modules/ai/scan/ui/FinPhotoResult.tsx']) {
    assert.match(read(f), /<MealMenuPopover\b/, `${f}: çentik yerinde menüye bağlı değil`);
  }
  // Keşfet: yalnız yeni kabukta; kapalıyken ⌄ = seçici sayfası (aynen).
  assert.match(read('modules/kesfet/ui/KesfetScreen.tsx'), /quickMeal=\{yeniKabukMenu \? quickMealType : undefined\}/);
});

test('md.7: Apple/Google düğmeleri resmî işaretler (Google 4 renk, Apple tek renk logo)', () => {
  const s = read('modules/onboarding/components/pieces.tsx');
  for (const c of ['#4285F4', '#34A853', '#FBBC05', '#EA4335']) assert.ok(s.includes(c), `Google rengi yok: ${c}`);
  assert.match(s, /function AppleLogo/);
  assert.doesNotMatch(s, /GlyphIcon|APPLE_D|GOOGLE_D/);
});

test('temas: Ana sayfa İzmir dışı satırları S3 bekleme listesi sheet\'ini açar; FinPush finOpenLog karşılanır', () => {
  const s = read('screens/TrackerScreen.tsx');
  assert.match(s, /<WaitlistFormSheet\b/);
  assert.match(s, /finOpenLog/);
  assert.match(s, /openMenuSlot=\{pushMenuSlot\}/);
});

test('ORTAK #12: kullanıcıya görünen "₺" = 0 (yorum ve testler hariç); tek formatPrice kaynağı money.ts', () => {
  const bad = walk(SRC).filter((f) => stripComments(fs.readFileSync(f, 'utf8')).includes('₺'));
  assert.deepEqual(bad.map((f) => path.relative(SRC, f)), []);
  assert.match(read('utils/formatPrice.ts'), /from '\.\.\/lib\/money'/);
});

test('ORTAK #14: cam nesne anlamları — Enerji halkası alev, seri kupa, ilk öğün kase', () => {
  assert.match(read('screens/tracker/FinTopBlock.tsx'), /glass\/flame\.png/);
  assert.match(read('modules/onboarding/first/HomeEmptyR1.tsx'), /glass\/flame\.png/);
  assert.doesNotMatch(read('modules/onboarding/first/HomeEmptyR1.tsx'), /glass\/drop\.png/);
  const c = read('modules/celebrate/types.ts');
  assert.match(c, /case 'streak3':\s*return \{ moment, glass: 'trophy'/);
  assert.match(c, /glass: 'trophy', ringProgress: 1, big: '7'/);
  assert.match(c, /glass: 'bowl', ringProgress: 1, big: '1\.'/);
});

test('uçtan uca akış düzeltmeleri (G18-S5): e-posta sheet\'i kapanmadan gezinme yok; İzmir kapısı bayrak kapalıyken çıkmaz değil; LogTrail leke bırakmaz; yeni kurulumda yükseltme tanıtımı yok', () => {
  const onb = read('modules/onboarding/OnboardingNavigator.tsx');
  // onVerified yalnız kapatır; Ana sayfa kapanış (Modal kalktı) geri çağrısında.
  assert.match(onb, /onVerified=\{\(\) => \{[\s\S]*?homeAfterClose\.current = true;\s*setEmailOpen\(false\);\s*\}\}/);
  assert.match(onb, /onClosed=\{\(\) => \{[\s\S]*?goHome\(\);/);
  assert.match(read('modules/onboarding/first/AccountEmailSheet.tsx'), /onClosed\?\.\(\);/);
  assert.match(onb, /writeIntroSeen\(\)/);
  assert.match(read('modules/eatkcal/v2/ui/gate/CityGateView.tsx'), /if \(!reg\.enabled\) \{\s*haptic\('success'\);\s*onAllowed\(\);/);
  const trail = read('core/design/components/LogTrail.tsx');
  assert.match(trail, /\[0, 0\.08, 0\.85, 1\], \[1, 1, 1, 0\]/);
  assert.match(trail, /interpolate\(pulse\.value, \[0, 1\], \[0, 1\]\)/);
});
