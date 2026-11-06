// G15-S6 md.3 — "Eski tasarım: 0" otomatik denetimi.
// Bütün bayraklar AÇIKKEN Final yolunun (v2/Fin* giriş dosyaları) import ağacında
// 1.0.7 tasarımı bileşeni olmamalı: eski `COLORS` (constants/theme), eski
// `BottomSheet`, eski logo (kcalculateLogo) ve 1.0.7 kart/düğme bileşenleri.
// Bayrak kapısı dosyaları (`*Gate*`, `Legacy*`, `legacy*`) DURAK düğümüdür:
// eski ekran yalnız onların arkasında, bayrak kapalı yolda yaşar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..');

const LEGACY_FILES = [
  'constants/kcalculateLogo.ts',
  'components/BottomSheet.tsx',
  'components/ScreenContainer.tsx',
  'components/FormField.tsx',
  'components/PopupModal.tsx',
  'components/ReorderCard.tsx',
  'components/ActiveOrderCard.tsx',
  'components/FloatingCartPill.tsx',
];
const COLORS_IMPORT = /import\s*\{[^}]*\bCOLORS\b[^}]*\}\s*from\s*['"][^'"]*constants\/theme['"]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (n === 'node_modules' || n.startsWith('__')) continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx'), base]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

const rel = (f: string) => path.relative(SRC, f);
const isGate = (f: string) => /(Gate|Legacy|legacy)/.test(path.basename(f));

function importsOf(f: string): string[] {
  const src = fs.readFileSync(f, 'utf8');
  const specs = [...src.matchAll(/(?:from\s+|import\(\s*|require\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
  return specs.map((s) => resolveImport(f, s)).filter((x): x is string => !!x);
}

/** Giriş dosyalarından erişilen eski tasarım ihlalleri. */
function violations(entries: string[], allow: Record<string, string>): string[] {
  const seen = new Set<string>();
  const bad: string[] = [];
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const r = rel(f);
    if (LEGACY_FILES.includes(r) && !allow[r]) {
      bad.push(`${r} (eski bileşen)`);
      continue;
    }
    if (COLORS_IMPORT.test(fs.readFileSync(f, 'utf8')) && !allow[r]) bad.push(`${r} (eski COLORS)`);
    for (const dep of importsOf(f)) if (!isGate(dep)) stack.push(dep);
  }
  return bad.sort();
}

const list = (dir: string, re?: RegExp) => walk(path.join(SRC, dir)).filter((f) => !re || re.test(rel(f)));

// Final (bayrak açık) yolun giriş noktaları.
const ENTRIES: Record<string, string[]> = {
  'eatkcal v2': list('modules/eatkcal/v2'),
  'onboarding v2': list('modules/onboarding/v2'),
  'onboarding (Final)': ['modules/onboarding/OnboardingNavigator.tsx', 'modules/onboarding/takibe/TakibeNavigator.tsx'].map((p) => path.join(SRC, p)),
  'profil Fin*': list('modules/profil/ui/screens', /\/Fin[A-Z]/),
  'kesfet Final': list('modules/kesfet/ui', /\/(Fin[A-Z]|FeedCard|Composer|Comments|Notifications)/),
  celebrate: list('modules/celebrate'),
  shell: list('modules/shell'),
};

// Bilinçli istisnalar (sebebiyle): boş = yok.
const ALLOW: Record<string, string> = {
  // Ölçüm raporu PDF'inin içindeki marka logosu (dışa aktarılan belge, uygulama ekranı
  // değil). Final logo varlığı gelene kadar bilinçli istisna → LOG "SORULAR".
  'constants/kcalculateLogo.ts': 'PDF rapor logosu (exportNutritionReport)',
};

for (const [name, files] of Object.entries(ENTRIES)) {
  test(`Eski tasarım: 0 — ${name} (bayrak açık yolda eski bileşen import edilmez)`, () => {
    assert.ok(files.length > 0, `${name}: giriş dosyası yok`);
    assert.deepEqual(violations(files, ALLOW), []);
  });
}
