// G47-S1 — tek giriş katmanı, profil kapısı, eski akışların kaldırılması: SAF mantık.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  completionRoutes,
  gateDecision,
  isFreshAccount,
  kayitRouteFor,
  postAuthTarget,
  redirectGateAction,
  rowHasProfile,
  type GateCtx,
} from '../gateLogic';

const ON: GateCtx = { flag: true, kisiselPlan: true, session: true, status: 'none' };
const nav = (name: string, params?: Record<string, unknown>) => ({ type: 'NAVIGATE', payload: { name, params } });

test('profil var: target_calories / custom_calories > 0 ya da personal_plan dolu', () => {
  assert.equal(rowHasProfile(null), false);
  assert.equal(rowHasProfile({}), false);
  assert.equal(rowHasProfile({ target_calories: null, custom_calories: 0 }), false);
  assert.equal(rowHasProfile({ target_calories: 1850 }), true);
  assert.equal(rowHasProfile({ target_calories: '1850' }), true);
  assert.equal(rowHasProfile({ target_calories: 0, custom_calories: 2100 }), true);
  assert.equal(rowHasProfile({ target_calories: 0, personal_plan: { calories: 1900 } }), true);
  assert.equal(rowHasProfile({ target_calories: 0, personal_plan: null }), false);
});

test('karar: bayrak kapalı → hep geçer; oturum yok → giriş; profil yok → kayıt; bilinmiyor/var → geçer', () => {
  assert.equal(gateDecision({ ...ON, flag: false }), 'pass');
  assert.equal(gateDecision({ ...ON, flag: false, session: false }), 'pass');
  assert.equal(gateDecision({ ...ON, session: false }), 'login');
  assert.equal(gateDecision(ON), 'kayit');
  assert.equal(gateDecision({ ...ON, status: 'unknown' }), 'pass');
  assert.equal(gateDecision({ ...ON, status: 'has' }), 'pass');
});

test('kayıt rotası: kisisel_plan açık → A yolu (Kayit entry), kapalı → yeni kısa profil (KayitShort)', () => {
  const back = { name: 'AiScan' };
  assert.deepEqual(kayitRouteFor(true, 'gate', back), { name: 'Kayit', params: { entry: 'gate', returnTo: back } });
  assert.deepEqual(kayitRouteFor(false, 'gate', back), { name: 'KayitShort', params: { mode: 'short', origin: 'gate', returnTo: back } });
  assert.deepEqual(kayitRouteFor(true, 'auth', null), { name: 'Kayit', params: { entry: 'auth', returnTo: null } });
});

test('(c) yönlendirici: profilsiz hesap Tara/Koç/ilerleme → doğrudan kayıt akışı, dönüş hedefi dokunulan rota', () => {
  for (const r of ['AiScan', 'AiScanOffline', 'CoachIntro', 'CoachChat', 'CoachHistory', 'MeasurementHistory', 'PersonalPlanCheckin']) {
    const out = redirectGateAction(nav(r, { x: 1 }), ON);
    assert.ok(out, r);
    assert.equal(out!.payload!.name, 'Kayit');
    assert.deepEqual(out!.payload!.params, { entry: 'gate', returnTo: { name: r, params: { x: 1 } } });
  }
  // PUSH / REPLACE da aynı; başka alanlar korunur.
  const push = redirectGateAction({ type: 'PUSH', payload: { name: 'AiScan' }, target: 'k1' }, ON);
  assert.equal(push!.type, 'PUSH');
  assert.equal(push!.target, 'k1');
  assert.equal(push!.payload!.name, 'Kayit');
  // kisisel_plan kapalı → kısa profil
  assert.equal(redirectGateAction(nav('AiScan'), { ...ON, kisiselPlan: false })!.payload!.name, 'KayitShort');
});

test('(d) profilli hesap ve bilinmeyen durum etkilenmez; serbest rotalar (eatkcal, Keşfet, Profil) hiç değişmez', () => {
  assert.equal(redirectGateAction(nav('AiScan'), { ...ON, status: 'has' }), null);
  assert.equal(redirectGateAction(nav('CoachChat'), { ...ON, status: 'unknown' }), null);
  for (const r of ['Tabs', 'Checkout', 'EkCart', 'ProductDetail', 'Kesfet', 'ProfileSub', 'Login', 'SharedPost', 'PaymentScreen']) {
    assert.equal(redirectGateAction(nav(r), ON), null, r);
  }
  assert.equal(redirectGateAction({ type: 'GO_BACK' }, ON), null);
});

