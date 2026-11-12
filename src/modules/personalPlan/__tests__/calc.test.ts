// G34-S1 md.6 — Kişisel plan hesap + güvenlik kuralları (sınır testleri).
// Çalıştırma: npm run test:unit (tsx --test, Node — RN import YOK).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVITY_FACTOR,
  addDays,
  applyCustom,
  bmi,
  calorieFloor,
  canOfferLose,
  checkinSuggestion,
  clampPace,
  computeBmr,
  computeMacros,
  computePlan,
  editWarning,
  GAIN_SURPLUS_MAX,
  gainSurplus,
  goalAllowed,
  goalNeedsTarget,
  inputComplete,
  isMinor,
  maxWeeklyKg,
  minHealthyWeight,
  paceAllowed,
  paceOptions,
  round10,
  suggestTarget,
  targetRange,
  targetValid,
  weekIndex,
  withCustom,
  type PpCalcInput,
} from '../calc';

const YEAR = 2026;
const START = '2026-11-12';

// Tasarımdaki örnek kişi: kadın, 1994, 168 cm, 72 kg → 65 kg, 0,5 kg/hafta, hafif hareketli.
const sample: PpCalcInput = {
  goal: 'lose',
  gender: 'female',
  birthYear: 1994,
  heightCm: 168,
  weightKg: 72,
  activity: 'light',
  targetWeightKg: 65,
  pace: 0.5,
};

test('tasarım örneği: BMR 1449 · TDEE 1992 · açık 550 · kalori 1440 · P130 Y43 K133 · 14 hafta → 18 Şubat 2027', () => {
  const r = computePlan(sample, YEAR, START);
  assert.ok(r);
  assert.equal(r.steps.formula, 'mifflin');
  assert.equal(r.steps.age, 32);
  assert.equal(r.steps.bmr, 1449); // 10·72 + 6,25·168 − 5·32 − 161
  assert.equal(r.steps.factor, 1.375);
  assert.equal(r.steps.tdee, 1992);
  assert.equal(r.steps.requestedDelta, 550); // 0,5 × 7700 / 7
  assert.equal(r.calories, 1440); // 1442 → 10'a yuvarlandı
  assert.deepEqual(
    { p: r.macros.protein, f: r.macros.fat, c: r.macros.carbs, pk: r.macros.proteinKcal, fk: r.macros.fatKcal },
    { p: 130, f: 43, c: 133, pk: 520, fk: 389 },
  );
  assert.equal(r.weeks, 14);
  assert.equal(r.targetDate, '2027-02-18');
  assert.equal(r.steps.floored, false);
  assert.equal(r.dateShifted, false);
});

test('aktivite katsayıları 1,2 / 1,375 / 1,55 / 1,725', () => {
  assert.deepEqual(ACTIVITY_FACTOR, { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 });
  const r = computePlan({ ...sample, activity: 'active' }, YEAR, START)!;
  assert.equal(r.steps.tdee, Math.round(1449 * 1.725));
});

test('Mifflin erkek +5; belirtmeyen kadın formülü (−161) ama taban 1500', () => {
  const m = computeBmr({ gender: 'male', birthYear: 1994, heightCm: 180, weightKg: 80 }, YEAR);
  assert.equal(m.bmr, Math.round(800 + 1125 - 160 + 5));
  const u = computeBmr({ gender: 'unspecified', birthYear: 1994, heightCm: 180, weightKg: 80 }, YEAR);
  assert.equal(u.sexConst, -161);
  assert.equal(calorieFloor('unspecified'), 1500);
  assert.equal(calorieFloor('male'), 1500);
  assert.equal(calorieFloor('female'), 1200);
});

test('Katch-McArdle: yağ oranı girilirse 370 + 21,6 × yağsız kütle', () => {
  const b = computeBmr({ gender: 'female', birthYear: 1994, heightCm: 168, weightKg: 72, bodyFatPct: 30 }, YEAR);
  assert.equal(b.formula, 'katch');
  assert.equal(b.leanMassKg, 50.4);
  assert.equal(b.bmr, Math.round(370 + 21.6 * 50.4));
  const r = computePlan({ ...sample, bodyFatPct: 30 }, YEAR, START)!;
  assert.equal(r.steps.formula, 'katch');
  assert.equal(r.steps.bmr, 1459);
});

