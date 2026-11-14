// G54-S1 md.2 — Kişisel plan tek okuyucu: yeni kayıt biçimi · eski G34 biçimi · yalnız satır hedefleri (kısa profil /
// eski profil) · plan yok. Yönlendirici: eski funnel (`PersonalPlan`) bayrak açıkken hiçbir rotadan açılmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planFromRow, planSourceOf } from '../planReader';
import { computePlan } from '../calc';
import { emptyAnswers, effectiveTargets, type PpSaved } from '../types';
import { computeKayitPlan, toPpSaved } from '../../kayit/plan';
import { emptyKAnswers } from '../../kayit/model';
import { redirectGateAction, rowHasProfile, type GateCtx } from '../../kayit/gateLogic';

const ROOT = join(__dirname, '../../../..');
const YEAR = 2026;
const TODAY = '2026-11-14';
const roundTrip = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function kayitRow() {
  const a = { ...emptyKAnswers(), goal: 'lose' as const, gender: 'male' as const, birthYear: 1990, heightCm: 182, weightKg: 92, targetWeightKg: 84, pace: 0.5 as const, activity: 'moderate' as const, diet: 'all' as const, dislikes: ['mushroom' as const], meals: 4, cooking: 'sometimes' as const, struggle: 'evening_snack' as const };
  const plan = computeKayitPlan(a, { currentYear: YEAR, startIso: TODAY })!;
  const saved = toPpSaved(a, plan, { startIso: TODAY, nowIso: `${TODAY}T10:00:00Z`, start: 'track' });
  return { plan, row: { user_id: 'u1', target_calories: plan.calories, personal_plan: roundTrip(saved) } };
}

test('yeni kayıt biçimi (G42 toPpSaved) → dolu plan: kalori, makrolar, hedef kilo/tempo, öğün dağılımı, kayıt cevapları korunur', () => {
  const { plan, row } = kayitRow();
  const p = planFromRow(row, YEAR, TODAY);
  assert.ok(p);
  assert.equal(planSourceOf(row), 'personal_plan');
  const t = effectiveTargets(p);
  assert.equal(t.calories, plan.calories);
  assert.equal(t.protein, plan.protein);
  assert.equal(t.carbs, plan.carbs);
  assert.equal(t.fat, plan.fat);
  assert.equal(p.answers.targetWeightKg, 84);
  assert.equal(p.answers.pace, 0.5);
  assert.equal(p.answers.meals.main + p.answers.meals.snack, 4);
  assert.deepEqual((p.kayit as { dislikes: string[] }).dislikes, ['mushroom']);
  assert.equal(p.source, undefined);
});

test('eski G34 biçimi (kayit anahtarı yok) → dolu plan', () => {
  const answers = { ...emptyAnswers(), goal: 'lose' as const, gender: 'female' as const, birthYear: 1994, heightCm: 168, weightKg: 70, activity: 'light' as const, targetWeightKg: 64, pace: 0.5 as const };
  const result = computePlan({ goal: 'lose', gender: 'female', birthYear: 1994, heightCm: 168, weightKg: 70, activity: 'light', targetWeightKg: 64, pace: 0.5 }, YEAR, '2026-09-01')!;
  const { consentHealth: _h, consentAllergy: _a, ...rest } = answers;
  void _h;
  void _a;
  const saved: PpSaved = { v: 1, answers: rest, result, custom: null, startedAt: '2026-09-01', startWeightKg: 70, targetDate: result.targetDate, updatedAt: '2026-09-01T00:00:00Z' };
  const p = planFromRow({ personal_plan: roundTrip(saved), target_calories: result.calories }, YEAR, TODAY);
  assert.ok(p);
  assert.equal(effectiveTargets(p).calories, result.calories);
  assert.equal(p.startedAt, '2026-09-01');
});

