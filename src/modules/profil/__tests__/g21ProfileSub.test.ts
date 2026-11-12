// G21-S1 md.9 — Profil alt sayfaları native stack'te (sağdan kayar), sekme içi
// durum değişimi kalmadı. Statik + saf denetim.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PROFILE_SUBS, isProfileSub, profileSubId } from '../ui/screens/profileSub';

const SRC = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

test('profileSubId: alt sayfa adı yığın kimliği; bilinmeyen → undefined', () => {
  assert.equal(profileSubId({ sub: 'privacy' }), 'privacy');
  assert.equal(profileSubId({ sub: 'nope' }), undefined);
  assert.equal(profileSubId(undefined), undefined);
  assert.equal(isProfileSub('dataConsent'), true);
  assert.equal(new Set(PROFILE_SUBS).size, PROFILE_SUBS.length);
});

test('FinPrProfileScreen: setSub / tab bar gizleme / BackHandler yok; her satır ProfileSub rotasına', () => {
  const src = read('modules/profil/ui/screens/FinPrProfileScreen.tsx');
  assert.doesNotMatch(src, /setSub\(/);
  assert.doesNotMatch(src, /tabBarStyle/);
  assert.doesNotMatch(src, /BackHandler\.addEventListener/);
  assert.match(src, /navigate\('ProfileSub'/);
  const used = [...src.matchAll(/openSub\('(\w+)'/g)].map((m) => m[1]);
  assert.ok(used.length >= 15, `beklenen ≥15 alt sayfa bağlantısı, bulunan ${used.length}`);
  for (const u of used) assert.ok(isProfileSub(u), `tanımsız alt sayfa: ${u}`);
});

test('ProfileSubRoute: her alt sayfa için dal var; geri = yığından goBack', () => {
  const src = read('modules/profil/ui/screens/ProfileSubRoute.tsx');
  for (const s of PROFILE_SUBS) assert.match(src, new RegExp(`case '${s}':`), `dal yok: ${s}`);
  assert.match(src, /goBack\(\)/);
  // Alt sayfadan alt sayfaya (Gizlilik → Güvenlik/Veri izinleri, İlerleme → Ölçümler) üstüne itilir.
  assert.match(src, /open\('security'\)/);
  assert.match(src, /open\('dataConsent'\)/);
  assert.match(src, /open\('measurements'\)/);
});

test('AppNavigator: ProfileSub kayıtlı, kimlik getId, geçiş pushTransition (azaltılmış yalnız yeni kabukta)', () => {
  const nav = read('navigation/AppNavigator.tsx');
  assert.match(nav, /<Stack\.Screen name="ProfileSub" component=\{ProfileSubLazy\} getId=\{\(\{ params \}\) => profileSubId\(params\)\} options=\{push\} \/>/);
  assert.match(nav, /const push = pushTransition\(yeniKabukRoutes && reducedMotion\);/);
  assert.match(nav, /screenOptions=\{\{\s*headerShown: false,\s*\.\.\.push,/);
  // bayrak kapalıyken AI rotaları eski sabitle (bayt bayt aynı değerler)
  assert.match(nav, /const aiPush = yeniKabukRoutes \? push : AI_PUSH;/);
  // bayrak kapalıyken yığın zemini eski açık renk
  assert.match(nav, /const stackBg = yeniKabukRoutes \? designThemeRoot\.color\.bg : LEGACY_STACK_BG;/);
  assert.match(nav, /const LEGACY_STACK_BG = '#f6f6f6';/);
});

test('vitrin: Profil alt panoları ProfileSub rotasıyla açılır (vitrinSub kalktı)', () => {
  const cat = read('dev/screenCatalog.ts');
  assert.doesNotMatch(cat, /vitrinSub:/);
  assert.match(cat, /name: 'ProfileSub', params: \{ sub \}/);
});
