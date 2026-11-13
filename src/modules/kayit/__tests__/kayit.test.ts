// G42-S1 md.12 — Kayıt akışı saf mantığı: koşullu atlama (P3b, P6/P6k, P7/P7g), dinamik halka,
// birim dönüşümü, plan (G34 motoru), 7 gün saklama, olaylarda sağlık değeri yok, bayrak/yol kuralları.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canContinue,
  cmToFtIn,
  defaultUnits,
  emptyKAnswers,
  firstTabFor,
  flowSequence,
  ftInToCm,
  kgToLb,
  lbToKg,
  mealsSplit,
  nextStep,
  paceOptionsFor,
  prevStep,
  progressOf,
  resolvePath,
  searchDislikes,
  targetValidFor,
  visibleQuestions,
  type KAnswers,
} from '../model';
import { computeKayitPlan, mealDistribution, pickRecipes, planSignature, toPpSaved, MUSCLE_SURPLUS_DEFAULT } from '../plan';
import { computePlan } from '../../personalPlan/calc';
import { parseSaved } from '../../personalPlan/types';
import {
  DRAFT_KEY,
  DRAFT_TTL_MS,
  clearDraft,
  draftDaysLeft,
  isShortPending,
  parseOnb,
  readDraft,
  readOnb,
  rememberStart,
  setShortPending,
  shouldShowReturn,
  takeStart,
  writeDraft,
  writeOnb,
  type KvStore,
} from '../storage';
import { HEALTH_KEYS, __sent, kTrack } from '../events';
import { tr, en } from '../i18n';

const Y = 2026;
const base = (o: Partial<KAnswers> = {}): KAnswers => ({
  ...emptyKAnswers(),
  goal: 'lose',
  gender: 'female',
  birthYear: 1995,
  heightCm: 168,
  weightKg: 72,
  targetWeightKg: 66,
  activity: 'light',
  diet: 'all',
  cooking: 'sometimes',
  struggle: 'sweet',
  ...o,
});

function mem(): KvStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}

test('koşullu atlama: korumak / sağlıklı beslenmekte P6 ve P7 yok', () => {
  for (const goal of ['maintain', 'balanced'] as const) {
    const seq = flowSequence({ goal, targetSkipped: false });
    assert.ok(!seq.includes('target'), goal);
    assert.ok(!seq.includes('pace'), goal);
    assert.equal(nextStep('i1', base({ goal }), Y), 'activity');
  }
});

test('koşullu atlama: kas kazanmakta P6 isteğe bağlı (P6k), P7 sorulmaz', () => {
  const a = base({ goal: 'muscle' });
  const seq = flowSequence(a);
  assert.ok(seq.includes('target'));
  assert.ok(!seq.includes('pace'));
  assert.equal(nextStep('target', a, Y), 'activity');
});

test('koşullu atlama: kilo almakta P7g iki kademe (0,25/0,5); kilo vermekte üç', () => {
  assert.deepEqual([...paceOptionsFor('gain')], [0.25, 0.5]);
  assert.deepEqual([...paceOptionsFor('lose')], [0.25, 0.5, 0.75]);
  assert.equal(canContinue('pace', base({ goal: 'gain', pace: 0.75 })), false);
  assert.equal(canContinue('pace', base({ goal: 'gain', pace: 0.5 })), true);
});

test('P3b: 18 yaş altı doğum yılında Devam → minor; minor → done; geri → P3', () => {
  assert.equal(nextStep('birth', base({ birthYear: 2010 }), Y), 'minor');
  assert.equal(nextStep('birth', base({ birthYear: 2008 }), Y), 'height');
  assert.equal(nextStep('minor', base(), Y), 'done');
  assert.equal(prevStep('minor', base()), 'birth');
});

test('ara ekranlar: I1 P5 sonrası, I2 P10 sonrası; son soru → plan (A) / done (B)', () => {
  const a = base();
  assert.equal(nextStep('weight', a, Y), 'i1');
  assert.equal(nextStep('i1', a, Y), 'target');
  assert.equal(nextStep('diet', a, Y), 'i2');
  assert.equal(nextStep('i2', a, Y), 'dislikes');
  assert.equal(nextStep('struggle', a, Y), 'plan');
  assert.equal(nextStep('activity', a, Y, 'b'), 'done');
  assert.equal(prevStep('goal', a), null);
});

