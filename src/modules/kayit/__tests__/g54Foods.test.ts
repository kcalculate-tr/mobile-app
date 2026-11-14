// G54-S1 md.4 — yemediklerin (gruplar, TR/EN arama, özel öğe, 30 sınırı, "Hepsini yerim") + mutfaklar (sıra, ölçüm,
// görsel eşleme) + kullanım noktaları (L2 tarif dışlama, Koç bağlamı).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CUSTOM_PREFIX, DISLIKE_GROUPS, DISLIKE_MAX, FOOD_KEYS, FOODS, addCustomDislike, canAddCustom, dislikeLabel, dislikeTerms, exactFood, searchFoods, toggleDislike, toggleEatsAll } from '../foods';
import { A_QUESTIONS, K_CUISINES, PANO, canContinue, emptyKAnswers, nextStep, prevStep } from '../model';
import { pickRecipes, recipeAvoids } from '../plan';
import { prefs } from '../../../../supabase/functions/coach-chat/plan';

const ROOT = join(__dirname, '../../../..');

test('gruplar görevdeki sırayla; her hazır çipin TR + EN adı var; yerel liste ~150 besin', () => {
  assert.deepEqual(DISLIKE_GROUPS.map((g) => g.key), ['meat', 'sea', 'dairy_egg', 'grain', 'legume_nut', 'veg', 'fruit', 'taste', 'other']);
  assert.deepEqual(DISLIKE_GROUPS.find((g) => g.key === 'veg')!.items, ['onion', 'garlic', 'eggplant', 'mushroom', 'pepper', 'tomato', 'broccoli', 'cauliflower', 'celery', 'okra']);
  for (const g of DISLIKE_GROUPS) for (const k of g.items) assert.ok(FOODS[k]?.tr && FOODS[k]?.en, k);
  assert.ok(FOOD_KEYS.length >= 140 && FOOD_KEYS.length <= 170, String(FOOD_KEYS.length));
  // G42 eski anahtarlar korunur (eski kayıtlar okunur).
  for (const k of ['red_meat', 'dairy', 'legumes', 'nuts', 'zucchini', 'olive']) assert.ok(FOODS[k], k);
});

test('arama Türkçe ve İngilizce, aksan duyarsız; önce baştan eşleşen', () => {
  assert.equal(searchFoods('mant')[0], 'mushroom');
  assert.equal(searchFoods('mushr')[0], 'mushroom');
  assert.ok(searchFoods('sogan').includes('onion'));
  assert.ok(searchFoods('KARİDES').includes('seafood'));
  assert.ok(searchFoods('fıstık').includes('peanut'));
  assert.deepEqual(searchFoods('   '), []);
  assert.equal(exactFood('patlıcan'), 'eggplant');
  assert.equal(exactFood('Eggplant'), 'eggplant');
});

test('özel öğe: listede yoksa "ekle" satırı; eklenince çip, × ile çıkar; listede birebir varsa standart anahtar', () => {
  assert.equal(canAddCustom('kuşkonmaz', []), false); // listede var
  assert.equal(canAddCustom('Ejder meyvesi', []), true);
  let s = addCustomDislike({ dislikes: [], eatsAll: true }, '  Ejder meyvesi ');
  assert.deepEqual(s, { dislikes: [`${CUSTOM_PREFIX}Ejder meyvesi`], eatsAll: false });
  assert.equal(dislikeLabel(s.dislikes[0], 'en'), 'Ejder meyvesi');
  assert.equal(canAddCustom('ejder MEYVESİ', s.dislikes), false); // tekrar yok
  s = addCustomDislike(s, 'Patlıcan');
  assert.deepEqual(s.dislikes, [`${CUSTOM_PREFIX}Ejder meyvesi`, 'eggplant']);
  s = toggleDislike(s, `${CUSTOM_PREFIX}Ejder meyvesi`);
  assert.deepEqual(s.dislikes, ['eggplant']);
});

test('"Hepsini yerim" seçilince diğer seçimler temizlenir; bir besin seçilince "Hepsini yerim" kalkar', () => {
  const on = toggleEatsAll({ dislikes: ['onion', `${CUSTOM_PREFIX}x`], eatsAll: false });
  assert.deepEqual(on, { dislikes: [], eatsAll: true });
  assert.deepEqual(toggleDislike(on, 'garlic'), { dislikes: ['garlic'], eatsAll: false });
  assert.deepEqual(addCustomDislike(on, 'Kestane mantarı tozu'), { dislikes: [`${CUSTOM_PREFIX}Kestane mantarı tozu`], eatsAll: false });
});

