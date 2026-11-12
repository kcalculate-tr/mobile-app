// G34-S1 md.6 — akış haritası (05) durum makinesi + erişim tablosu + şema okuma testleri.
import test from 'node:test';
import assert from 'node:assert/strict';

import { nextStep, prevStep, progressOf, questionSteps, remainingQuestions, resumable, stepComplete, type FlowCtx } from '../flow';
import { dayLocked, paywallPlanFor, planAccess } from '../access';
import { effectiveTargets, emptyAnswers, mealSlots, parseSaved, shiftTime } from '../types';
import { computePlan } from '../calc';

const YEAR = 2026;
const ctx = (over: Partial<FlowCtx['answers']> = {}, known = false): FlowCtx => ({
  known,
  currentYear: YEAR,
  answers: { goal: 'lose', birthYear: 1994, heightCm: 168, weightKg: 72, activity: 'light', gender: 'female', ...over },
});

test('b yolu: 8 soru, Hedef kilo yalnız kilo ver / kas kazan', () => {
  assert.deepEqual(questionSteps(ctx()), ['goal', 'basics', 'target', 'activity', 'exercise', 'measure', 'diet', 'meals']);
  assert.equal(questionSteps(ctx({ goal: 'maintain' })).length, 7);
  assert.equal(questionSteps(ctx({ goal: 'balanced' })).includes('target'), false);
  assert.equal(questionSteps(ctx({ goal: 'gain' })).includes('target'), true);
  assert.deepEqual(progressOf('target', ctx()), { index: 3, total: 8 });
  assert.equal(progressOf('intro', ctx()), null);
  assert.equal(progressOf('calc', ctx()), null);
  assert.equal(progressOf('result', ctx()), null);
});

test('a yolu: Bildiklerimiz sonra yalnız 5 yeni soru (hedef kilosuzda 4)', () => {
  const k = ctx({}, true);
  assert.equal(nextStep('intro', k), 'known');
  assert.deepEqual(questionSteps(k), ['target', 'exercise', 'measure', 'diet', 'meals']);
  assert.equal(nextStep('known', k), 'target');
  assert.equal(questionSteps(ctx({ goal: 'maintain' }, true)).length, 4);
  assert.equal(nextStep('known', ctx({ goal: 'maintain' }, true)), 'exercise');
  assert.equal(prevStep('target', k), 'known');
  assert.equal(prevStep('known', k), 'intro');
});

test('sıra: ... Öğün düzeni → Hesaplanıyor → Sonuç → Önizleme → Hatırlatıcılar → bitti', () => {
  const c = ctx();
  assert.equal(nextStep('intro', c), 'goal');
  assert.equal(nextStep('goal', c), 'basics');
  assert.equal(nextStep('basics', c), 'target');
  assert.equal(nextStep('meals', c), 'calc');
  assert.equal(nextStep('calc', c), 'result');
  assert.equal(nextStep('result', c), 'preview');
  assert.equal(nextStep('preview', c), 'remind');
  assert.equal(nextStep('remind', c), 'done');
  assert.equal(nextStep('goal', ctx({ goal: 'maintain' })), 'basics');
  assert.equal(nextStep('basics', ctx({ goal: 'maintain' })), 'activity');
});

test('VKİ dalı: Temel bilgilerden sonra VKİ < 18,5 + Kilo ver → Hedef\'e geri', () => {
  assert.equal(nextStep('basics', ctx({ weightKg: 50, heightCm: 170 })), 'goal');
  assert.equal(nextStep('basics', ctx({ weightKg: 54, heightCm: 170 })), 'target');
  assert.equal(nextStep('basics', ctx({ weightKg: 50, heightCm: 170, goal: 'maintain' })), 'activity');
  // a yolunda da: Bildiklerimiz → Hedef → kalan sorular
  const k = ctx({ weightKg: 50, heightCm: 170 }, true);
  assert.equal(nextStep('known', k), 'goal');
  assert.equal(nextStep('goal', ctx({ weightKg: 50, heightCm: 170, goal: 'maintain' }, true)), 'exercise');
});

test('18 yaş altı → minor (akış kapalı)', () => {
  assert.equal(nextStep('basics', ctx({ birthYear: 2010 })), 'minor');
  assert.equal(nextStep('known', ctx({ birthYear: 2010 }, true)), 'minor');
  assert.equal(nextStep('basics', ctx({ birthYear: 2008 })), 'target');
});