test('Katch-McArdle: geçersiz yağ oranı (≤ 2, > 60, NaN) → Mifflin', () => {
  for (const bf of [2, 61, Number.NaN, null, undefined]) {
    assert.equal(computeBmr({ gender: 'male', birthYear: 1990, heightCm: 175, weightKg: 80, bodyFatPct: bf as number }, YEAR).formula, 'mifflin');
  }
  assert.equal(computeBmr({ gender: 'male', birthYear: 1990, heightCm: 175, weightKg: 80, bodyFatPct: 3 }, YEAR).formula, 'katch');
  assert.equal(computeBmr({ gender: 'male', birthYear: 1990, heightCm: 175, weightKg: 80, bodyFatPct: 60 }, YEAR).formula, 'katch');
});

test('VKİ sınırı 18,5: altında Kilo ver sunulmaz, tam 18,5 sunulur', () => {
  // 170 cm: 18,5 × 1,7² = 53,465 kg
  assert.equal(canOfferLose(53.4, 170), false);
  assert.equal(canOfferLose(53.465, 170), true);
  assert.equal(canOfferLose(53.5, 170), true);
  assert.equal(goalAllowed('lose', 50, 170), false);
  assert.equal(goalAllowed('maintain', 50, 170), true);
  assert.equal(goalAllowed('gain', 50, 170), true);
  assert.equal(goalAllowed('balanced', 50, 170), true);
  assert.ok(Math.abs(bmi(72, 168) - 25.51) < 0.01);
  // Bilinmiyorsa (temel bilgiler henüz yok) engellenmez.
  assert.equal(canOfferLose(null, null), true);
});

test('%1 kuralı: 0,75 yalnız ≤ vücut ağırlığının %1\'i ise açık', () => {
  assert.equal(paceAllowed('lose', 0.75, 74.9), false);
  assert.equal(paceAllowed('lose', 0.75, 75), true);
  assert.equal(paceAllowed('lose', 0.75, 72), false);
  assert.equal(maxWeeklyKg(72), 0.72);
  assert.equal(paceAllowed('lose', 0.5, 50), true);
  assert.equal(paceAllowed('lose', 0.25, 40), true);
  // Kas kazan yalnız 0,25 / 0,5
  assert.deepEqual([...paceOptions('gain')], [0.25, 0.5]);
  assert.equal(paceAllowed('gain', 0.75, 120), false);
  assert.equal(paceAllowed('gain', 0.5, 70), true);
  assert.deepEqual([...paceOptions('lose')], [0.25, 0.5, 0.75]);
  assert.deepEqual([...paceOptions('maintain')], []);
});

test('clampPace: kapalı tempo seçiliyse açık en yakın alta iner; hesap da kapalı tempoyu kullanmaz', () => {
  assert.equal(clampPace('lose', 0.75, 72), 0.5);
  assert.equal(clampPace('lose', 0.75, 80), 0.75);
  assert.equal(clampPace('gain', 0.75, 80), 0.5);
  const r = computePlan({ ...sample, pace: 0.75 }, YEAR, START)!;
  assert.equal(r.requestedPace, 0.5);
  assert.equal(r.steps.requestedDelta, 550);
});

test('kalori tabanı (kadın 1200): tabanın altına inmez, tempo düşer, tarih kayar', () => {
  // Kadın, 1994, 160 cm, 80 kg, çok az hareket, 0,75 (80 kg → açık).
  const r = computePlan(
    { goal: 'lose', gender: 'female', birthYear: 1994, heightCm: 160, weightKg: 80, activity: 'sedentary', targetWeightKg: 68, pace: 0.75 },
    YEAR,
    START,
  )!;
  // BMR = 800 + 1000 − 160 − 161 = 1479 · TDEE = 1775 · 1775 − 825 = 950 < 1200
  assert.equal(r.steps.bmr, 1479);
  assert.equal(r.steps.tdee, 1775);
  assert.equal(r.calories, 1200);
  assert.equal(r.steps.floored, true);
  assert.equal(r.effectivePace, 0.52); // (1775 − 1200) × 7 / 7700
  assert.equal(r.requestedWeeks, 16);
  assert.equal(r.weeks, Math.ceil(12 / 0.52));
  assert.equal(r.dateShifted, true);
  assert.notEqual(r.targetDate, r.requestedTargetDate);
});