test('en çok 30 öğe', () => {
  let s = { dislikes: [] as string[], eatsAll: false };
  for (const k of FOOD_KEYS.slice(0, 35)) s = toggleDislike(s, k);
  assert.equal(s.dislikes.length, DISLIKE_MAX);
  assert.equal(addCustomDislike(s, 'Yeni şey').dislikes.length, DISLIKE_MAX);
  assert.equal(canAddCustom('Yeni şey', s.dislikes), false);
});

test('kullanım: L2 tarif önerisi yemediklerini (özel öğe dahil) içermez', () => {
  const r = (key: string, slot: 'breakfast' | 'lunch' | 'dinner', ing: string[]) => ({ key, nameTr: key, nameEn: key, slot, macros: { kcal: 500 }, diets: ['all'], ingredients: ing.map((k) => ({ key: k })) });
  assert.equal(recipeAvoids(r('a', 'lunch', ['shrimp_peeled']), ['seafood']), true);
  assert.equal(recipeAvoids(r('b', 'lunch', ['wheat_flour']), ['gluten']), true);
  assert.equal(recipeAvoids(r('c', 'lunch', ['quinoa_cooked']), [`${CUSTOM_PREFIX}Kinoa`]), false);
  assert.equal(recipeAvoids(r('d', 'lunch', ['kinoa']), [`${CUSTOM_PREFIX}Kinoa`]), true);
  const picked = pickRecipes([r('x', 'breakfast', ['egg']), r('y', 'breakfast', ['oats'])], { diet: 'all', dislikes: ['egg'] }, { meals: [{ slot: 'breakfast', kcal: 500 }] as never, calories: 2000 });
  assert.deepEqual(picked.map((p) => p.key), ['y']);
  assert.ok(dislikeTerms(['milk', `${CUSTOM_PREFIX}Şalgam`]).includes('salgam'));
});

test('kullanım: Koç bağlamı yemediklerin + mutfaklar (Hepsini yerimde boş; boşsa alan yok)', () => {
  assert.deepEqual(prefs({ dislikes: ['red_meat', `${CUSTOM_PREFIX}Kereviz sapı`], cuisines: ['japon', 'ege'] }, {}), { avoid: ['red meat', 'Kereviz sapı'], cuisines: ['japon', 'ege'] });
  assert.deepEqual(prefs({ dislikes: ['onion'], eatsAll: true }, {}), {});
  assert.deepEqual(prefs({}, {}), {});
  const prompt = readFileSync(join(ROOT, 'supabase/functions/coach-chat/prompt.ts'), 'utf8');
  assert.match(prompt, /CONTEXT\.personalPlan\.avoid/);
  assert.match(prompt, /CONTEXT\.personalPlan\.cuisines/);
});

test('mutfak sorusu: "Nasıl beslenirsin"den hemen sonra, isteğe bağlı; ölçüm reg_q_answer q=cuisines; B yolunda yok', () => {
  assert.equal(A_QUESTIONS[A_QUESTIONS.indexOf('diet') + 1], 'cuisines');
  const a = { ...emptyKAnswers(), goal: 'lose' as const, diet: 'all' as const };
  assert.equal(nextStep('diet', a, 2026), 'cuisines');
  assert.equal(prevStep('cuisines', a), 'diet');
  assert.equal(canContinue('cuisines', a), true);
  assert.equal(PANO.cuisines, 'cuisines');
  assert.equal(K_CUISINES.length, 18);
  assert.deepEqual(emptyKAnswers().cuisines, []);
});

test('mutfak görselleri: eşleme tablosu yalnız var olan dosyaları ister; betik kopyalar + tabloyu yazar', () => {
  const map = readFileSync(join(ROOT, 'src/modules/kayit/cuisineImages.ts'), 'utf8');
  for (const m of map.matchAll(/require\('\.\.\/\.\.\/\.\.\/assets\/kayit\/cuisines\/([a-z]+)\.jpg'\)/g)) {
    assert.ok(readFileSync(join(ROOT, `assets/kayit/cuisines/${m[1]}.jpg`)).length > 0, m[1]);
  }
  const script = readFileSync(join(ROOT, 'scripts/sync-cuisine-images.mjs'), 'utf8');
  for (const k of K_CUISINES) assert.ok(script.includes(`'${k}'`), k);
  assert.match(script, /docs\/tur28\/mutfaklar/);
});
