// G18-S4 md.7 — "ekran dosyalarında sabit süre/eğri yok" otomatik denetimi.
//
// Hareketin TEK kaynağı `src/core/design/motion.tsx` (FinMoTokens + FinMoMap,
// PREMIUM geçiş seti). Bu modül dışındaki hiçbir dosya süre/gecikme SAYISI, eğri
// (Easing.bezier/linear/ease…) ya da yay sabiti (stiffness/damping/speed/bounciness)
// yazamaz; token'dan aritmetikle yeni süre üretemez (ör. `TIMING.pop / 2`).
//
// İSTİSNA (LEGACY): yalnız bayrak KAPALI yolda çizilen 1.0.7 dosyaları — orada değer
// değişirse "bayrak kapalı = bugünkü uygulama, bayt bayt" kuralı bozulur. Her dosya
// tam ihlal SAYISIYLA kayıtlı: sayı artarsa (yeni yerel süre) test kırılır. G-TEMİZLİK
// bu dosyaları siler; liste o gün boşalır.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..');

/** Hareket token modülü (tek kaynak) + eski sabitlerin ince yeniden-dışa-verme katmanı. */
const TOKEN_MODULES = new Set(['core/design/motion.tsx', 'constants/motion.ts']);

/** Yasak desenler — her eşleşme bir ihlal. */
const RULES: { id: string; re: RegExp }[] = [
  { id: 'süre sayısı', re: /\b(?:duration|animationDuration)\s*:\s*\d/g },
  { id: 'gecikme sayısı', re: /\bdelay\s*:\s*\d/g },
  { id: 'withDelay sayısı', re: /withDelay\(\s*\d/g },
  { id: 'yerel eğri', re: /\bEasing\.(?:bezier|linear|ease|in|out|inOut|quad|cubic|sin|exp|poly|elastic|back|bounce|circle)\b/g },
  { id: 'yay sabiti', re: /\b(?:stiffness|damping|bounciness|tension|friction)\s*:\s*\d/g },
  { id: 'yay hızı', re: /[{,]\s*speed\s*:\s*\d/g },
  { id: 'token aritmetiği', re: /\b(?:DURATION|TIMING|REDUCED)\.\w+\s*[-+*/]\s*\d/g },
  { id: 'süre ifadesi', re: /\bduration\s*:\s*[A-Za-z_.]+\s*[-+*/]\s*\d/g },
];

/**
 * Bayrak kapalı yol (1.0.7) — değerleri DONUK. Sayı = bugünkü ihlal adedi.
 * Gerekçe: dosya yalnız eski kabuk/eski sipariş/eski ekran rotasında çizilir
 * (bayrak açıkken `finalRoutes`/`v2ScreenFor`/kabuk seçimi Final karşılığını verir).
 */
const LEGACY: Record<string, { max: number; why: string }> = {
  'navigation/CustomTabBar.tsx': { max: 12, why: 'eski kabuk tab bar (yeni_kabuk kapalı)' },
  'utils/useAnimatedPress.ts': { max: 4, why: 'eski CartScreen/eski ekranlar basma hook’u' },
  'hooks/useStaggerAnimation.ts': { max: 2, why: 'eski liste kademe hook’u (1.0.7 ekranları)' },
  'constants/theme.ts': { max: 2, why: 'eski COLORS teması (bayrak kapalı)' },
  'screens/FeedbackScreen.tsx': { max: 6, why: 'yeni_kabuk açıkken Feedback → FinPrFeedback (finalRoutes)' },
  'screens/ProfileScreen.tsx': { max: 2, why: 'yeni_kabuk açıkken FinPrProfileScreen döner; eski makro çubuğu' },
  'screens/ProductDetailScreen.tsx': { max: 4, why: 'yeni_siparis açıkken EkProduct (finalRoutes)' },
  'screens/MacroScreen.tsx': { max: 4, why: 'yeni_kabuk açıkken Subscriptions → FinPrMacro (finalRoutes)' },
  'screens/TrackerScreen.tsx': { max: 2, why: 'eski öğün modalı (yeni kabukta Final öğün akışı)' },
  'screens/HomeScreen.tsx': { max: 2, why: 'eski eatkcal ana sayfası (yeni_siparis kapalı)' },
  'components/FloatingCartPill.tsx': { max: 4, why: 'eski yüzen sepet (noLegacyWhenFlagsOn: LEGACY_FILES)' },
  'components/BottomSheet.tsx': { max: 2, why: 'eski BottomSheet (noLegacyWhenFlagsOn: LEGACY_FILES)' },
  'components/FormField.tsx': { max: 2, why: 'eski form alanı (noLegacyWhenFlagsOn: LEGACY_FILES)' },
  'components/AnnouncementStrip.tsx': { max: 1, why: 'eski duyuru şeridi (eski HomeScreen)' },
  'components/modals/PushPermissionPrompt.tsx': { max: 2, why: 'eski bildirim izni penceresi (yeni kabukta FinOnbNotify/NotifyPermissionSheet)' },
  'modules/eatkcal/screens/OrderSuccessScreen.tsx': { max: 6, why: 'yeni_siparis açıkken EkOrderSuccess (v2ScreenFor)' },
  'modules/eatkcal/screens/CartScreen.tsx': { max: 2, why: 'eski sepet (yeni_siparis açıkken EkCart)' },
  'modules/eatkcal/screens/EatHomeScreen.tsx': { max: 0, why: 'eski T20Eat (yeni_siparis açıkken FinEkHome)' },
  'core/ui/FadeSwap.tsx': { max: 2, why: '1.0.7 core/ui (eski ekranlar)' },
  'core/ui/Toast.tsx': { max: 2, why: '1.0.7 core/ui toast (yeni kabukta core/design Toast)' },
  'core/ui/SegmentedTabs.tsx': { max: 2, why: '1.0.7 core/ui (eski ekranlar)' },
  'core/ui/Selectable.tsx': { max: 2, why: '1.0.7 core/ui (eski ekranlar)' },
  'screens/DesignShowcaseScreen.tsx': { max: 0, why: 'yalnız __DEV__ vitrin' },
};

function walk(dir: string, out: string[] = []): string[] {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (n === 'node_modules' || n.startsWith('__')) continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) && !n.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Yorum satırlarını at (açıklamalardaki "base 300" gibi metinler sayılmaz). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

export function scanMotion(): Map<string, string[]> {
  const hits = new Map<string, string[]>();
  for (const f of walk(SRC)) {
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    if (TOKEN_MODULES.has(rel)) continue;
    const code = stripComments(fs.readFileSync(f, 'utf8'));
    const found: string[] = [];
    for (const r of RULES) {
      for (const m of code.matchAll(r.re)) found.push(`${r.id}: ${m[0]}`);
    }
    if (found.length) hits.set(rel, found);
  }
  return hits;
}

test('noLocalMotionTokens: Final yolunda yerel süre/eğri/yay yok (yalnız motion.tsx token’ları)', () => {
  const hits = scanMotion();
  const bad: string[] = [];
  for (const [file, found] of hits) {
    const legacy = LEGACY[file];
    if (!legacy) {
      bad.push(`${file}\n    ${found.join('\n    ')}`);
    } else if (found.length > legacy.max) {
      bad.push(`${file} (eski dosya, izinli ${legacy.max}, bulunan ${found.length})\n    ${found.join('\n    ')}`);
    }
  }
  assert.equal(bad.length, 0, `Yerel hareket değeri bulundu — motion.tsx PREMIUM/DURATION/CURVE/SPRING kullan:\n${bad.join('\n')}`);
});

test('noLocalMotionTokens: LEGACY listesi yalnız bayrak kapalı dosyalar (Final dizinleri yok)', () => {
  for (const f of Object.keys(LEGACY)) {
    assert.ok(
      !/^(modules\/(kesfet|ai|shell|gun|celebrate|collection|onboarding|profil|media)\/|modules\/eatkcal\/v2\/|core\/design\/)/.test(f),
      `${f} Final dizininde — istisna olamaz`,
    );
  }
});

test('noLocalMotionTokens: PREMIUM geçiş seti FinMoTokens ile birebir', async () => {
  // motion.tsx RN/Reanimated/expo-haptics çeker; node:test ortamında yalnız
  // değerleri kaynaktan okuyarak doğrularız.
  const src = fs.readFileSync(path.join(SRC, 'core/design/motion.tsx'), 'utf8');
  const block = src.slice(src.indexOf('export const PREMIUM'), src.indexOf('export function listEnterDelay'));
  const expect: [string, RegExp][] = [
    ['sekme fast 200 standard', /tab:\s*\{\s*duration:\s*DURATION\.fast,\s*curve:\s*CURVE\.standard/],
    ['push base 300 enter / base 300 exit', /push:\s*\{\s*enter:\s*DURATION\.base,\s*exit:\s*DURATION\.base,\s*enterCurve:\s*CURVE\.enter,\s*exitCurve:\s*CURVE\.exit/],
    ['sheet base 300 / fast 200 / eatkcal 200/28', /sheet:\s*\{\s*enter:\s*DURATION\.base,\s*exit:\s*DURATION\.fast,\s*eatSpring:\s*SPRING\.eat/],
    ['liste fast 200 · kademe instant 100 · 4 öğe · 8 pt · ≤ 500', /duration:\s*DURATION\.fast,\s*curve:\s*CURVE\.enter,\s*stagger:\s*DURATION\.instant,\s*maxItems:\s*4,\s*shift:\s*8,\s*totalMax:\s*DURATION\.slow/],
    ['basma instant 100 · 0.98 · AI yayı', /press:\s*\{\s*duration:\s*DURATION\.instant,\s*scale:\s*0\.98,[^}]*release:\s*SPRING\.ai/],
    ['yükleniyor → içerik fast 200', /load:\s*\{\s*duration:\s*DURATION\.fast/],
    ['hata fast 200', /error:\s*\{\s*duration:\s*DURATION\.fast/],
  ];
  for (const [name, re] of expect) assert.match(block, re, name);
  // Süre bantları (G22-S2 md.1: FinMoTokens ×1,1): 110/220/330/550/990 dışında değer yok.
  const BAND = [110, 220, 330, 550, 990];
  const durBlock = src.slice(src.indexOf('export const DURATION'), src.indexOf('export const TIMING'));
  for (const m of durBlock.matchAll(/:\s*(\d+),/g)) {
    assert.ok(BAND.includes(Number(m[1])), `DURATION bandı dışı: ${m[1]}`);
  }
  const timBlock = src.slice(src.indexOf('export const TIMING'), src.indexOf('export const CURVE'));
  for (const m of timBlock.matchAll(/:\s*(\d+),/g)) {
    assert.ok(BAND.includes(Number(m[1])), `TIMING bandı dışı: ${m[1]}`);
  }
  // Toplam liste girişi ≤ slow: (4−1)·110 + 220 = 550.
  assert.ok((4 - 1) * 110 + 220 <= 550);
});