test('dinamik halka: görünen soru sayısı (14 · 12 · 13 · P6k atlanınca 12)', () => {
  assert.equal(visibleQuestions(base()).length, 14);
  assert.equal(visibleQuestions(base({ goal: 'maintain' })).length, 12);
  assert.equal(visibleQuestions(base({ goal: 'muscle' })).length, 13);
  assert.equal(visibleQuestions(base({ goal: 'muscle', targetSkipped: true })).length, 12);
  assert.deepEqual(progressOf('goal', base()), { index: 1, total: 14 });
  assert.deepEqual(progressOf('struggle', base()), { index: 14, total: 14 });
  assert.deepEqual(progressOf('i1', base()), { index: 5, total: 14 });
  assert.deepEqual(progressOf('activity', base({ goal: 'maintain' })), { index: 6, total: 12 });
  assert.deepEqual(progressOf('activity', base({ goal: 'muscle', targetSkipped: true })), { index: 6, total: 12 });
  // atlanmış P6k'ye geri dönülünce halka önceki soruda kalır
  assert.deepEqual(progressOf('target', base({ goal: 'muscle', targetSkipped: true })), { index: 5, total: 12 });
  assert.deepEqual(progressOf('activity', base(), 'b'), { index: 6, total: 6 });
});

test('Devam düğmesi boş hâlde devre dışı; hedef kilo yön kuralı', () => {
  const e = emptyKAnswers();
  for (const s of ['goal', 'gender', 'birth', 'height', 'weight', 'activity', 'diet', 'cooking', 'struggle'] as const) {
    assert.equal(canContinue(s, e), false, s);
  }
  assert.equal(canContinue('sport', e), true);
  assert.equal(canContinue('dislikes', e), true);
  assert.equal(targetValidFor({ goal: 'lose', weightKg: 72, targetWeightKg: 74 }), false);
  assert.equal(targetValidFor({ goal: 'gain', weightKg: 72, targetWeightKg: 74 }), true);
  assert.equal(targetValidFor({ goal: 'muscle', weightKg: 72, targetWeightKg: 70 }), false);
});

test('cetvel birim dönüşümü: cm ↔ ft-in, kg ↔ lb (gidiş-dönüş kararlı)', () => {
  assert.deepEqual(cmToFtIn(170), { ft: 5, inch: 7 });
  assert.equal(ftInToCm(5, 7), 170);
  assert.deepEqual(cmToFtIn(183), { ft: 6, inch: 0 });
  assert.equal(kgToLb(72), 158.7);
  assert.equal(lbToKg(158.7), 72);
  for (let cm = 140; cm <= 210; cm++) {
    const { ft, inch } = cmToFtIn(cm);
    assert.ok(Math.abs(ftInToCm(ft, inch) - cm) <= 2, `${cm}`);
  }
  assert.equal(defaultUnits('tr', 'US'), 'metric');
  assert.equal(defaultUnits('en', 'US'), 'imperial');
  assert.equal(defaultUnits('en', 'DE'), 'metric');
  assert.equal(defaultUnits('en', null), 'metric');
});

test('plan: kilo vermek G34 motoruyla AYNI kalori/makro (yeni formül yok) + aralık bandı', () => {
  const a = base();
  const p = computeKayitPlan(a, { currentYear: Y, startIso: '2026-11-13' })!;
  const g34 = computePlan({ goal: 'lose', gender: 'female', birthYear: 1995, heightCm: 168, weightKg: 72, activity: 'light', targetWeightKg: 66, pace: 0.5 }, Y, '2026-11-13')!;
  assert.equal(p.calories, g34.calories);
  assert.deepEqual([p.protein, p.carbs, p.fat], [g34.macros.protein, g34.macros.carbs, g34.macros.fat]);
  assert.ok(p.rangeFrom && p.rangeTo && p.rangeFrom < p.rangeTo);
  assert.equal(p.meals.reduce((s, m) => s + m.kcal, 0), p.calories);
});

test('plan: kas kazanmak = TDEE + app_settings fazlası (varsayılan 250), tempo yok', () => {
  const a = base({ goal: 'muscle', targetWeightKg: null, targetSkipped: true });
  const p = computeKayitPlan(a, { currentYear: Y, startIso: '2026-11-13' })!;
  const tdee = p.result.steps.tdee;
  assert.equal(p.calories, Math.round((tdee + MUSCLE_SURPLUS_DEFAULT) / 10) * 10);
  assert.equal(p.rangeFrom, null);
  const p2 = computeKayitPlan(a, { currentYear: Y, startIso: '2026-11-13', muscleSurplus: 300 })!;
  assert.equal(p2.calories, Math.round((tdee + 300) / 10) * 10);
  const withTarget = computeKayitPlan(base({ goal: 'muscle', targetWeightKg: 74 }), { currentYear: Y, startIso: '2026-11-13' })!;
  assert.ok(withTarget.result.weeks && withTarget.result.weeks > 0);
});

