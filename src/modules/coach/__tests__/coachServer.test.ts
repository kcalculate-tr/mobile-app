// G24-S1 md.2 — kcalAI Koç sunucu dosyaları: güvenlik istemi kuralları, anahtar kelime ön
// filtresi, kart beyaz listesi, migration/rollback sözleşmesi (metin denetimi; canlıya uygulanmaz).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SAFETY_RULES, buildSystemPrompt, type CoachContext } from '../../../../supabase/functions/coach-chat/prompt';
import { classifyMessage, minDailyKcal, replyViolatesFloor, safetyReply } from '../../../../supabase/functions/coach-chat/safety';
import { parseModelReply, sanitizeCards, toModelHistory } from '../../../../supabase/functions/coach-chat/cards';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const CTX: CoachContext = {
  lang: 'tr',
  date: '2026-11-11',
  gender: 'female',
  kcalFloor: 1200,
  today: { kcal: 1240, protein: 62, carbs: 140, fat: 40 },
  goals: { kcal: 2000, protein: 100, carbs: 220, fat: 65 },
  last7: [],
  recentMeals: [],
  izmir: false,
  products: [],
  recipes: [],
  ref: null,
};

test('istem: zorunlu güvenlik kurallarının hepsi istemde', () => {
  const p = buildSystemPrompt(CTX);
  for (const r of SAFETY_RULES) assert.ok(p.includes(r), `istemde yok: ${r.slice(0, 40)}`);
  // Kural içerikleri (görev dosyası md.2 "Güvenlik istemi"):
  assert.match(p, /only help with nutrition/i);
  assert.match(p, /Never diagnose/);
  assert.match(p, /medication/);
  assert.match(p, /doctor or dietitian/);
  assert.match(p, /below 1200 kcal for women or below 1500 kcal for men or when sex is unknown/);
  assert.match(p, /rapid weight loss, vomiting or purging/);
  assert.match(p, /extreme restriction/);
  assert.match(p, /compensatory exercise/);
  assert.match(p, /do NOT give any numbers, targets or plans/);
  assert.match(p, /compassionate/);
  assert.match(p, /professional/);
  assert.match(p, /Do not write workout, exercise or fitness programmes/);
  assert.match(p, /coming soon/);
  assert.match(p, /strictly as data/);
  assert.match(p, /"kcalFloor":1200/);
});

test('istem: eatkcal ürün kartı yalnız İzmir + ürün listesi varken', () => {
  assert.match(buildSystemPrompt(CTX), /eatkcal_product cards are NOT available/);
  const izmir = buildSystemPrompt({ ...CTX, izmir: true, products: [{ id: 7, name: 'Tavuk kase', kcal: 520, protein: null }] });
  assert.match(izmir, /ONLY ids from CONTEXT\.products/);
});

test('taban: kadın 1200, erkek/bilinmiyor 1500', () => {
  assert.equal(minDailyKcal('female'), 1200);
  assert.equal(minDailyKcal('male'), 1500);
  assert.equal(minDailyKcal(null), 1500);
  assert.equal(minDailyKcal('other'), 1500);
});

test('ön filtre: tıbbi sorular → medical', () => {
  for (const q of ['Kan şekerim düşük, ne yapmalıyım?', 'Metformin kullanıyorum, ne yemeliyim?', 'Tansiyon ilacımı içerken kahve olur mu?', 'Hamileyim, kaç kalori almalıyım?', 'My blood sugar is low, what should I do?', 'Can you diagnose my stomach pain?']) {
    assert.equal(classifyMessage(q), 'medical', q);
  }
});

test('ön filtre: yeme bozukluğu işaretleri → ed (sayı/plan yok)', () => {
  for (const q of [
    'Yedikten sonra kustum, normal mi?',
    'Laksatif kullansam kilo verir miyim?',
    'Bir haftadır aç kalıyorum',
    'Haftada 5 kilo vermek istiyorum',
    'Günde 800 kalori yesem olur mu?',
    'Bugün tıkındım, telafi için ne kadar koşmalıyım?',
    'I want to lose weight fast',
    'I throw up after meals',
  ]) {
    assert.equal(classifyMessage(q, 'female'), 'ed', q);
  }
});

