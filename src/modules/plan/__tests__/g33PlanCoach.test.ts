// G33-S1 md.7 — Balance "Koç'la oluştur": edge fonksiyonu yalnız sıra + kısa açıklama; makro LLM'den
// ALINMAZ; 1 koç mesajı kotası (reserve/consume/release); coach-chat ile aynı sağlayıcı/model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildSystemPrompt, parseModelRank, parseRankInput } from '../../../../supabase/functions/meal-plan-generate/rank';
import { parseCoachPlanReply } from '../coach';
import { candidatePlans, summarizeForCoach } from '../generate';
import { seedRecipeInfos } from '../nutrition';
import { weekDays } from '../week';

const ROOT = join(__dirname, '../../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const cands = candidatePlans(
  { recipes: seedRecipeInfos(), days: weekDays('2026-11-09').slice(2), target: { kcal: 2180, protein: 140 }, diet: 'all', avoid: ['peanut'], eatkcal: null, keep: [], keepPlanned: true, variant: 0 },
  3,
);

test('edge gövdesi: 3 aday, 7 gün, 6 öğün sınırı; hedef aralık dışı → null', () => {
  const ok = parseRankInput({ lang: 'tr', target: { kcal: 2180, protein: 140 }, avoid: ['peanut'], diet: 'all', candidates: [...cands, ...cands].map(summarizeForCoach) });
  assert.ok(ok);
  assert.equal(ok!.candidates.length, 3);
  assert.equal(parseRankInput({ target: { kcal: 100 }, candidates: cands.map(summarizeForCoach) }), null);
  assert.equal(parseRankInput({ target: { kcal: 2000 }, candidates: [] }), null);
});

test('model yanıtı: sıra tamamlanır, not kırpılır; JSON değilse null', () => {
  assert.deepEqual(parseModelRank('ok {"order":[2,0],"note":"Her gün hedefe yakın."}', 3), { order: [2, 0, 1], note: 'Her gün hedefe yakın.' });
  assert.equal(parseModelRank('düz metin', 3), null);
  assert.equal(parseModelRank('{"order":[],"note":"x"}', 3), null);
  assert.equal(parseModelRank('{"order":[9],"note":""}', 3), null);
});

test('istemci: yanıttaki sayılar kullanılmaz; yalnız sıra dizini + not; 402 → quota', () => {
  assert.deepEqual(parseCoachPlanReply({ order: [1, 0, 2], note: ' Fıstık çıkarıldı. ', kcal: 999 }, 3), { ok: true, index: 1, note: 'Fıstık çıkarıldı.' });
  assert.deepEqual(parseCoachPlanReply({ error: 'quota' }, 3), { ok: false, reason: 'quota' });
  assert.deepEqual(parseCoachPlanReply({ order: [7], note: 'x' }, 3), { ok: false, reason: 'error' });
});

test('sistem istemi: makro değiştirme yasak, tıbbi tavsiye yok, JSON', () => {
  for (const l of ['tr', 'en'] as const) {
    const p = buildSystemPrompt(l);
    assert.match(p, /JSON/);
  }
  assert.match(buildSystemPrompt('tr'), /asla değiştirme/);
  assert.match(buildSystemPrompt('en'), /Never change/);
});

test('edge: coach-chat ile aynı model varsayılanı + kota RPC’leri (reserve/release/consume)', () => {
  const src = read('supabase/functions/meal-plan-generate/index.ts');
  const coach = read('supabase/functions/coach-chat/index.ts');
  const model = /COACH_MODEL = Deno\.env\.get\('COACH_MODEL'\) \?\? '([^']+)'/;
  assert.equal(src.match(model)?.[1], coach.match(model)?.[1]);
  assert.match(src, /rpc\('reserve_coach_message'\)/);
  assert.match(src, /rpc\('release_coach_message'/);
  assert.match(src, /rpc\('consume_coach_message'/);
  assert.match(src, /api\.anthropic\.com\/v1\/messages/);
});