test('plan: öğün dağılımı 2–5, imza cevap değişince değişir, PpSaved G34 şemasına uyar', () => {
  for (let n = 2; n <= 5; n++) {
    const d = mealDistribution(1850, n);
    assert.equal(d.length, n);
    assert.equal(d.reduce((s, x) => s + x.kcal, 0), 1850);
  }
  assert.deepEqual(mealsSplit(4), { main: 3, snack: 1 });
  assert.notEqual(planSignature(base()), planSignature(base({ weightKg: 73 })));
  assert.equal(planSignature(base()), planSignature(base({ struggle: 'no_time' })));
  const a = base({ dislikes: ['mushroom', 'chicken'] });
  const plan = computeKayitPlan(a, { currentYear: Y, startIso: '2026-11-13' })!;
  const saved = toPpSaved(a, plan, { startIso: '2026-11-13', nowIso: '2026-11-13T10:00:00Z', start: 'track' });
  const parsed = parseSaved(JSON.parse(JSON.stringify(saved)));
  assert.ok(parsed);
  assert.equal(parsed!.result.calories, plan.calories);
  assert.deepEqual(parsed!.answers.dislikes, ['mushroom']);
  assert.equal(parsed!.answers.meals.main, 3);
});

test('tarifler: diyet + yemediklerin filtresi, öğün başına bir', () => {
  const R = (key: string, slot: 'breakfast' | 'lunch' | 'dinner', kcal: number, ing: string[], diets: string[] = ['vegetarian']) => ({ key, nameTr: key, nameEn: key, slot, macros: { kcal }, diets, ingredients: ing.map((k) => ({ key: k })) });
  const list = [R('menemen', 'breakfast', 320, ['egg', 'tomato']), R('oat', 'breakfast', 400, ['oats']), R('kase', 'lunch', 540, ['chicken_breast'], []), R('salata', 'lunch', 500, ['lentil']), R('somon', 'dinner', 480, ['salmon'], ['pescatarian'])];
  const plan = { calories: 1850, meals: mealDistribution(1850, 4) };
  const r = pickRecipes(list, { diet: 'vegetarian', dislikes: ['egg'] }, plan);
  assert.deepEqual(r.map((x) => x.key), ['oat', 'salata']);
});

test('P11 arama: Türkçe büyük/küçük harf, boş sorgu bulut', () => {
  const label = (k: string) => (tr.q as Record<string, string>)[`dl_${k}`] ?? k;
  assert.equal(searchDislikes('', label).length, 12);
  assert.deepEqual(searchDislikes('MANT', label), ['mushroom']);
  assert.deepEqual(searchDislikes('xyzq', label), []);
  assert.deepEqual(searchDislikes('ıspanak', label), ['spinach']);
});

test('7 gün saklama: savedAt ilk yazımda korunur, kalan gün, süre dolunca sessiz silme', async () => {
  const s = mem();
  const t0 = Date.parse('2026-11-13T10:00:00Z');
  const plan = { calories: 1850, protein: 130, carbs: 200, fat: 60 };
  await writeDraft(s, { answers: base(), step: 'result', start: 'track', plan }, t0);
  await writeDraft(s, { answers: base({ meals: 3 }), step: 'signup', start: 'track', plan }, t0 + 2 * 86400000);
  const d = await readDraft(s, t0 + 2 * 86400000);
  assert.ok(d);
  assert.equal(d!.savedAt, new Date(t0).toISOString());
  assert.equal(d!.answers.meals, 3);
  assert.equal(draftDaysLeft(d!.savedAt, t0 + 2 * 86400000), 5);
  assert.equal(shouldShowReturn(d), true);
  assert.equal(await readDraft(s, t0 + DRAFT_TTL_MS - 1000) !== null, true);
  assert.equal(await readDraft(s, t0 + DRAFT_TTL_MS), null);
  assert.equal(s.data.has(DRAFT_KEY), false, 'süre dolunca silinmeli');
  s.data.set(DRAFT_KEY, '{bozuk');
  assert.equal(await readDraft(s, t0), null);
  assert.equal(s.data.has(DRAFT_KEY), false);
  await writeDraft(s, { answers: base(), step: 'goal', start: null, plan: null }, t0);
  assert.equal(shouldShowReturn(await readDraft(s, t0)), false, 'plan yokken kart yok');
  await clearDraft(s);
  assert.equal(await readDraft(s, t0), null);
});

test('onboarding kaldığı yer + tek seferlik başlangıç/kısa profil işaretleri', async () => {
  const s = mem();
  assert.equal(await readOnb(s), null);
  await writeOnb(s, { step: 4, start: 'recipes', path: 'b' });
  assert.deepEqual(await readOnb(s), { step: 4, start: 'recipes', path: 'b' });
  assert.deepEqual(parseOnb('{"step":9}'), { step: 5, start: null, path: 'a' });
  await rememberStart(s, 'community');
  assert.equal(await takeStart(s), 'community');
  assert.equal(await takeStart(s), null);
  await setShortPending(s, true);
  assert.equal(await isShortPending(s), true);
  await setShortPending(s, false);
  assert.equal(await isShortPending(s), false);
});