test('geri: ilk sorudan Giriş\'e, Hesap/Sonuç\'tan son soruya; Giriş\'ten çıkış', () => {
  const c = ctx();
  assert.equal(prevStep('goal', c), 'intro');
  assert.equal(prevStep('intro', c), null);
  assert.equal(prevStep('basics', c), 'goal');
  assert.equal(prevStep('result', c), 'meals');
  assert.equal(prevStep('preview', c), 'result');
  assert.equal(prevStep('remind', c), 'preview');
  assert.equal(prevStep('activity', ctx({ goal: 'maintain' })), 'basics');
});

test('Kaldığın yerden: saklanabilir adımlar + kalan soru sayısı', () => {
  assert.equal(resumable('exercise'), true);
  assert.equal(resumable('calc'), false);
  assert.equal(resumable('done'), false);
  assert.equal(resumable('minor'), false);
  assert.equal(remainingQuestions('exercise', ctx()), 4);
  assert.equal(remainingQuestions('meals', ctx()), 1);
});

test('stepComplete: Devam et koşulları', () => {
  const a = emptyAnswers();
  assert.equal(stepComplete('goal', a, YEAR), false);
  a.goal = 'lose';
  a.weightKg = 50;
  a.heightCm = 170;
  assert.equal(stepComplete('goal', a, YEAR), false); // VKİ < 18,5 → Kilo ver geçersiz
  a.goal = 'maintain';
  assert.equal(stepComplete('goal', a, YEAR), true);
  assert.equal(stepComplete('basics', a, YEAR), false);
  Object.assign(a, { gender: 'female', birthYear: 1994 });
  assert.equal(stepComplete('basics', a, YEAR), true);
  assert.equal(stepComplete('exercise', a, YEAR), false);
  a.exercise = ['walk'];
  assert.equal(stepComplete('exercise', a, YEAR), true);
  assert.equal(stepComplete('measure', a, YEAR), true);
});

test('erişim tablosu (05): ücretsiz / Fresh / Balance', () => {
  const f = planAccess('free');
  assert.equal(f.targets && f.targetCurve && f.checkin && f.manualPlanning, true);
  assert.equal(f.openDays, 1);
  assert.equal(f.generate, 'paywall');
  assert.equal(f.shoppingList, false);
  assert.equal(f.coachEdit, false);
  const fr = planAccess('fresh');
  assert.equal(fr.openDays, 7);
  assert.equal(fr.generate, 'template');
  assert.equal(fr.shoppingList, true);
  assert.equal(fr.coachEdit, false);
  const b = planAccess('balance');
  assert.equal(b.generate, 'coach');
  assert.equal(b.coachEdit, true);
  assert.equal(dayLocked('free', 0), false);
  assert.equal(dayLocked('free', 1), true);
  assert.equal(dayLocked('fresh', 6), false);
  assert.equal(paywallPlanFor('coach_edit'), 'balance');
  assert.equal(paywallPlanFor('week'), 'fresh');
});

test('öğün yuvaları ve saat kaydırma', () => {
  assert.deepEqual(mealSlots(3, 1), ['breakfast', 'lunch', 'snack', 'dinner']);
  assert.deepEqual(mealSlots(2, 0), ['lunch', 'dinner']);
  assert.deepEqual(mealSlots(3, 2), ['breakfast', 'lunch', 'snack', 'dinner', 'snack2']);
  assert.equal(shiftTime('08:00', 30), '08:30');
  assert.equal(shiftTime('23:45', 30), '00:15');
  assert.equal(shiftTime('00:00', -15), '23:45');
});

test('parseSaved: bozuk/eski jsonb güvenli; effectiveTargets custom önceliği', () => {
  assert.equal(parseSaved(null), null);
  assert.equal(parseSaved({ v: 2 }), null);
  assert.equal(parseSaved({ v: 1, answers: {} }), null);
  const result = computePlan(
    { goal: 'lose', gender: 'female', birthYear: 1994, heightCm: 168, weightKg: 72, activity: 'light', targetWeightKg: 65, pace: 0.5 },
    YEAR,
    '2026-11-12',
  )!;
  const p = parseSaved({ v: 1, answers: { goal: 'lose', meals: { main: 3 } }, result, custom: null, startedAt: '2026-11-12' })!;
  assert.ok(p);
  assert.equal(p.answers.meals.snack, 1); // varsayılanla tamamlandı
  assert.equal(p.targetDate, '2027-02-18');
  assert.deepEqual(effectiveTargets(p), { calories: 1440, protein: 130, fat: 43, carbs: 133 });
  assert.equal(effectiveTargets({ ...p, custom: { calories: 1500, protein: 120, fat: 45, carbs: 150 } }).calories, 1500);
});