test('kalori tabanı (erkek/belirtmeyen 1500)', () => {
  const r = computePlan(
    { goal: 'lose', gender: 'unspecified', birthYear: 1990, heightCm: 160, weightKg: 60, activity: 'sedentary', targetWeightKg: 55, pace: 0.5 },
    YEAR,
    START,
  )!;
  assert.ok(r.calories >= 1500);
  assert.equal(r.calories, 1500);
});

test('TDEE tabanın altındaysa: kalori = taban, hedefe ulaşılamaz (unreachable), tarih yok', () => {
  const r = computePlan(
    { goal: 'lose', gender: 'female', birthYear: 1950, heightCm: 150, weightKg: 50, activity: 'sedentary', targetWeightKg: 45, pace: 0.25 },
    YEAR,
    START,
  )!;
  assert.equal(r.calories, 1200);
  assert.equal(r.unreachable, true);
  assert.equal(r.targetDate, null);
});

test('18 yaş sınırı: 17 kapalı, 18 açık', () => {
  assert.equal(isMinor(2009, YEAR), true); // 17
  assert.equal(isMinor(2008, YEAR), false); // 18
  assert.equal(isMinor(null, YEAR), false);
  assert.equal(inputComplete({ ...sample, birthYear: 2009 }, YEAR), false);
  assert.equal(computePlan({ ...sample, birthYear: 2009 }, YEAR, START), null);
  assert.ok(computePlan({ ...sample, birthYear: 2008 }, YEAR, START));
});

test('koru / dengeli: açık yok, hedef tarihi yok', () => {
  for (const goal of ['maintain', 'balanced'] as const) {
    const r = computePlan({ ...sample, goal }, YEAR, START)!;
    assert.equal(r.steps.requestedDelta, 0);
    assert.equal(r.calories, round10(1992));
    assert.equal(r.targetDate, null);
    assert.equal(goalNeedsTarget(goal), false);
  }
});

test('kas kazan: fazla = tempo × 7700 / 7 (0,25 → +275, kırpılmaz)', () => {
  const r = computePlan({ ...sample, goal: 'gain', targetWeightKg: 75, pace: 0.25 }, YEAR, START)!;
  assert.equal(r.steps.requestedDelta, -275);
  assert.equal(r.calories, round10(1992 + 275));
  assert.equal(r.weeks, 12);
  assert.equal(r.effectivePace, 0.25);
  assert.equal(r.steps.surplusUncapped, undefined);
});

test('G36 md.11: kas kazan 0,5 → fazla +300 (550 kırpılır); tempo ≈ 0,27; hedef tarihi kırpılmış fazladan', () => {
  assert.equal(GAIN_SURPLUS_MAX, 300);
  assert.equal(gainSurplus(0.25), 275);
  assert.equal(gainSurplus(0.5), 300);
  const r = computePlan({ ...sample, goal: 'gain', targetWeightKg: 75, pace: 0.5 }, YEAR, START)!;
  assert.equal(r.requestedPace, 0.5);
  assert.equal(r.steps.requestedDelta, -300);
  assert.equal(r.steps.surplusUncapped, 550);
  assert.equal(r.calories, 2290); // 1992 + 300 = 2292 → 2290
  assert.equal(r.effectivePace, 0.27); // 300 × 7 / 7700
  assert.equal(r.weeks, 12); // 3 kg ÷ 0,27 = 11,1 → 12 hafta
  assert.equal(r.targetDate, addDays(START, 12 * 7));
  assert.equal(r.requestedWeeks, 6); // 0,5 ile olacaktı
  assert.equal(r.dateShifted, false); // taban kayması değil
});

test('G36 md.11: yuvarlama +300 sınırını aşmaz (bütün kilolarda kalori − TDEE ≤ 300)', () => {
  for (let w = 50; w <= 110; w += 0.5) {
    for (const pace of [0.25, 0.5] as const) {
      const r = computePlan({ ...sample, weightKg: w, goal: 'gain', targetWeightKg: w + 3, pace }, YEAR, START);
      if (!r) continue;
      assert.ok(r.calories - r.steps.tdee <= GAIN_SURPLUS_MAX, `w=${w} pace=${pace}: ${r.calories} − ${r.steps.tdee}`);
    }
  }
});

