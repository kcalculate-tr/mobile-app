// G22-S2 md.7 — "Açılış yüklemesi": Final yolunda TAM EKRAN dönen yuvarlak gösterge
// (ActivityIndicator) yok; ekran içi yüklemeler FinMoLoad iskeleti (FinListSkeleton /
// FinCardSkeleton / FinSkeletonBlock). Düğme içi küçük gösterge serbest.
//
// İSTİSNA: ödeme / kart doğrulama (3D Secure) İŞLEM adımları — gösterge altında
// "Ödeme hazırlanıyor / Doğrulanıyor" metni olan süreç durumudur, içerik yüklemesi
// değil (iskelet yanıltıcı olur). Dosya başına izinli adet sabit; artarsa test kırılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..');

/** Final (yeni kabuk / yeni sipariş / onboarding) dizinleri. */
const FINAL = /^(modules\/(kesfet|ai|shell|gun|celebrate|collection|onboarding|profil|media)\/|modules\/eatkcal\/v2\/|core\/design\/)/;

const PROCESS_EXCEPTIONS: Record<string, number> = {
  'modules/eatkcal/v2/screens/EkPaymentScreen.tsx': 2,
  'modules/eatkcal/v2/screens/EkAddCardScreen.tsx': 1,
};

function walk(dir: string, out: string[] = []): string[] {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) {
      if (n === 'node_modules' || n.startsWith('__')) continue;
      walk(p, out);
    } else if (n.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Tam ekran kalıpları: büyük gösterge · gösterge ile erken dönüş · flex:1 + yalnız gösterge. */
const FULL = [
  /<ActivityIndicator[^>]*size=["']large["']/g,
  /return\s*<ActivityIndicator/g,
  /<ActivityIndicator[^>]*style=\{\{\s*flex:\s*1/g,
];

function hits(code: string): string[] {
  const out: string[] = [];
  for (const re of FULL) for (const m of code.matchAll(re)) out.push(m[0]);
  return out;
}

test('Final yolunda tam ekran ActivityIndicator yok (FinMoLoad iskeleti)', () => {
  const bad: string[] = [];
  for (const f of walk(SRC)) {
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    if (!FINAL.test(rel)) continue;
    const found = hits(fs.readFileSync(f, 'utf8'));
    const allowed = PROCESS_EXCEPTIONS[rel] ?? 0;
    if (found.length > allowed) bad.push(`${rel} (${found.length} > ${allowed}): ${found.join(' | ')}`);
  }
  assert.equal(bad.length, 0, bad.join('\n'));
});

test('Ana sayfa (yeni kabuk) ilk açılış: dönen gösterge yerine iskelet', () => {
  const src = fs.readFileSync(path.join(SRC, 'screens/TrackerScreen.tsx'), 'utf8');
  assert.match(src, /if \(loading\) return yeniKabuk \? \(\s*<ScreenContainer[^>]*>\s*<FinListSkeleton header/);
  assert.match(src, /yeniKabuk && dataLoading \? \(\s*\/\/[^\n]*\n\s*<FinListSkeleton/);
});

test('native splash uygulama hazır olana kadar tutulur (bayrak beklemesi en çok 2,5 sn)', () => {
  const app = fs.readFileSync(path.resolve(SRC, '../App.tsx'), 'utf8');
  assert.match(app, /SplashScreen\.preventAutoHideAsync\(\)/);
  const nav = fs.readFileSync(path.join(SRC, 'navigation/AppNavigator.tsx'), 'utf8');
  assert.match(nav, /if \(authLoading \|\| waitFlags\) return null;/);
  assert.match(nav, /SplashScreen\.hideAsync\(\)/);
  const flags = fs.readFileSync(path.join(SRC, 'core/flags/FlagsProvider.tsx'), 'utf8');
  assert.match(flags, /ANON_TIMEOUT_MS = 2500/);
});