test('yol ve ilk sekme: kisisel_plan kapalıysa herkes B; başlangıç kartı → sekme', () => {
  assert.equal(resolvePath('a', false), 'b');
  assert.equal(resolvePath('a', true), 'a');
  assert.equal(resolvePath('b', true), 'b');
  assert.equal(firstTabFor('track', true), 'Tracker');
  assert.equal(firstTabFor('recipes', true), 'KesfetTab');
  assert.equal(firstTabFor('community', true), 'KesfetTab');
  assert.equal(firstTabFor('recipes', false), 'Tracker');
});

test('olaylar: sağlık değeri prop’u yok; reg_q_answer yalnız soru kimliği', () => {
  __sent.length = 0;
  kTrack.onbStep(2, 'tr');
  kTrack.pathChoice('a', 'track');
  kTrack.answer('P5', 'a');
  kTrack.planReady(false);
  kTrack.signupMethod('apple', 'a');
  kTrack.metaConsent(false, 'denied');
  kTrack.paywallView('yearly');
  kTrack.trialStart('balance_yearly', 'success');
  assert.deepEqual(__sent.map((x) => x.name), ['onb_step_view', 'onb_path_choice', 'reg_q_answer', 'plan_ready', 'reg_signup_method', 'meta_consent', 'paywall_view_reg', 'trial_start_reg']);
  for (const e of __sent) for (const k of Object.keys(e.props)) assert.ok(!(HEALTH_KEYS as readonly string[]).includes(k), `${e.name}.${k}`);
  assert.deepEqual(Object.keys(__sent[2].props).sort(), ['path', 'q']);
});

test('i18n: TR/EN anahtar kümesi aynı; 4. ekran Keşfet metni (G43); Padel/etkinlik içeriği yok', () => {
  const keys = (o: unknown, p = ''): string[] =>
    o && typeof o === 'object' ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p];
  assert.deepEqual(keys(tr).sort(), keys(en).sort());
  assert.equal(tr.onb.s4.title, "Keşfet'te paylaş, ilham al.");
  assert.equal(tr.onb.s4.sub, 'Tariflerini paylaş, takip et, başkalarından ilham al.');
  assert.equal(en.onb.s4.title, 'Share and get inspired on Explore.');
  assert.equal(en.onb.s4.sub, 'Share your recipes, follow others and get inspired.');
  assert.equal(tr.onb.card_community, 'Keşfet ve topluluk');
  assert.equal(en.onb.card_community, 'Explore and community');
  const all = JSON.stringify({ tr: tr.onb, en: en.onb });
  assert.doesNotMatch(all, /padel|etkinlik|event/i);
});

test('biçim: ay aralığı TR/EN, binlik, ondalık, fark hapı', async () => {
  const f = await import('../format');
  assert.equal(f.monthRange('2027-02-10', '2027-03-20', 'tr'), 'Şubat – Mart 2027');
  assert.equal(f.monthRange('2027-02-10', '2027-03-20', 'tr', true), 'Şub – Mar 2027');
  assert.equal(f.monthRange('2026-12-10', '2027-01-20', 'en'), 'December 2026 – January 2027');
  assert.equal(f.monthRange('2027-02-01', '2027-02-20', 'en'), 'February 2027');
  assert.equal(f.fmtInt(1850, 'tr'), '1.850');
  assert.equal(f.fmtInt(1850, 'en'), '1,850');
  assert.equal(f.fmtDec1(72, 'tr'), '72,0');
  assert.equal(f.fmtDec1(72, 'en'), '72.0');
  assert.equal(f.fmtDiff(-6, 'metric', 'tr'), '−6 kg');
  assert.equal(f.fmtDiff(2, 'metric', 'tr'), '+2 kg');
  assert.equal(f.fmtHeight(170, 'imperial').value, '5′7″');
  assert.equal(f.fmtPace(0.25, 'tr'), '0,25');
});

test('B kısa profil → takip kapısı taslağı (kas kazanmak → gain, sağlıklı → regular)', async () => {
  const { toTakibeDraft } = await import('../plan');
  assert.equal(toTakibeDraft(base({ goal: 'muscle' }), true).goal, 'gain');
  assert.equal(toTakibeDraft(base({ goal: 'balanced' }), true).goal, 'regular');
  const d = toTakibeDraft(base(), false);
  assert.equal(d.consent, false);
  assert.equal(d.activity, 'light');
});