test('personal_plan yok, satırda hedef var (B kısa profil / eski profil) → satır hedefleriyle dolu plan', () => {
  const row = { target_calories: 2320, target_protein: 150, target_carbs: 250, target_fat: 75, goal: 'lose_weight', gender: 'male', age: 36, height: 182, weight: 92.4, activity_level: 'moderate', created_at: '2026-05-03T10:00:00Z', updated_at: '2026-11-14T09:00:00Z' };
  assert.equal(planSourceOf(row), 'targets');
  const p = planFromRow(row, YEAR, TODAY);
  assert.ok(p);
  assert.deepEqual(effectiveTargets(p), { calories: 2320, protein: 150, fat: 75, carbs: 250 });
  assert.equal(p.answers.goal, 'lose');
  assert.equal(p.answers.weightKg, 92.4);
  assert.equal(p.answers.birthYear, 1990);
  assert.equal(p.source, 'targets');
  // Profil kapısıyla aynı tanım.
  assert.equal(rowHasProfile(row), true);
});

test('eksik cevaplı eski satır (yalnız hedef kalori) → yine dolu (makrolar hesaplanır)', () => {
  const p = planFromRow({ target_calories: 1800 }, YEAR, TODAY);
  assert.ok(p);
  const t = effectiveTargets(p);
  assert.equal(t.calories, 1800);
  assert.ok(t.protein > 0 && t.carbs > 0 && t.fat > 0);
});

test('plan yok (satır yok / hedef 0 / bozuk jsonb) → null (boş hâl yalnız gerçekten plan yoksa)', () => {
  assert.equal(planFromRow(null, YEAR, TODAY), null);
  assert.equal(planFromRow({ target_calories: 0, personal_plan: null }, YEAR, TODAY), null);
  assert.equal(planFromRow({ personal_plan: { v: 2 } }, YEAR, TODAY), null);
  assert.equal(planSourceOf({}), null);
});

const ctx = (o: Partial<GateCtx> = {}): GateCtx => ({ flag: true, kisiselPlan: true, session: true, status: 'has', ...o });
const nav = (name: string, params?: Record<string, unknown>) => ({ type: 'NAVIGATE', payload: { name, params } });

test('eski funnel `PersonalPlan` (bayrak açık): profil var → Kişisel planım; yok → yeni kayıt akışı; oturumsuz → giriş', () => {
  assert.equal(redirectGateAction(nav('PersonalPlan', { origin: 'mine' }), ctx())?.payload?.name, 'PersonalPlanMine');
  assert.equal(redirectGateAction(nav('PersonalPlan', { origin: 'home' }), ctx({ status: 'unknown' }))?.payload?.name, 'PersonalPlanMine');
  const k = redirectGateAction({ type: 'REPLACE', payload: { name: 'PersonalPlan' } }, ctx({ status: 'none' }));
  assert.equal(k?.payload?.name, 'Kayit');
  assert.deepEqual(k?.payload?.params, { entry: 'gate', returnTo: null });
  assert.equal(redirectGateAction(nav('PersonalPlan'), ctx({ session: false }))?.payload?.name, 'Login');
  // Bayrak kapalı → eski davranış.
  assert.equal(redirectGateAction(nav('PersonalPlan'), ctx({ flag: false })), null);
});

test('AppNavigator: `PersonalPlan` yalnız !yeniKayit dalında kayıtlı; MyPlan boş hâli yeni kayıt akışına gider', () => {
  const nav = readFileSync(join(ROOT, 'src/navigation/AppNavigator.tsx'), 'utf8');
  assert.match(nav, /\{kisiselPlan && !yeniKayit \? <Stack\.Screen name="PersonalPlan" /);
  const mine = readFileSync(join(ROOT, 'src/modules/personalPlan/screens/MyPlanScreen.tsx'), 'utf8');
  assert.match(mine, /if \(yeniKayit\) navigation\.replace\('Kayit', \{ entry: 'gate', returnTo: \{ name: 'PersonalPlanMine' \} \}\);/);
});
