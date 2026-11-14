// G54-S1 md.5 — düzenleme özeti saf mantığı: kayıtlı plandan cevaplara dönüş, görünür satırlar, önce→sonra, yönlendirme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeKayitPlan, editDiff, fromPpSaved, toPpSaved, visibleEditRows, answersDirty } from '../plan';
import { emptyKAnswers, type KAnswers } from '../model';
import { redirectGateAction } from '../gateLogic';

const A: KAnswers = { ...emptyKAnswers(), goal: 'lose', gender: 'male', birthYear: 1990, heightCm: 182, weightKg: 92, targetWeightKg: 84, pace: 0.5, activity: 'moderate', sportDays: [0, 2], sports: ['run'], diet: 'all', cuisines: ['japon', 'ege'], dislikes: ['mushroom', 'custom:Ejder meyvesi'], meals: 4, cooking: 'sometimes', struggle: 'sweet' };

test('kayıtlı plan → cevaplar: kayıt akışının yazdığı her alan geri gelir (15 satır)', () => {
  const plan = computeKayitPlan(A, { currentYear: 2026, startIso: '2026-11-14' })!;
  const saved = JSON.parse(JSON.stringify(toPpSaved(A, plan, { startIso: '2026-11-14', nowIso: '2026-11-14T10:00:00Z', start: 'track' })));
  const back = fromPpSaved(saved);
  for (const k of ['goal', 'gender', 'birthYear', 'heightCm', 'weightKg', 'targetWeightKg', 'pace', 'activity', 'sportDays', 'sports', 'diet', 'cuisines', 'dislikes', 'meals', 'cooking', 'struggle', 'noSport', 'eatsAll'] as const) {
    assert.deepEqual(back[k], A[k], k);
  }
  assert.equal(answersDirty(back, A), false);
  assert.equal(answersDirty({ ...back, meals: 3 }, A), true);
});

test('görünür satırlar: hedef kilo / tempo kayıttaki koşulla; diğer 13 satır her zaman', () => {
  assert.equal(visibleEditRows({ goal: 'lose' }).length, 15);
  assert.deepEqual(visibleEditRows({ goal: 'maintain' }).filter((r) => r === 'target' || r === 'pace'), []);
  assert.deepEqual(visibleEditRows({ goal: 'muscle' }).filter((r) => r === 'target' || r === 'pace'), ['target']);
});

test('önce → sonra: değişiklik yeniden hesaplanır (kayıttaki aynı hesap)', () => {
  const before = computeKayitPlan(A, { currentYear: 2026, startIso: '2026-11-14' })!;
  const after = computeKayitPlan({ ...A, goal: 'maintain' }, { currentYear: 2026, startIso: '2026-11-14' })!;
  const d = editDiff({ calories: before.calories, protein: before.protein, carbs: before.carbs, fat: before.fat }, after);
  assert.equal(d.from, before.calories);
  assert.equal(d.to, after.calories);
  assert.equal(d.changed, true);
});

test('yönlendirme (bayrak açık): eski "Tek ekranda düzenle" → KayitEdit; profil yoksa kayıt akışı', () => {
  const c = { flag: true, kisiselPlan: true, session: true, status: 'has' as const };
  assert.equal(redirectGateAction({ type: 'NAVIGATE', payload: { name: 'PersonalPlanEdit' } }, c)?.payload?.name, 'KayitEdit');
  assert.equal(redirectGateAction({ type: 'NAVIGATE', payload: { name: 'PersonalPlanEdit' } }, { ...c, status: 'none' })?.payload?.name, 'Kayit');
  assert.equal(redirectGateAction({ type: 'NAVIGATE', payload: { name: 'PersonalPlanEdit' } }, { ...c, flag: false }), null);
});