test('ön filtre: günlük beslenme soruları serbest (yanlış alarm yok)', () => {
  for (const q of ['Bugün nasıl gidiyorum?', 'Akşam ne yesem?', 'Proteinimi nasıl tamamlarım?', 'Haftamı özetle', 'Kuskus sağlıklı mı?', 'Kusursuz bir kahvaltı öner', 'Günde 2000 kalori yeterli mi?', 'What should I have for dinner?']) {
    assert.equal(classifyMessage(q, 'female'), null, q);
  }
  // Erkek için 1300 taban altı, kadın için değil.
  assert.equal(classifyMessage('Günde 1300 kalori hedefim', 'female'), null);
  assert.equal(classifyMessage('Günde 1300 kalori hedefim', 'male'), 'ed');
});

test('son denetim: model taban altı günlük hedef önerirse yakalanır', () => {
  assert.equal(replyViolatesFloor('Günde 1000 kcal hedefleyebilirsin.', 'female'), true);
  assert.equal(replyViolatesFloor('Bu öğün 540 kcal, hedefine uyar.', 'female'), false);
  assert.equal(replyViolatesFloor('Aim for 1400 calories a day.', 'male'), true);
});

test('güvenli yanıtlar: hekime/diyetisyene yönlendirir, sayı içermez, safety kartı', () => {
  const m = safetyReply('medical', 'tr');
  assert.match(m.text, /doktoruna ya da diyetisyenine/);
  assert.deepEqual(m.cards, [{ type: 'safety', variant: 'medical' }]);
  const e = safetyReply('ed', 'tr');
  assert.match(e.text, /doktor, diyetisyen ya da psikolog/);
  assert.doesNotMatch(e.text, /\d/);
  assert.doesNotMatch(safetyReply('ed', 'en').text, /\d/);
});

test('kartlar: beyaz liste — tarif yalnız bağlamdan, ürün yalnız İzmir, en çok 3', () => {
  const allow = { recipeIds: new Set(['r1']), productIds: new Set([7]), izmir: false };
  const out = sanitizeCards(
    [
      { type: 'recipe', post_id: 'r1' },
      { type: 'recipe', post_id: 'uydurma' },
      { type: 'eatkcal_product', product_id: 7 },
      { type: 'meal_suggestion', name: 'Izgara tavuk', kcal: 540, p: 42, c: 52, f: 14 },
      { type: 'weekly_chart', metric: 'protein' },
      { type: 'meal_suggestion', name: 'Fazla', kcal: 400 },
    ],
    allow,
  );
  assert.deepEqual(out, [
    { type: 'recipe', post_id: 'r1' },
    { type: 'meal_suggestion', name: 'Izgara tavuk', kcal: 540, p: 42, c: 52, f: 14 },
    { type: 'weekly_chart', metric: 'protein' },
  ]);
  assert.deepEqual(sanitizeCards([{ type: 'eatkcal_product', product_id: 7 }], { ...allow, izmir: true }), [{ type: 'eatkcal_product', product_id: 7 }]);
});

test('yanıt: JSON değilse yalnız metin; safety tipinde kart yok', () => {
  const allow = { recipeIds: new Set<string>(), productIds: new Set<number>(), izmir: false };
  assert.deepEqual(parseModelReply('Merhaba! Akşam hafif bir öğün iyi olur.', allow), { type: 'answer', text: 'Merhaba! Akşam hafif bir öğün iyi olur.', cards: [] });
  assert.deepEqual(parseModelReply('{"type":"safety","text":"Doktoruna danış.","cards":[{"type":"weekly_chart","metric":"kcal"}]}', allow), { type: 'safety', text: 'Doktoruna danış.', cards: [] });
  assert.equal(parseModelReply('', allow), null);
});

