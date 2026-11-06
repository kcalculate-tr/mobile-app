// G15-S1 — bayrak kapalı parite koruması (Onboarding + Takibe başla). Sözleşme testi:
//  1) Oturumsuz açılışta 'Onboarding' yalnız `yeni_onboarding` açıkken initialRoute olur;
//     kapalıyken 'WelcomeGate' (bugünkü ekran).
//  2) 'TakibeBasla'ya yalnız bilinen iki yerden gidilir: Onboarding Bildirim adımı
//     (bayrak açık akış) ve Final Profil › Hedefim (yeni kabuk ekranı).
//  3) Giriş/kayıt rotaları AppNavigator'da yalnız bayrağa bakan kapılara bağlı.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../../..');
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name === 'node_modules' || f.name === '__tests__' || f.name === '__component_tests__' || f.name === 'dev') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(f.name)) out.push(p);
  }
  return out;
}

test('initialRoute: Onboarding yalnız yeni_onboarding açıkken, kapalıyken WelcomeGate', () => {
  const nav = read('navigation/AppNavigator.tsx');
  assert.match(nav, /const yeniOnboarding = useColdStartFeature\('yeni_onboarding'\)/);
  assert.match(
    nav,
    /const initialRouteName = session\s*\?\s*'Tabs'\s*:\s*yeniOnboarding\s*\?\s*'Onboarding'\s*:\s*'WelcomeGate'/,
  );
});

test("'TakibeBasla'ya yalnız Onboarding, Final Profil › Hedefim ve Ana sayfa makro ayrıntısından (ikisi de bayrak açık) gidilir", () => {
  const hits = walk(SRC)
    .filter((f) => /navigate\(\s*'TakibeBasla'/.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(SRC, f))
    .sort();
  assert.deepEqual(hits, [
    'modules/onboarding/OnboardingNavigator.tsx',
    'modules/profil/ui/screens/FinPrProfileScreen.tsx',
    'screens/TrackerScreen.tsx', // G15-S2: makro ayrıntısı; yalnız `yeni_onboarding` açıkken, kapalıyken NutritionProfile
  ]);
});

test('Giriş / Kcal AI kayıt rotaları bayrak kapılarına bağlı (eski ekranlar yalnız kapı içinden)', () => {
  const nav = read('navigation/AppNavigator.tsx');
  assert.match(nav, /import\('\.\.\/modules\/onboarding\/v2\/LoginGate'\)/);
  assert.match(nav, /import\('\.\.\/modules\/onboarding\/v2\/SignupAIGate'\)/);
  assert.doesNotMatch(nav, /import\('\.\.\/screens\/auth\/UnifiedLoginScreen'\)/);
  const gate = read('modules/onboarding/v2/LoginGate.tsx');
  assert.match(gate, /useFeature\('yeni_onboarding'\)/);
  assert.match(gate, /UnifiedLoginScreen/);
});