test('hedef kilo: yön ve sağlıklı alt sınır (VKİ 18,5)', () => {
  assert.equal(minHealthyWeight(168), 52.5); // 18,5 × 1,68² = 52,21 → 52,5
  assert.equal(targetValid('lose', 72, 168, 65), true);
  assert.equal(targetValid('lose', 72, 168, 72), false);
  assert.equal(targetValid('lose', 72, 168, 52), false);
  assert.equal(targetValid('gain', 72, 168, 71), false);
  assert.equal(targetValid('gain', 72, 168, 75), true);
  assert.equal(targetValid('maintain', 72, 168, null), true);
  assert.deepEqual(targetRange('lose', 72, 168), { min: 52.5, max: 71.5 });
  assert.deepEqual(targetRange('gain', 72, 168), { min: 72.5, max: 102 });
  assert.equal(suggestTarget('lose', 72, 168), 65);
  assert.equal(suggestTarget('lose', 54, 170), 53.5);
  assert.equal(suggestTarget('gain', 72, 168), 75);
});

test('geçersiz hedef kilo → hedef tarihi yok, tempo 0 (açık yok)', () => {
  const r = computePlan({ ...sample, targetWeightKg: 80 }, YEAR, START)!;
  assert.equal(r.targetDate, null);
  assert.equal(r.steps.requestedDelta, 0);
});

test('makrolar: protein 1,8 g/kg, yağ %27, karbonhidrat kalan (negatif olmaz)', () => {
  const m = computeMacros(2000, 80);
  assert.equal(m.protein, 144);
  assert.equal(m.fatKcal, 540);
  assert.equal(m.fat, 60);
  assert.equal(m.carbs, Math.round((2000 - 576 - 540) / 4));
  assert.equal(computeMacros(1200, 200).carbs, 0);
});

test('Düzenle: kalori tabanın altına inmez; uyarılar', () => {
  const sug = computePlan(sample, YEAR, START)!;
  assert.deepEqual(applyCustom({ calories: 1000, protein: 130, fat: 40 }, 'female').calories, 1200);
  assert.equal(applyCustom({ calories: 1500, protein: 130, fat: 40 }, 'female').carbs, Math.round((1500 - 520 - 360) / 4));
  assert.equal(editWarning({ calories: 1100, protein: 130, fat: 43 }, sug, 'female', 72), 'below_floor');
  assert.equal(editWarning({ calories: 1200, protein: 130, fat: 43 }, sug, 'female', 72), 'far_from_suggestion');
  assert.equal(editWarning({ calories: 1440, protein: 50, fat: 43 }, sug, 'female', 72), 'protein_low');
  assert.equal(editWarning({ calories: 1400, protein: 130, fat: 43 }, sug, 'female', 72), null);
});

// ─── Check-in ────────────────────────────────────────────────────────────────
const plan = { goal: 'lose' as const, calories: 1440, pace: 0.5, targetWeightKg: 65, gender: 'female' as const, heightCm: 168 };

test('check-in: tek tartı → öneri yok', () => {
  const s = checkinSuggestion([{ date: '2026-11-12', weightKg: 72 }], plan, '2026-11-12');
  assert.equal(s.kind, 'none');
  assert.equal(s.newCalories, null);
});

test('check-in: bu hafta arttı ama trend yok → dalgalanma (plan değişmez)', () => {
  const s = checkinSuggestion(
    [
      { date: '2026-11-12', weightKg: 72 },
      { date: '2026-11-19', weightKg: 72.3 },
    ],
    plan,
    '2026-11-19',
  );
  assert.equal(s.kind, 'fluctuation');
  assert.equal(s.weekDelta, 0.3);
  assert.equal(s.newCalories, null);
  assert.ok(s.autoTargetDate);
});

test('check-in: yavaş (0,37 < 0,5×0,8) → kademeli −100 kcal öneri, tabanın altına inmez; kalori kendiliğinden değişmez', () => {
  const s = checkinSuggestion(
    [
      { date: '2026-11-12', weightKg: 72 },
      { date: '2026-11-19', weightKg: 71.7 },
      { date: '2026-11-26', weightKg: 71.4 },
      { date: '2026-12-03', weightKg: 70.9 },
    ],
    plan,
    '2026-12-03',
  );
  assert.equal(s.kind, 'slow');
  assert.equal(s.avgRate, 0.37);
  assert.equal(s.estTdee, Math.round(1440 + (1.1 / 3) * 1100));
  assert.equal(s.newCalories, 1340);
  assert.ok(s.newPace! > 0.3 && s.newPace! < 0.5);
  assert.ok(s.newMacros);
  assert.ok(s.newTargetDate);
});