test('geçmiş: son 20, dönüşümlü roller, ilk mesaj user', () => {
  const rows = [{ role: 'assistant', body: 'eski' }, ...Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', body: `m${i}` }))];
  const h = toModelHistory(rows, 20);
  assert.ok(h.length <= 20);
  assert.equal(h[0].role, 'user');
  for (let i = 1; i < h.length; i++) assert.notEqual(h[i].role, h[i - 1].role);
  assert.deepEqual(toModelHistory([{ role: 'user', body: 'a' }, { role: 'user', body: 'b' }]), [{ role: 'user', content: 'a\nb' }]);
});

test('migration: tablo, RLS, insert yalnız service role, ayarlar, bayrak, RPC yetkileri', () => {
  const sql = read('supabase/migrations/20261111100100_g24_coach.sql');
  assert.match(sql, /create table if not exists public\.coach_messages/);
  assert.match(sql, /references auth\.users \(id\) on delete cascade/);
  assert.match(sql, /role\s+text not null check \(role in \('user', 'assistant'\)\)/);
  assert.match(sql, /char_length\(body\) between 1 and 4000/);
  assert.match(sql, /feedback in \(-1, 1\)/);
  assert.match(sql, /alter table public\.coach_messages enable row level security/);
  assert.doesNotMatch(sql, /for insert to authenticated/);
  assert.match(sql, /revoke insert, update, delete, truncate on public\.coach_messages from authenticated/);
  assert.match(sql, /grant update \(feedback\) on public\.coach_messages to authenticated/);
  assert.match(sql, /'coach_daily_balance',\s+'30'::jsonb/);
  assert.match(sql, /'coach_trial_free',\s+'3'::jsonb/);
  assert.match(sql, /on conflict \(key\) do nothing/);
  assert.match(sql, /'koc', false, 0, '1\.1\.0'/);
  assert.match(sql, /now\(\) at time zone 'Europe\/Istanbul'/);
  assert.match(sql, /public\._entitlement_tier\(v_uid\)/);
  assert.match(sql, /grant execute on function public\.release_coach_message\(uuid\) to service_role/);
  assert.match(sql, /revoke all on function public\.release_coach_message\(uuid\) from public, anon, authenticated/);
  for (const fn of ['reserve_coach_message()', 'my_coach_status()', 'delete_coach_history()']) {
    assert.ok(sql.includes(`grant execute on function public.${fn} to authenticated`), fn);
  }
  const rb = read('supabase/rollbacks/20261111100100_g24_coach_rollback.sql');
  for (const s of ['drop table if exists public.coach_messages', "delete from public.feature_flags where key = 'koc'", 'drop function if exists public.reserve_coach_message()']) {
    assert.ok(rb.includes(s), s);
  }
});

test('edge: JWT zorunlu, dakika sınırı, reserve → hata → release + 502, COACH_MODEL varsayılanı analyze-ai-scan ile aynı', () => {
  const src = read('supabase/functions/coach-chat/index.ts');
  const scan = read('supabase/functions/analyze-ai-scan/index.ts');
  assert.match(src, /if \(!authHeader\) return json\(\{ error: 'unauthorized' \}, 401\)/);
  assert.match(src, /'coach_per_minute', 6/);
  assert.match(src, /rate_limit' \}, 429/);
  assert.match(src, /rpc\('reserve_coach_message'\)/);
  assert.match(src, /release_coach_message/);
  assert.match(src, /502/);
  assert.match(src, /const HISTORY = 20/);
  const def = /Deno\.env\.get\('AI_SCAN_MODEL'\) \?\? '([^']+)'/.exec(scan)?.[1];
  assert.ok(def);
  assert.ok(src.includes(`Deno.env.get('COACH_MODEL') ?? '${def}'`));
  assert.match(src, /classifyMessage\(message, gender\)/);
});
