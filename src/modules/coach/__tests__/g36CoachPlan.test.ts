// G36-S1 md.13 (İlter 12 Kas, G34 SORULAR 7) — coach-chat sistem istemi kişisel planı (hedef,
// kalori/makro, tempo, hedef tarihi) YALNIZ Koç AI izni açıksa okur. Saf yardımcılar + istem +
// edge kaynak sözleşmesi (metin denetimi; deploy İlter).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildSystemPrompt, type CoachContext } from '../../../../supabase/functions/coach-chat/prompt';
import { coachConsentGranted, personalPlanContext } from '../../../../supabase/functions/coach-chat/plan';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const CTX: CoachContext = {
  lang: 'tr',
  date: '2026-11-12',
  gender: 'female',
  kcalFloor: 1200,
  today: { kcal: 900, protein: 50, carbs: 90, fat: 30 },
  goals: { kcal: 1440, protein: 130, carbs: 133, fat: 43 },
  last7: [],
  recentMeals: [],
  izmir: false,
  products: [],
  recipes: [],
  ref: null,
};

const ROW = {
  target_weight_kg: 65,
  pace_kg_week: 0.5,
  plan_target_date: '2027-02-18',
  plan_started_at: '2026-11-12',
  personal_plan: {
    v: 1,
    answers: { goal: 'lose', weightKg: 72, targetWeightKg: 65 },
    result: { calories: 1440, macros: { protein: 130, carbs: 133, fat: 43 }, effectivePace: 0.5, targetDate: '2027-02-18' },
    custom: null,
    startedAt: '2026-11-12',
    startWeightKg: 72,
    targetDate: '2027-02-18',
  },
};

test('izin: son sunucu satırı kazanır (geri alma her zaman); satır yoksa istemci bildirimi', () => {
  assert.equal(coachConsentGranted({ granted: true }, false), true);
  assert.equal(coachConsentGranted({ granted: false }, true), false);
  assert.equal(coachConsentGranted(null, true), true);
  assert.equal(coachConsentGranted(null, false), false);
  assert.equal(coachConsentGranted(undefined, 'true'), false);
});

test('plan bağlamı: hedef, kalori/makro, tempo, hedef tarihi', () => {
  assert.deepEqual(personalPlanContext(ROW), {
    goal: 'lose',
    startWeightKg: 72,
    targetWeightKg: 65,
    paceKgWeek: 0.5,
    calories: 1440,
    protein: 130,
    carbs: 133,
    fat: 43,
    targetDate: '2027-02-18',
    startedAt: '2026-11-12',
  });
});

test('plan bağlamı: Düzenle ile sapıldıysa kullanıcının değerleri; koru → tempo 0, hedef/tarih yok', () => {
  const custom = personalPlanContext({ ...ROW, personal_plan: { ...ROW.personal_plan, custom: { calories: 1500, protein: 120, carbs: 160, fat: 45 } } });
  assert.equal(custom?.calories, 1500);
  assert.equal(custom?.protein, 120);
  const keep = personalPlanContext({ personal_plan: { ...ROW.personal_plan, answers: { goal: 'maintain', weightKg: 72 }, targetDate: null } });
  assert.equal(keep?.paceKgWeek, 0);
  assert.equal(keep?.targetWeightKg, null);
  assert.equal(keep?.targetDate, null);
});

test('plan bağlamı: bozuk / eksik jsonb → null', () => {
  assert.equal(personalPlanContext(null), null);
  assert.equal(personalPlanContext({}), null);
  assert.equal(personalPlanContext({ personal_plan: { v: 2 } }), null);
  assert.equal(personalPlanContext({ personal_plan: { v: 1, answers: { goal: 'x' }, result: { calories: 1400 } } }), null);
  assert.equal(personalPlanContext({ personal_plan: { v: 1, answers: { goal: 'lose' }, result: {} } }), null);
});

test('istem: plan YALNIZ bağlamda varsa — kural satırı + CONTEXT.personalPlan; yoksa hiç geçmez', () => {
  const without = buildSystemPrompt(CTX);
  assert.doesNotMatch(without, /PERSONAL PLAN/);
  assert.doesNotMatch(without, /personalPlan/);
  const withPlan = buildSystemPrompt({ ...CTX, personalPlan: personalPlanContext(ROW) });
  assert.match(withPlan, /PERSONAL PLAN: CONTEXT\.personalPlan is the user's own plan/);
  assert.match(withPlan, /Never suggest a faster pace, a lower calorie target than the plan or anything below kcalFloor/);
  assert.match(withPlan, /"personalPlan":\{"goal":"lose".*"paceKgWeek":0\.5,"calories":1440.*"targetDate":"2027-02-18"/);
});

test('edge: izin denetimi + ayrı sorgu (G34 kolonları yoksa ana profil bozulmaz) + istemci ai_consent', () => {
  const idx = read('supabase/functions/coach-chat/index.ts');
  assert.match(idx, /\.eq\('kind', 'ai_coach'\)/);
  assert.match(idx, /if \(!coachConsentGranted\(latest, clientConsent\)\) return null/);
  assert.match(idx, /select\('personal_plan, target_weight_kg, pace_kg_week, plan_target_date, plan_started_at, updated_at'\)/);
  assert.match(idx, /buildContext\(admin, user\.id, lang, body\.ref, body\.ai_consent\)/);
  // Ana profil sorgusu kişisel plan kolonlarını İSTEMEZ.
  assert.match(idx, /select\('gender, target_calories, target_protein, target_carbs, target_fat, custom_calories, custom_protein, custom_carbs, custom_fat, use_custom_macros, updated_at'\)/);
  const client = read('src/modules/coach/client.ts');
  assert.match(client, /ai_consent: aiConsent/);
  assert.match(client, /hasCoachConsent\(\)/);
});