test('check-in: yavaş ama taban 1200\'de → öneri yok', () => {
  const s = checkinSuggestion(
    [
      { date: '2026-11-12', weightKg: 72 },
      { date: '2026-11-19', weightKg: 72 },
      { date: '2026-11-26', weightKg: 71.9 },
      { date: '2026-12-03', weightKg: 71.9 },
    ],
    { ...plan, calories: 1200 },
    '2026-12-03',
  );
  assert.notEqual(s.kind, 'slow');
  assert.equal(s.newCalories, null);
});

test('check-in: hızlı (0,8 > %1 = 0,70) → kaloriyi artır, tempo plana döner (tasarım: 1440 → 1770)', () => {
  const s = checkinSuggestion(
    [
      { date: '2026-11-12', weightKg: 72 },
      { date: '2026-11-19', weightKg: 71.2 },
      { date: '2026-11-26', weightKg: 70.4 },
      { date: '2026-12-03', weightKg: 69.6 },
    ],
    plan,
    '2026-12-03',
  );
  assert.equal(s.kind, 'fast');
  assert.equal(s.avgRate, 0.8);
  assert.equal(s.safeMax, 0.7);
  assert.equal(s.estTdee, 2320);
  assert.equal(s.newCalories, 1770);
  assert.equal(s.newPace, 0.5);
});

test('check-in: planında → on_track, öneri yok; hedef tarihi kendiliğinden son tartıdan', () => {
  const s = checkinSuggestion(
    [
      { date: '2026-11-12', weightKg: 72 },
      { date: '2026-11-19', weightKg: 71.5 },
      { date: '2026-11-26', weightKg: 71 },
      { date: '2026-12-03', weightKg: 70.5 },
    ],
    plan,
    '2026-12-03',
  );
  assert.equal(s.kind, 'on_track');
  assert.equal(s.newCalories, null);
  assert.equal(s.autoTargetDate, addDays('2026-12-03', 11 * 7)); // 5,5 kg / 0,5 = 11 hafta
});

test('check-in: kas kazan yavaş → kalori artışı önerisi', () => {
  const s = checkinSuggestion(
    [
      { date: '2026-11-12', weightKg: 70 },
      { date: '2026-11-19', weightKg: 70 },
      { date: '2026-11-26', weightKg: 70.1 },
      { date: '2026-12-03', weightKg: 70.1 },
    ],
    { goal: 'gain', calories: 2270, pace: 0.25, targetWeightKg: 75, gender: 'female', heightCm: 168 },
    '2026-12-03',
  );
  assert.equal(s.kind, 'slow');
  assert.ok(s.newCalories! > 2270);
});

test('G36 md.11: check-in kas kazan yavaş önerisi de +300 fazlayı aşmaz', () => {
  const s = checkinSuggestion(
    [
      { date: '2026-11-12', weightKg: 70 },
      { date: '2026-11-19', weightKg: 70.2 },
      { date: '2026-11-26', weightKg: 70.4 },
      { date: '2026-12-03', weightKg: 70.6 },
    ],
    { goal: 'gain', calories: 2290, pace: 0.5, targetWeightKg: 75, gender: 'female', heightCm: 168 },
    '2026-12-03',
  );
  assert.equal(s.kind, 'slow');
  assert.equal(s.estTdee, 2070); // 2290 − 0,2 kg × 7700 / 7
  assert.equal(s.newCalories, 2370); // en çok 2070 + 300 (eski kural 2440 verirdi)
});

test('weekIndex', () => {
  assert.equal(weekIndex('2026-11-12', '2026-11-12'), 1);
  assert.equal(weekIndex('2026-11-12', '2026-11-26'), 3);
});

test('withCustom: Düzenle ile 1200 kcal → tempo 0,72, 10 hafta (tasarım: 21 Ocak 2027)', () => {
  const r = computePlan(sample, YEAR, START)!;
  const w = withCustom(r, { goal: 'lose', weightKg: 72, targetWeightKg: 65 }, 1200, START);
  assert.equal(w.pace, 0.72); // (1992 − 1200) × 7 / 7700
  assert.equal(w.weeks, 10);
  assert.equal(w.date, '2027-01-21');
  assert.deepEqual(withCustom(r, { goal: 'lose', weightKg: 72, targetWeightKg: 65 }, null, START), { pace: 0.5, weeks: 14, date: '2027-02-18' });
  assert.equal(withCustom(r, { goal: 'lose', weightKg: 72, targetWeightKg: 65 }, 2100, START).date, null); // açık yok
});