test('(e) eski "Takibe başla" bayrak açıkken açılmaz: profil yok → kayıt; var → mevcut düzenleme ekranı', () => {
  assert.equal(redirectGateAction(nav('TakibeBasla', { editGoal: true }), ON)!.payload!.name, 'Kayit');
  assert.equal(redirectGateAction(nav('NutritionProfile', { firstTime: true }), ON)!.payload!.name, 'Kayit');
  assert.equal(redirectGateAction(nav('PersonalPlanMine'), ON)!.payload!.name, 'Kayit');
  const has = { ...ON, status: 'has' as const };
  assert.equal(redirectGateAction(nav('TakibeBasla', { editGoal: true }), has)!.payload!.name, 'PersonalPlanMine');
  assert.deepEqual(redirectGateAction(nav('TakibeBasla'), { ...has, kisiselPlan: false })!.payload, { name: 'KayitShort', params: { mode: 'short', origin: 'gate', returnTo: null } });
  assert.equal(redirectGateAction(nav('NutritionProfile'), has)!.payload!.name, 'PersonalPlanMine');
  assert.equal(redirectGateAction(nav('NutritionProfile'), { ...has, kisiselPlan: false })!.payload!.name, 'KayitShort');
  assert.equal(redirectGateAction(nav('PersonalPlanMine'), has), null);
});

test('oturumsuz: takip rotası → giriş katmanı (Login = AuthSheet)', () => {
  assert.deepEqual(redirectGateAction(nav('AiScan'), { ...ON, session: false })!.payload, { name: 'Login', params: undefined });
  assert.equal(redirectGateAction(nav('TakibeBasla'), { ...ON, session: false }), null);
});

test('(g) bayrak kapalıyken eski davranış: hiçbir eylem değişmez', () => {
  const off = { ...ON, flag: false };
  for (const r of ['AiScan', 'CoachChat', 'TakibeBasla', 'NutritionProfile', 'PersonalPlanMine', 'Login']) {
    assert.equal(redirectGateAction(nav(r), off), null, r);
  }
});

test('giriş sonrası: sipariş → o ekran; uygulama içi ekran → katman kapanır; giriş noktası → profil kuralı', () => {
  assert.equal(postAuthTarget({ redirectTo: 'Checkout', below: 'Kayit', status: 'none' }), 'redirect');
  assert.equal(postAuthTarget({ redirectTo: 'Addresses', status: 'has' }), 'redirect');
  assert.equal(postAuthTarget({ below: 'EkCart', status: 'none' }), 'back');
  assert.equal(postAuthTarget({ below: 'SharedPost', status: 'has' }), 'back');
  assert.equal(postAuthTarget({ below: 'Kayit', status: 'has' }), 'home');
  assert.equal(postAuthTarget({ below: 'Kayit', status: 'unknown' }), 'home');
  assert.equal(postAuthTarget({ below: 'Kayit', status: 'none' }), 'kayit');
  assert.equal(postAuthTarget({ below: 'Tabs', status: 'none' }), 'kayit');
  assert.equal(postAuthTarget({ below: undefined, status: 'none' }), 'kayit');
});

test('akış sonu: dokunulan eyleme dönüş (Tara → Ana sayfa + Tara; Elle gir/su → Ana sayfa parametresi)', () => {
  assert.deepEqual(completionRoutes(null), { reset: [{ name: 'Tabs', params: { screen: 'Tracker' } }], then: null });
  assert.deepEqual(completionRoutes({ name: 'AiScan' }), { reset: [{ name: 'Tabs', params: { screen: 'Tracker' } }], then: { name: 'AiScan' } });
  const manual = { name: 'Tabs', params: { screen: 'Tracker', params: { finOpenManual: 'lunch' } } };
  assert.deepEqual(completionRoutes(manual), { reset: [manual], then: null });
});

test('ilk kayıt (T1 yalnız bunda): hesap son 15 dk içinde oluştu', () => {
  const now = Date.parse('2026-11-14T10:00:00Z');
  assert.equal(isFreshAccount('2026-11-14T09:55:00Z', now), true);
  assert.equal(isFreshAccount('2026-11-14T09:40:00Z', now), false);
  assert.equal(isFreshAccount('2025-01-01T00:00:00Z', now), false);
  assert.equal(isFreshAccount(undefined, now), false);
  assert.equal(isFreshAccount('bozuk', now), false);
});
